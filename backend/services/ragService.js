const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const VECTOR_STORE_PATH = path.join(__dirname, "..", "data", "memory_store.json");
const KNOWLEDGE_BASE_PATH = path.join(__dirname, "..", "knowledge_base.txt");

let storedDocs = []; // Array of { pageContent, embedding }
let embeddings = null;

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

const initRAG = async () => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY not set, skipping RAG initialization.");
      return;
    }

    embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Try loading pre-built store from disk
    if (fs.existsSync(VECTOR_STORE_PATH)) {
      console.log("Loading existing memory vector store...");
      storedDocs = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, "utf-8"));
      console.log(`Loaded ${storedDocs.length} document chunks.`);
      return;
    }

    // Build from knowledge base
    console.log("Building Memory vector store from knowledge base...");
    if (!fs.existsSync(KNOWLEDGE_BASE_PATH)) {
      console.warn("Knowledge base file not found, skipping RAG.");
      return;
    }

    const text = fs.readFileSync(KNOWLEDGE_BASE_PATH, "utf-8");
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 100 });
    const docs = await splitter.createDocuments([text]);

    // Embed each chunk
    const texts = docs.map(d => d.pageContent);
    const vectors = await embeddings.embedDocuments(texts);

    storedDocs = texts.map((t, i) => ({ pageContent: t, embedding: vectors[i] }));

    // Save to disk
    const dataDir = path.dirname(VECTOR_STORE_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(storedDocs));
    console.log(`Memory vector store saved (${storedDocs.length} chunks).`);
  } catch (error) {
    console.error("Error initializing RAG system:", error.message);
  }
};

const retrieveTravelKnowledge = async (query, k = 3) => {
  if (!storedDocs.length || !embeddings) return "No knowledge base available.";
  try {
    const queryVec = await embeddings.embedQuery(query);
    const scored = storedDocs.map(doc => ({
      pageContent: doc.pageContent,
      score: cosineSimilarity(queryVec, doc.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k);
    if (!top.length) return "No relevant information found.";
    return top.map(r => r.pageContent).join("\n\n---\n\n");
  } catch (error) {
    console.error("Error retrieving knowledge:", error.message);
    return "Error querying knowledge base.";
  }
};

const rebuildVectorStore = async () => {
  if (fs.existsSync(VECTOR_STORE_PATH)) fs.unlinkSync(VECTOR_STORE_PATH);
  storedDocs = [];
  await initRAG();
};

module.exports = { initRAG, retrieveTravelKnowledge, rebuildVectorStore };
