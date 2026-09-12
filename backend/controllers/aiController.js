const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const MAX_TRIP_DAYS = 30;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ITEM_LENGTH = 2000;
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

  if (!Number.isInteger(numericDays) || numericDays < 1 || numericDays > MAX_TRIP_DAYS) {
    return `Trip duration must be between 1 and ${MAX_TRIP_DAYS} days.`;
  }

  if (!allowedTravelTypes.includes(travelType)) {
    return "Invalid travel type.";
  }

  return null;
};

const generateTripPlan = async (req, res) => {
  try {
    const { destination, budget, days, travelType } = req.body;

    const validationError = validateAITripInput({ destination, budget, days, travelType });
    if (validationError) {
      return res.status(400).json({ message: validationError });
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
Destination
Budget
Duration
---
# Day 1
Morning
Afternoon
Evening
Night
Estimated Cost
---
# Day 2
same
---
# Recommended Hotels
Hotel Name
Approx Cost
Rating
---
# Food Recommendations
---
# Estimated Budget Breakdown
---
# Travel Tips
---
# Things To Carry
---
# Emergency Contacts
---

Make response attractive. Use markdown headings. Do not write unnecessary introduction.

CRITICAL INSTRUCTION:
At the very end of your response, you MUST append a valid JSON array wrapped in \`\`\`json and \`\`\` tags.
This array should contain the top 3-5 specific geographic locations/attractions mentioned in the itinerary, with their exact approximate latitude and longitude coordinates.
Format exactly like this:
\`\`\`json
[{{ "name": "Eiffel Tower", "lat": 48.8584, "lng": 2.2945 }}, {{ "name": "Louvre Museum", "lat": 48.8606, "lng": 2.3376 }}]
\`\`\`
`);

    const formattedPrompt = await promptTemplate.format({
      destination,
      budget,
      days,
      travelType
    });

    const result = await model.invoke(formattedPrompt);

    res.json({
      plan: result.content,
    });

  }  catch (error) {
    console.log("========= LANGCHAIN ERROR =========");
    console.log(error);
    res.status(500).json({ message: "Unable to generate a trip plan right now." });
  }
};

// Load our Knowledge Base for RAG
const knowledgeBasePath = path.join(__dirname, "../knowledge_base.txt");
let knowledgeBase = "";
if (fs.existsSync(knowledgeBasePath)) {
  knowledgeBase = fs.readFileSync(knowledgeBasePath, "utf-8");
}

const chatWithAssistant = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id; // From verifyToken middleware

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }

    // --- RAG STEP 1: RETRIEVAL ---
    // Fetch the user's actual trips from MySQL so the AI knows about their specific data
    const [trips] = await db.promise().query(
      "SELECT trip_name, destination, budget, start_date FROM trips WHERE user_id = ?",
      [userId]
    );

    let userTripsContext = "User has no saved trips.";
    if (trips.length > 0) {
      userTripsContext = trips.map(t => 
        `- ${t.trip_name} to ${t.destination} (Budget: ₹${t.budget}, Date: ${t.start_date})`
      ).join("\n");
    }

    // --- RAG STEP 2: LANGCHAIN AUGMENTATION ---
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
    });

    const recentHistory = history
      .slice(-8)
      .filter((item) => item && typeof item.text === "string")
      .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text.slice(0, MAX_HISTORY_ITEM_LENGTH)}`)
      .join("\n");

    const promptTemplate = PromptTemplate.fromTemplate(`
You are a concise, practical AI travel assistant for the AI Travel Planner app.

--- KNOWLEDGE BASE (Company Policies) ---
{knowledgeBase}

--- USER'S ACTUAL TRIPS (Database Context) ---
{userTripsContext}

--- INSTRUCTIONS ---
Help the user with itineraries, destinations, budgets, and their specific trips.
If they ask about policies (refunds, baggage, etc), use the KNOWLEDGE BASE.
If they ask about their own trips, use the USER'S ACTUAL TRIPS context.
Do not invent live prices. Use markdown when useful.

Recent conversation:
{recentHistory}

User: {message}
Assistant:`);

    const formattedPrompt = await promptTemplate.format({
      knowledgeBase,
      userTripsContext,
      recentHistory,
      message
    });

    // --- RAG STEP 3: GENERATION ---
    const response = await model.invoke(formattedPrompt);

    return res.json({ reply: response.content });

  } catch (error) {
    console.log("========= LANGCHAIN RAG ERROR =========");
    console.log(error);
    return res.status(500).json({ message: "AI chat is unavailable right now." });
  }
};

module.exports = {
  generateTripPlan,
  chatWithAssistant,
};
