const { DynamicTool, DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const db = require("../config/db");
const { retrieveTravelKnowledge } = require("./ragService");

// Basic tool to lookup all user trips
const createTripLookupTool = (userId) => new DynamicTool({
  name: "lookup_user_trips",
  description: "Look up the current user's saved trips, budgets, destinations, and dates from the database. No input needed.",
  func: async () => {
    try {
      const [trips] = await db.promise().query(
        "SELECT id, trip_name, destination, budget, start_date, end_date FROM trips WHERE user_id = ?",
        [userId]
      );
      if (trips.length === 0) return "User has no saved trips.";
      
      let result = "User's trips:\n";
      for (const t of trips) {
        result += `- ID: ${t.id} | Name: ${t.trip_name} | Dest: ${t.destination} | Budget: ₹${t.budget} | Dates: ${String(t.start_date).slice(0, 10)} to ${String(t.end_date).slice(0, 10)}\n`;
      }
      return result;
    } catch (e) {
      return "Could not fetch user trips from database.";
    }
  },
});

// Tool to get specific trip details including expenses and remaining budget
const getTripDetailsTool = (userId) => new DynamicStructuredTool({
  name: "get_trip_details",
  description: "Get detailed information for a specific trip, including expenses, total spent, and remaining budget.",
  schema: z.object({
    // Use integer (not number with constraints) — Gemini handles integer cleanly
    tripId: z.number().int().describe("The numeric ID of the trip to look up"),
  }),
  func: async ({ tripId }) => {
    try {
      const [trips] = await db.promise().query(
        "SELECT * FROM trips WHERE id = ? AND user_id = ?",
        [tripId, userId]
      );
      if (trips.length === 0) return "Trip not found or unauthorized.";

      const trip = trips[0];
      const [expenses] = await db.promise().query(
        "SELECT id, category, amount, expense_date FROM expenses WHERE trip_id = ?",
        [tripId]
      );

      const totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const remaining = Number(trip.budget) - totalSpent;

      return JSON.stringify({
        tripName: trip.trip_name,
        destination: trip.destination,
        budget: trip.budget,
        totalSpent,
        remainingBudget: remaining,
        expensesCount: expenses.length,
        recentExpenses: expenses.slice(-5)
      });
    } catch (e) {
      return "Error retrieving trip details.";
    }
  }
});

// Tool to add an expense
// IMPORTANT: Gemini does NOT support exclusiveMinimum (from z.number().positive() / z.number().gt(0))
// and may not support z.enum() cleanly. Use plain z.string/z.number with .describe() only.
// Validation is done inside func instead.
const VALID_CATEGORIES = new Set(["Hotel", "Food", "Transport", "Shopping", "Other"]);

const addExpenseTool = (userId, io) => new DynamicStructuredTool({
  name: "add_expense",
  description: "Add a new expense to a specific trip. Category must be one of: Hotel, Food, Transport, Shopping, Other.",
  schema: z.object({
    tripId: z.number().int().describe("The numeric ID of the trip to add the expense to"),
    category: z.string().describe("Category of the expense. Must be one of: Hotel, Food, Transport, Shopping, Other"),
    amount: z.number().describe("Amount of the expense as a positive number"),
    expenseDate: z.string().describe("Date of the expense in YYYY-MM-DD format"),
  }),
  func: async ({ tripId, category, amount, expenseDate }) => {
    // Validate inside the function to avoid Gemini-incompatible schema constraints
    if (!VALID_CATEGORIES.has(category)) {
      return `Failed: Invalid category "${category}". Must be one of: Hotel, Food, Transport, Shopping, Other.`;
    }
    if (typeof amount !== "number" || amount <= 0) {
      return "Failed: Amount must be a positive number.";
    }

    try {
      const [trips] = await db.promise().query(
        "SELECT start_date, end_date FROM trips WHERE id = ? AND user_id = ?",
        [tripId, userId]
      );
      if (trips.length === 0) return "Failed: Trip not found or unauthorized.";
      
      const tripStart = new Date(trips[0].start_date);
      const tripEnd = new Date(trips[0].end_date);
      const expDate = new Date(expenseDate);

      if (expDate < tripStart || expDate > tripEnd) {
        return "Failed: Expense date must be within trip dates.";
      }

      await db.promise().query(
        "INSERT INTO expenses (trip_id, category, amount, expense_date) VALUES (?, ?, ?, ?)",
        [tripId, category, amount, expenseDate]
      );
      
      if (io) {
        io.to(String(tripId)).emit("trip_updated", { tripId: String(tripId) });
      }

      return `Successfully added ₹${amount} for ${category} on ${expenseDate}.`;
    } catch (e) {
      return "Failed to add expense due to an error.";
    }
  }
});

const retrieveTravelKnowledgeTool = new DynamicTool({
  name: "retrieve_travel_knowledge",
  description: "Retrieve company policies, refund guidelines, baggage rules, or general travel knowledge from the knowledge base. Use this when users ask about policies or general travel advice.",
  func: async (query) => {
    try {
      const result = await retrieveTravelKnowledge(query);
      return result;
    } catch (e) {
      return "Could not retrieve knowledge.";
    }
  }
});

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

const getAgentTools = (userId, io) => {
  return [
    createTripLookupTool(userId),
    getTripDetailsTool(userId),
    addExpenseTool(userId, io),
    retrieveTravelKnowledgeTool,
    weatherTool
  ];
};

module.exports = {
  getAgentTools
};
