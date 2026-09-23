const cacheService = require("../services/cacheService");
const { getAgentTools } = require("../services/aiAgentService");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require("@langchain/core/messages");
const { PromptTemplate } = require("@langchain/core/prompts");

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_ITEM_LENGTH = 1000;
const DESTINATION_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s,.'-]{1,59}$/;
const UNSUPPORTED_DESTINATIONS = new Set(["mars", "moon", "jupiter", "saturn", "venus", "mercury", "uranus", "neptune", "pluto"]);

const validateAITripInput = ({ destination, budget, days, travelType }) => {
  const cleanDestination = typeof destination === "string" ? destination.trim() : "";
  const numericBudget = Number(budget);
  const numericDays = Number(days);
  const allowedTravelTypes = ["Solo", "Friends", "Family", "Couple"];

  if (!DESTINATION_REGEX.test(cleanDestination)) {
    return "Enter a valid destination using letters (for example: Goa or New Delhi).";
  }
  if (UNSUPPORTED_DESTINATIONS.has(cleanDestination.toLowerCase())) {
    return "Please enter a real-world destination on Earth.";
  }
  if (!Number.isFinite(numericBudget) || numericBudget <= 0 || numericBudget > 100000000) {
    return "Budget must be greater than 0 and within a reasonable range.";
  }
  if (!Number.isInteger(numericDays) || numericDays < 1 || numericDays > 30) {
    return `Trip duration must be between 1 and 30 days.`;
  }
  if (!allowedTravelTypes.includes(travelType)) {
    return "Invalid travel type.";
  }
  return null;
};

// ─── SYNCHRONOUS AI PLANNER ────────────────────────────────────────────────
// Generates itinerary directly in the request (no BullMQ worker needed).
// Uses Redis cache to avoid re-generating identical itineraries.
const generateTripPlan = async (req, res) => {
  try {
    const { destination, budget, days, travelType } = req.body;
    const userId = req.user.id;

    console.log(`[AI PLANNER] Request from user ${userId}: ${destination}, ${days} days, ₹${budget}, ${travelType}`);

    const validationError = validateAITripInput({ destination, budget, days, travelType });
    if (validationError) return res.status(400).json({ message: validationError });

    const cacheKey = `trip_plan:${destination.toLowerCase().trim()}:${days}days:${budget}:${travelType}`;

    // Check cache first
    const cachedPlan = await cacheService.get(cacheKey);
    if (cachedPlan) {
      console.log(`[AI PLANNER] Cache hit for: ${cacheKey}`);
      return res.json({ plan: cachedPlan, source: "cache" });
    }

    console.log(`[AI PLANNER] Cache miss. Calling Gemini...`);

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "AI service is not configured. GEMINI_API_KEY is missing." });
    }

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
      travelType,
    });

    const result = await model.invoke(formattedPrompt);
    const planContent = result.content;

    console.log(`[AI PLANNER] Gemini responded (${planContent.length} chars). Caching and returning.`);

    // Cache for 24 hours
    await cacheService.set(cacheKey, planContent, 86400);

    return res.json({ plan: planContent, source: "gemini" });
  } catch (error) {
    console.error("========= AI PLANNER ERROR =========");
    console.error(error.message || error);

    // Return specific error messages for known Gemini errors
    if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
      return res.status(429).json({ message: "AI rate limit reached. Please wait a minute and try again." });
    }
    if (error.message?.includes("503") || error.message?.includes("high demand")) {
      return res.status(503).json({ message: "AI service is temporarily busy. Please try again in a moment." });
    }
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      return res.status(503).json({ message: "AI model is temporarily unavailable. Please try again later." });
    }
    return res.status(500).json({ message: "Unable to generate itinerary. Please try again." });
  }
};

// ─── LANGCHAIN CHAT ASSISTANT ──────────────────────────────────────────────
const chatWithAssistant = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;
    const io = req.app.get("io");

    console.log(`[AI CHAT] Message from user ${userId}: "${message.slice(0, 80)}"`);

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "AI service is not configured." });
    }

    const tools = getAgentTools(userId, io);
    const toolMap = {};
    tools.forEach(t => { toolMap[t.name] = t; });

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
    }).bindTools(tools);

    const chatHistory = history
      .slice(-8)
      .filter((item) => item && typeof item.text === "string")
      .map((item) =>
        item.role === "user"
          ? new HumanMessage(item.text.slice(0, MAX_HISTORY_ITEM_LENGTH))
          : new AIMessage(item.text.slice(0, MAX_HISTORY_ITEM_LENGTH))
      );

    const messages = [
      new SystemMessage(`You are an intelligent AI travel assistant for the AI Travel Planner app.
You have access to LIVE tools. Use them proactively.
Always lookup trips if the user asks for details about their trips.
You can calculate budget info or add expenses using the provided tools.
If users ask about policies or general knowledge, use retrieve_travel_knowledge.
Ensure you use markdown formatting. Do not hallucinate database info.`),
      ...chatHistory,
      new HumanMessage(message),
    ];

    let response = await model.invoke(messages);
    let iterations = 0;

    while (response.tool_calls && response.tool_calls.length > 0 && iterations < 4) {
      iterations++;
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const tool = toolMap[toolCall.name];
        if (tool) {
          console.log(`[AI CHAT] Tool call: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          const toolResult = await tool.invoke(toolCall.args);
          console.log(`[AI CHAT] Tool result: ${String(toolResult).slice(0, 200)}`);
          messages.push(new ToolMessage({
            content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
          }));
        } else {
          console.warn(`[AI CHAT] Unknown tool requested: ${toolCall.name}`);
          messages.push(new ToolMessage({
            content: `Tool "${toolCall.name}" is not available.`,
            tool_call_id: toolCall.id,
          }));
        }
      }

      response = await model.invoke(messages);
    }

    console.log(`[AI CHAT] Final response (${response.content.length} chars, ${iterations} tool rounds)`);
    return res.json({ reply: response.content });

  } catch (error) {
    console.error("========= AI CHAT ERROR =========");
    console.error(error.message || error);

    if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
      return res.status(429).json({ message: "AI rate limit reached. Please wait a minute and try again." });
    }
    if (error.message?.includes("503") || error.message?.includes("high demand")) {
      return res.status(503).json({ message: "AI service is temporarily busy. Please try again." });
    }
    return res.status(500).json({ message: "AI chat is unavailable right now. Please try again." });
  }
};

module.exports = {
  generateTripPlan,
  chatWithAssistant,
};