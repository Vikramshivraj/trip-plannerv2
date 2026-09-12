const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
    const {
      destination,
      budget,
      days,
      travelType,
    } = req.body;

    const validationError = validateAITripInput({ destination, budget, days, travelType });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const model = genAI.getGenerativeModel({
       model: "models/gemini-3.5-flash",
    });

    const prompt = `
You are an expert travel planner.

Create a professional travel itinerary.

Destination : ${destination}
Budget : ₹${budget}
Duration : ${days} days
Travel Type : ${travelType}

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
[{"name": "Eiffel Tower", "lat": 48.8584, "lng": 2.2945}, {"name": "Louvre Museum", "lat": 48.8606, "lng": 2.3376}]
\`\`\`
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({
      plan: response,
    });

  }  catch (error) {
    console.log("========= GEMINI ERROR =========");
    console.log(error.message);
    if (error.response) console.log(error.response.data);
    res.status(500).json({ message: "Unable to generate a trip plan right now." });
  }
};

// --- CUSTOM CHATBOT LOGIC ---
// Simulates a custom Knowledge Base (RAG/Rule-based hybrid)
const localKnowledgeBase = [
  { 
    keywords: ["refund", "cancel", "cancellation"], 
    response: "🤖 **Custom Policy:** You can cancel your trip up to 24 hours before the start date for a full refund. Please contact support@ai-planner.com for help." 
  },
  { 
    keywords: ["payment", "methods", "credit card", "upi"], 
    response: "🤖 **Custom Policy:** We accept Visa, Mastercard, and UPI. All payments are secured via SSL." 
  },
  { 
    keywords: ["company", "about us", "who are you"], 
    response: "🤖 **Custom Info:** We are AI Travel Planner, a modern platform designed to make your travel seamless and budget-friendly using AI!" 
  }
];

const chatWithAssistant = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }
    
    const userMsgLower = message.toLowerCase();
    
    // 1. Check Custom Knowledge Base (Rule-Based Fallback)
    const matchedRule = localKnowledgeBase.find(kb => 
      kb.keywords.some(kw => userMsgLower.includes(kw))
    );

    if (matchedRule) {
      // Return instant local response without calling Gemini API
      return res.json({ reply: matchedRule.response });
    }

    // 2. Fallback to Gemini (LLM Mode)
    if (!Array.isArray(history)) {
      return res.status(400).json({ message: "Conversation history must be an array." });
    }

    const model = genAI.getGenerativeModel({ model: "models/gemini-3.5-flash" });
    const recentHistory = history
      .slice(-8)
      .filter((item) => item && typeof item.text === "string" && ["user", "assistant"].includes(item.role))
      .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text.slice(0, MAX_HISTORY_ITEM_LENGTH)}`)
      .join("\n");

    const prompt = `You are a concise, practical AI travel assistant inside a Travel & Expense Planner app.
Help with itineraries, destinations, transport, hotels, food, packing, budgets and travel planning.
Use markdown when useful. Keep answers actionable. Do not invent live prices, availability, weather, or opening hours; tell the user when current information should be checked.

Recent conversation:\n${recentHistory}\n\nUser: ${message}\nAssistant:`;

    const result = await model.generateContent(prompt);
    return res.json({ reply: result.response.text() });
  } catch (error) {
    console.log("========= GEMINI CHAT ERROR =========");
    console.log(error.message);
    return res.status(500).json({ message: "AI chat is unavailable right now." });
  }
};

module.exports = {
  generateTripPlan,
  chatWithAssistant,
};
