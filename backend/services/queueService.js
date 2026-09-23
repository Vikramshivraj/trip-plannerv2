const { Queue } = require("bullmq");
const Redis = require("ioredis");

const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const aiJobQueue = new Queue("ai-jobs", {
  connection: redisConnection,
});

const addAiJob = async (jobName, data) => {
  const job = await aiJobQueue.add(jobName, data);
  return job.id;
};

module.exports = {
  aiJobQueue,
  addAiJob,
  redisConnection
};
