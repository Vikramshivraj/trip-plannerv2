const cacheService = require("../services/cacheService");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const MAX_DESTINATION_LENGTH = 60;
const MAX_BUDGET_LENGTH = 15;
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

const generateTripPlan = async (req, res) => {
  try {
    const { destination, budget, days, travelType } = req.body;

    const validationError = validateAITripInput({ destination, budget, days, travelType });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // --- CACHING STRATEGY ---
    // Generate a unique cache key based on the core trip parameters
    const cacheKey = `trip_plan:${destination.toLowerCase().trim()}:${days}days:${budget}:${travelType}`;
    
    // Check if we have this exact itinerary cached
    const cachedPlan = await cacheService.get(cacheKey);
    if (cachedPlan) {
      console.log(`[CACHE HIT] Serving generated itinerary for: ${cacheKey}`);
      return res.json({ plan: cachedPlan, source: "cache" });
    }
    
    console.log(`[CACHE MISS] Generating new AI itinerary for: ${cacheKey}`);

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
    
    // Save the generated plan to cache for 24 hours (86400 seconds)
    await cacheService.set(cacheKey, result.content, 86400);

    res.json({
      plan: result.content,
      source: "ai"
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

// ==========================================
//  LANGCHAIN AI AGENT WITH LIVE TOOL CALLING
// ==========================================
const { DynamicTool } = require("@langchain/core/tools");
const { HumanMessage, AIMessage, SystemMessage, ToolMessage } = require("@langchain/core/messages");

// --- TOOL 1: Live Weather ---
const weatherTool = new DynamicTool({
  name: "get_live_weather",
  description: "Get the current live weather for any city or destination. Input should be a city name like 'Goa' or 'Paris'.",
  func: async (city) => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const data = await res.json();
      const current = data.current_condition[0];
      const forecast = data.weather.slice(0, 3).map(d => 
        `${d.date}: ${d.mintempC}°C - ${d.maxtempC}°C, ${d.hourly[4].weatherDesc[0].value}`
      ).join("\n");
      return `Weather in ${city}:\nCurrent: ${current.temp_C}°C, ${current.weatherDesc[0].value}, Humidity: ${current.humidity}%, Wind: ${current.windspeedKmph} km/h\n\n3-Day Forecast:\n${forecast}`;
    } catch (e) {
      return `Could not fetch weather for "${city}". Please check the city name.`;
    }
  },
});

// --- TOOL 2: Live Currency Converter ---
const currencyTool = new DynamicTool({
  name: "convert_currency",
  description: "Convert an amount from one currency to another using live exchange rates. Input format: 'AMOUNT FROM_CURRENCY TO_CURRENCY' e.g. '1000 INR USD'",
  func: async (input) => {
    try {
      const parts = input.trim().split(/\s+/);
      const amount = parseFloat(parts[0]);
      const from = (parts[1] || "INR").toUpperCase();
      const to = (parts[2] || "USD").toUpperCase();
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
      const data = await res.json();
      const rate = data.rates[to];
      if (!rate) return `Currency "${to}" not found.`;
      const converted = (amount * rate).toFixed(2);
      return `${amount} ${from} = ${converted} ${to} (Live rate: 1 ${from} = ${rate} ${to})`;
    } catch (e) {
      return "Could not fetch exchange rates. Try again later.";
    }
  },
});

// --- TOOL 3: User's Trip Database Lookup ---
const createTripLookupTool = (userId) => new DynamicTool({
  name: "lookup_user_trips",
  description: "Look up the current user's saved trips, budgets, destinations, and expenses from the database. No input needed.",
  func: async () => {
    try {
      const [trips] = await db.promise().query(
        "SELECT trip_name, destination, budget, start_date, end_date FROM trips WHERE user_id = ?",
        [userId]
      );
      if (trips.length === 0) return "User has no saved trips.";
      
      let result = "User's trips:\n";
      for (const t of trips) {
        const [expenses] = await db.promise().query(
          "SELECT IFNULL(SUM(amount), 0) AS spent FROM expenses WHERE trip_id = (SELECT id FROM trips WHERE trip_name = ? AND user_id = ?)",
          [t.trip_name, userId]
        );
        const spent = expenses[0].spent;
        result += `- ${t.trip_name} to ${t.destination} | Budget: ₹${t.budget} | Spent: ₹${spent} | Remaining: ₹${t.budget - spent} | Dates: ${String(t.start_date).slice(0, 10)} to ${String(t.end_date).slice(0, 10)}\n`;
      }
      return result;
    } catch (e) {
      return "Could not fetch user trips from database.";
    }
  },
});

const chatWithAssistant = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
    }

    // --- AGENT SETUP ---
    const tools = [weatherTool, currencyTool, createTripLookupTool(userId)];
    const toolMap = {};
    tools.forEach(t => { toolMap[t.name] = t; });

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.5-flash",
      maxOutputTokens: 2048,
      apiKey: process.env.GEMINI_API_KEY,
    }).bindTools(tools);

    // Build message history
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
You have access to LIVE tools. Use them proactively:
- Use get_live_weather when users ask about weather, packing, or what to wear for a destination.
- Use convert_currency when users mention budgets in different currencies or ask about exchange rates.
- Use lookup_user_trips when users ask about their own trips, budgets, or expenses.

Knowledge Base (Company Policies):
${knowledgeBase}

Be concise and helpful. Use markdown formatting.`),
      ...chatHistory,
      new HumanMessage(message),
    ];

    // --- AGENTIC TOOL-CALLING LOOP ---
    // The AI decides if it needs to call tools. If so, we execute them and feed results back.
    let response = await model.invoke(messages);
    let iterations = 0;

    while (response.tool_calls && response.tool_calls.length > 0 && iterations < 3) {
      iterations++;
      messages.push(response); // Add the AI's tool-call decision to history

      for (const toolCall of response.tool_calls) {
        const tool = toolMap[toolCall.name];
        if (tool) {
          console.log(`Agent calling tool: ${toolCall.name}("${toolCall.args?.input || ""}")`);
          const toolResult = await tool.invoke(toolCall.args?.input || "");
          messages.push(new ToolMessage({ content: toolResult, tool_call_id: toolCall.id }));
        }
      }

      // Let the AI generate a final answer using the tool results
      response = await model.invoke(messages);
    }

    return res.json({ reply: response.content });

  } catch (error) {
    console.log("========= LANGCHAIN AGENT ERROR =========");
    console.log(error);
    return res.status(500).json({ message: "AI chat is unavailable right now." });
  }
};

module.exports = {
  generateTripPlan,
  chatWithAssistant,
};
