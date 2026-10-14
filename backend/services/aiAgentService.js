const { DynamicTool, DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require("zod");
const db = require("../config/db");
const { retrieveTravelKnowledge } = require("./ragService");

const VALID_CATEGORIES = new Set(["Hotel", "Food", "Transport", "Shopping", "Other"]);
const MAX_EXPENSE_AMOUNT = 10000000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const parseExpenseDate = (value) => {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
};

const asDateString = (value) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);

const validateExpenseInput = ({ tripId, category, amount, expenseDate }) => {
  if (!Number.isInteger(tripId) || tripId <= 0) return "Trip ID must be a positive integer.";
  if (!VALID_CATEGORIES.has(category)) return "Category must be Hotel, Food, Transport, Shopping, or Other.";
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_EXPENSE_AMOUNT) {
    return "Amount must be a positive number within the supported limit.";
  }
  if (!parseExpenseDate(expenseDate)) return "Expense date must be a real date in YYYY-MM-DD format.";
  return null;
};

const getTripAndValidateDate = async (userId, tripId, expenseDate) => {
  const [trips] = await db.promise().query(
    "SELECT start_date, end_date FROM trips WHERE id = ? AND user_id = ?",
    [tripId, userId]
  );
  if (!trips.length) return { error: "Trip not found or unauthorized." };

  const startDate = asDateString(trips[0].start_date);
  const endDate = asDateString(trips[0].end_date);
  if (expenseDate < startDate || expenseDate > endDate) {
    return { error: "Expense date must be within the trip dates." };
  }
  return { startDate, endDate };
};

const createTripLookupTool = (userId) => new DynamicTool({
  name: "lookup_user_trips",
  description: "List the current authenticated user's saved trips, budgets, destinations, and dates. No input needed.",
  func: async () => {
    try {
      const [trips] = await db.promise().query(
        "SELECT id, trip_name, destination, budget, start_date, end_date FROM trips WHERE user_id = ?",
        [userId]
      );
      if (!trips.length) return "User has no saved trips.";
      return trips.map((trip) =>
        `- ID: ${trip.id} | Name: ${trip.trip_name} | Destination: ${trip.destination} | Budget: ₹${trip.budget} | Dates: ${asDateString(trip.start_date)} to ${asDateString(trip.end_date)}`
      ).join("\n");
    } catch (error) {
      console.error("[AI TOOL] Trip lookup failed:", error.message);
      return "Could not fetch the user's trips.";
    }
  },
});

const getTripDetailsTool = (userId) => new DynamicStructuredTool({
  name: "get_trip_details",
  description: "Get one of the current user's trips, its recorded expenses, total spent, and remaining budget.",
  schema: z.object({
    tripId: z.number().int().describe("The numeric ID of the trip"),
  }),
  func: async ({ tripId }) => {
    if (!Number.isInteger(tripId) || tripId <= 0) return "Trip ID must be a positive integer.";
    try {
      const [trips] = await db.promise().query(
        "SELECT id, trip_name, destination, budget, start_date, end_date FROM trips WHERE id = ? AND user_id = ?",
        [tripId, userId]
      );
      if (!trips.length) return "Trip not found or unauthorized.";
      const trip = trips[0];
      const [expenses] = await db.promise().query(
        "SELECT id, category, amount, expense_date FROM expenses WHERE trip_id = ? ORDER BY expense_date DESC, id DESC LIMIT 5",
        [tripId]
      );
      const [totals] = await db.promise().query(
        "SELECT COALESCE(SUM(amount), 0) AS totalSpent, COUNT(*) AS expensesCount FROM expenses WHERE trip_id = ?",
        [tripId]
      );
      const totalSpent = Number(totals[0].totalSpent);
      return JSON.stringify({
        tripName: trip.trip_name,
        destination: trip.destination,
        budget: Number(trip.budget),
        startDate: asDateString(trip.start_date),
        endDate: asDateString(trip.end_date),
        totalSpent,
        remainingBudget: Number(trip.budget) - totalSpent,
        expensesCount: Number(totals[0].expensesCount),
        recentExpenses: expenses.map((expense) => ({
          ...expense,
          amount: Number(expense.amount),
          expense_date: asDateString(expense.expense_date),
        })),
      });
    } catch (error) {
      console.error("[AI TOOL] Trip details failed:", error.message);
      return "Could not retrieve trip details.";
    }
  },
});

