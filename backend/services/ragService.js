const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const KNOWLEDGE_BASE_PATH = path.join(__dirname, "..", "knowledge_base.txt");
const QDRANT_URL = (process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "travel_knowledge";
const QDRANT_TIMEOUT_MS = 8000;
const MIN_RELEVANCE_SCORE = Number(process.env.RAG_MIN_SCORE || 0.35);
const EMBEDDING_MODEL = "gemini-embedding-2";

let embeddings = null;
let initializationPromise = null;

const qdrantRequest = async (route, options = {}) => {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (process.env.QDRANT_API_KEY) headers["api-key"] = process.env.QDRANT_API_KEY;

  const response = await fetch(`${QDRANT_URL}${route}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(QDRANT_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Qdrant request failed (${response.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
};

const makePointId = (source, index, content) => {
  const bytes = crypto.createHash("sha256").update(`${source}\0${index}\0${content}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const ensureCollection = async (vectorSize) => {
  const route = `/collections/${encodeURIComponent(QDRANT_COLLECTION)}`;
  try {
    const existing = await qdrantRequest(route);
    const vectors = existing.result?.config?.params?.vectors;
    if (vectors && typeof vectors.size === "number" && vectors.size !== vectorSize) {
      throw new Error(`Qdrant collection has vector size ${vectors.size}; embeddings have size ${vectorSize}. Use a new collection name or recreate the collection.`);
    }
  } catch (error) {
    if (!String(error.message).includes("(404)")) throw error;
    await qdrantRequest(route, {
      method: "PUT",
      body: JSON.stringify({ vectors: { size: vectorSize, distance: "Cosine" } }),
    });
  }
};

const getExistingContentHash = async (source) => {
  try {
    const result = await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/scroll`, {
      method: "POST",
      body: JSON.stringify({
        filter: { must: [{ key: "source", match: { value: source } }] },
        limit: 1,
        with_payload: ["contentHash"],
        with_vectors: false,
      }),
    });
    return result.result?.points?.[0]?.payload?.contentHash || null;
  } catch (error) {
    if (String(error.message).includes("(404)")) return null;
    throw error;
  }
};

const deleteSourcePoints = async (source) => {
  await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({
      filter: { must: [{ key: "source", match: { value: source } }] },
    }),
  });
};

const ingestKnowledgeBase = async () => {
  if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) {
    console.warn("[RAG] Knowledge base file not found; retrieval will be unavailable.");
    return;
  }

  const text = fs.readFileSync(KNOWLEDGE_BASE_PATH, "utf8");
  const source = path.basename(KNOWLEDGE_BASE_PATH);
  const contentHash = crypto.createHash("sha256").update(EMBEDDING_MODEL + "\0" + text).digest("hex");
  const existingHash = await getExistingContentHash(source);
  if (existingHash === contentHash) {
    console.log(`[RAG] ${source} is already indexed in Qdrant.`);
    return;
  }

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 100 });
  const docs = await splitter.createDocuments([text]);
  if (!docs.length) return;
  const vectors = await embeddings.embedDocuments(docs.map((doc) => "title: " + source + " | text: " + doc.pageContent));
  if (vectors.length !== docs.length || vectors.some((vector) => !Array.isArray(vector) || vector.length !== 768)) {
    throw new Error("Gemini returned incomplete knowledge-base embeddings.");
  }
  await ensureCollection(vectors[0].length);
  await deleteSourcePoints(source);
  const points = docs.map((doc, index) => ({
    id: makePointId(source, index, doc.pageContent),
    vector: vectors[index],
    payload: {
      text: doc.pageContent,
      source,
      chunkIndex: index,
      contentHash,
    },
  }));

  await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });
  console.log(`[RAG] Indexed ${points.length} chunks from ${source} in Qdrant.`);
};

const initRAG = () => {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("[RAG] GEMINI_API_KEY is missing; skipping embedding initialization.");
      return;
    }
    embeddings = new GoogleGenerativeAIEmbeddings({
      model: EMBEDDING_MODEL,
      outputDimensionality: 768,
      apiKey: process.env.GEMINI_API_KEY,
    });
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await ingestKnowledgeBase();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    throw lastError;
  })().catch((error) => {
    console.error("[RAG] Initialization failed:", error.message);
    initializationPromise = null;
  });
  return initializationPromise;
};

const retrieveTravelKnowledge = async (query, k = 3) => {
  if (typeof query !== "string" || !query.trim()) return "Please provide a travel question to search.";
  if (!embeddings) return "Travel knowledge search is not configured.";

  await initRAG();
  try {
    const queryVector = await embeddings.embedQuery("task: search result | query: " + query.trim().slice(0, 1000));
    const result = await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/query`, {
      method: "POST",
      body: JSON.stringify({
        query: queryVector,
        limit: Math.max(1, Math.min(Number.isInteger(k) ? k : 3, 5)),
        with_payload: true,
        score_threshold: Number.isFinite(MIN_RELEVANCE_SCORE) ? MIN_RELEVANCE_SCORE : 0.35,
      }),
    });
    const points = result.result?.points || [];
    if (!points.length) {
      return "No sufficiently relevant source was found in the travel knowledge base. Do not answer policy questions from memory.";
    }
    return JSON.stringify(points.map((point) => ({
      source: point.payload?.source || "travel knowledge base",
      text: point.payload?.text || "",
      relevance: Number(point.score?.toFixed(3)),
    })));
  } catch (error) {
    console.error("[RAG] Retrieval failed:", error.message);
    return "Travel knowledge search is temporarily unavailable. Do not present a policy answer as verified.";
  }
};

module.exports = { initRAG, retrieveTravelKnowledge };







