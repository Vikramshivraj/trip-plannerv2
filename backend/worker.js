require("dotenv").config();
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const db = require("./config/db");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const cacheService = require("./services/cacheService");
const { initRAG } = require("./services/ragService");

const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Upsert a job row, creating it if it doesn't exist yet
const upsertJobStatus = async (jobId, userId, type, status, result = null) => {
  return new Promise((resolve, reject) => {
    const resultJson = result ? JSON.stringify(result) : null;
    // INSERT if not exists, UPDATE otherwise
    db.query(
      `INSERT INTO ai_jobs (id, user_id, type, status, result)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), result = VALUES(result)`,
      [jobId, userId, type, status, resultJson],
      (err, res) => {
        if (err) {
          // If ai_jobs table doesn't exist yet, just log and continue
          console.warn("ai_jobs upsert warning:", err.message);
          return resolve(null);
        }
        resolve(res);
      }
    );
  });
};

const processGenerateItinerary = async (job) => {
  const { destination, budget, days, travelType, jobId, userId } = job.data;

  // Initialize RAG to use it in background
  await initRAG();

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
    maxOutputTokens: 3000,
    apiKey: process.env.GEMINI_API_KEY,
  });

  const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert travel planner.

Create a professional travel itinerary.

Destination : {destination}
Budget : ₹{budget}
Duration : {days} days
Travel Type : {travelType}

Return response ONLY in markdown.

Format:
# Trip Summary
...
# Day 1
...
# Estimated Budget Breakdown
...
# Travel Tips
...
CRITICAL INSTRUCTION:
At the very end of your response, you MUST append a valid JSON array wrapped in \`\`\`json and \`\`\` tags containing top geographic locations as objects with "name" and "coordinates" [lat, lng].
`);

  const formattedPrompt = await promptTemplate.format({
    destination,
    budget,
    days,
    travelType
  });

  const result = await model.invoke(formattedPrompt);
  
  const cacheKey = `trip_plan:${destination.toLowerCase().trim()}:${days}days:${budget}:${travelType}`;
  await cacheService.set(cacheKey, result.content, 86400);

  return { plan: result.content };
};

const worker = new Worker("ai-jobs", async (job) => {
  const { jobId, userId } = job.data;
  console.log(`Processing job ${job.id} (internal jobId: ${jobId}) of type ${job.name}`);
  
  await upsertJobStatus(jobId, userId, job.name, "processing");

  try {
    let result;
    if (job.name === "generateItinerary") {
      result = await processGenerateItinerary(job);
    } else {
      throw new Error(`Unknown job type: ${job.name}`);
    }

    await upsertJobStatus(jobId, userId, job.name, "completed", result);
    console.log(`Job ${job.id} completed successfully`);
    return result;
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.message);
    await upsertJobStatus(jobId, userId, job.name, "failed", { error: error.message });
    throw error;
  }
}, { connection: redisConnection });

worker.on("completed", (job) => {
  console.log(`BullMQ job ${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
  console.log(`BullMQ job ${job.id} has failed with: ${err.message}`);
});

console.log("Worker started, listening for jobs...");