const addExpenseTool = (userId, onExpenseDraft) => new DynamicStructuredTool({
  name: "prepare_expense",
  description: "Prepare (never save) an expense draft for the current user's trip. The user must confirm the draft in the app before it is saved. Use only when the user clearly asks to add or record an expense.",
  schema: z.object({
    tripId: z.number().int().describe("The numeric ID of the trip"),
    category: z.string().describe("One of: Hotel, Food, Transport, Shopping, Other"),
    amount: z.number().describe("Expense amount in INR"),
    expenseDate: z.string().describe("Expense date in YYYY-MM-DD format"),
  }),
  func: async (draft) => {
    const validationError = validateExpenseInput(draft);
    if (validationError) return `Expense draft rejected: ${validationError}`;
    try {
      const trip = await getTripAndValidateDate(userId, draft.tripId, draft.expenseDate);
      if (trip.error) return `Expense draft rejected: ${trip.error}`;
      const safeDraft = {
        tripId: draft.tripId,
        category: draft.category,
        amount: draft.amount,
        expenseDate: draft.expenseDate,
      };
      if (onExpenseDraft) onExpenseDraft(safeDraft);
      return `Expense draft prepared for trip ${draft.tripId}: ₹${draft.amount}, ${draft.category}, ${draft.expenseDate}. It has NOT been saved. The user must confirm it in the interface.`;
    } catch (error) {
      console.error("[AI TOOL] Expense draft validation failed:", error.message);
      return "Could not prepare the expense draft.";
    }
  },
});

const retrieveTravelKnowledgeTool = new DynamicTool({
  name: "retrieve_travel_knowledge",
  description: "Search the indexed travel policies and knowledge documents. Use for company policies and questions that require the supplied travel knowledge. Cite the returned source filename.",
  func: async (query) => retrieveTravelKnowledge(query),
});

const weatherTool = new DynamicTool({
  name: "get_live_weather",
  description: "Get current weather and a short forecast for a city. Input is a city name, such as Goa or Paris.",
  func: async (city) => {
    if (typeof city !== "string" || !city.trim() || city.trim().length > 100) {
      return "Please provide a city name of 1 to 100 characters.";
    }
    try {
      const response = await fetch(`https://wttr.in/${encodeURIComponent(city.trim())}?format=j1`, {
        headers: { "user-agent": "TripPlannerAssistant/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return `Weather service returned status ${response.status}; try again later.`;
      const data = await response.json();
      const current = data?.current_condition?.[0];
      const forecastDays = Array.isArray(data?.weather) ? data.weather.slice(0, 3) : [];
      if (!current || forecastDays.length === 0) return "Weather service returned an unexpected response.";

      const forecast = forecastDays.map((day) => {
        const description = day.hourly?.[4]?.weatherDesc?.[0]?.value || "conditions unavailable";
        return `${day.date}: ${day.mintempC}°C to ${day.maxtempC}°C, ${description}`;
      }).join("\n");
      return `Weather in ${city.trim()}:\nCurrent: ${current.temp_C}°C, ${current.weatherDesc?.[0]?.value || "conditions unavailable"}, humidity ${current.humidity}%, wind ${current.windspeedKmph} km/h\n\nForecast:\n${forecast}`;
    } catch (error) {
      console.error("[AI TOOL] Weather lookup failed:", error.message);
      return "Could not retrieve weather right now. Check the destination or try again later.";
    }
  },
});

const confirmExpenseForUser = async (userId, draft, io) => {
  const validationError = validateExpenseInput(draft || {});
  if (validationError) return { error: validationError };
  try {
    const trip = await getTripAndValidateDate(userId, draft.tripId, draft.expenseDate);
    if (trip.error) return { error: trip.error };
    await db.promise().query(
      "INSERT INTO expenses (trip_id, category, amount, expense_date) VALUES (?, ?, ?, ?)",
      [draft.tripId, draft.category, draft.amount, draft.expenseDate]
    );
    if (io) io.to(String(draft.tripId)).emit("trip_updated", { tripId: String(draft.tripId) });
    return { message: `Expense saved: ₹${draft.amount} for ${draft.category} on ${draft.expenseDate}.` };
  } catch (error) {
    console.error("[AI TOOL] Expense save failed:", error.message);
    return { error: "Could not save the expense. Please try again." };
  }
};

const getAgentTools = (userId, onExpenseDraft) => [
  createTripLookupTool(userId),
  getTripDetailsTool(userId),
  addExpenseTool(userId, onExpenseDraft),
  retrieveTravelKnowledgeTool,
  weatherTool,
];

module.exports = { getAgentTools, confirmExpenseForUser };

