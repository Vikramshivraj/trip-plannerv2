const db = require("../config/db");

const DESTINATION_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s,.'-]{1,59}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BUDGET = 100000000;
const EXPENSE_CATEGORIES = new Set(["Hotel", "Food", "Transport", "Shopping", "Other"]);
const UNSUPPORTED_DESTINATIONS = new Set([
  "mars", "moon", "jupiter", "saturn", "venus", "mercury", "uranus", "neptune", "pluto",
]);

const sendDatabaseError = (res, error) => {
  console.error("Database error:", error);
  return res.status(500).json({ message: "Database error" });
};

const parseDate = (value) => {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
};

const formatDatabaseDate = (value) => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

const normalizeTrip = ({ trip_name, destination, budget }) => ({
  tripName: typeof trip_name === "string" ? trip_name.trim() : "",
  destination: typeof destination === "string" ? destination.trim() : "",
  budget: Number(budget),
});

const validateTripFields = ({ tripName, destination, budget }) => {
  if (tripName.length < 2 || tripName.length > 80) return "Trip name must be between 2 and 80 characters.";
  if (!DESTINATION_REGEX.test(destination)) return "Enter a valid destination using letters (for example: Goa or New Delhi).";
  if (UNSUPPORTED_DESTINATIONS.has(destination.toLowerCase())) return "Please enter a real-world destination on Earth.";
  if (!Number.isFinite(budget) || budget <= 0 || budget > MAX_BUDGET) {
    return "Budget must be greater than 0 and within a reasonable range.";
  }
  return null;
};

const validateTrip = (input) => {
  const trip = normalizeTrip(input);
  const fieldError = validateTripFields(trip);
  if (fieldError) return { error: fieldError };
  const start = parseDate(input.start_date);
  const end = parseDate(input.end_date);
  if (!start || !end) return { error: "Enter valid start and end dates." };
  if (end < start) return { error: "End date cannot be before start date." };
  if (((end - start) / 86400000) + 1 > 30) return { error: "Trip duration must be 30 days or less." };
  return { trip: { ...trip, startDate: input.start_date, endDate: input.end_date } };
};

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const createTrip = (req, res) => {
  const validation = validateTrip(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  const { tripName, destination, startDate, endDate, budget } = validation.trip;
  const query = `INSERT INTO trips
    (user_id, trip_name, destination, start_date, end_date, budget)
    VALUES (?, ?, ?, ?, ?, ?)`;
  db.query(query, [req.user.id, tripName, destination, startDate, endDate, budget], (err) => {
    if (err) return sendDatabaseError(res, err);
    return res.status(201).json({ message: "Trip Created Successfully" });
  });
};

const getTrips = (req, res) => {
  db.query("SELECT * FROM trips WHERE user_id = ? ORDER BY start_date ASC", [req.user.id], (err, trips) => {
    if (err) return sendDatabaseError(res, err);
    return res.status(200).json(trips);
  });
};

const addExpense = (req, res) => {
  const tripId = parseId(req.body.trip_id);
  const amount = Number(req.body.amount);
  const expenseDate = parseDate(req.body.expense_date);
  const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
  if (!tripId) return res.status(400).json({ message: "Select a valid trip." });
  if (!EXPENSE_CATEGORIES.has(category)) return res.status(400).json({ message: "Select a valid expense category." });
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BUDGET) {
    return res.status(400).json({ message: "Expense amount must be greater than 0 and within a reasonable range." });
  }
  if (!expenseDate) return res.status(400).json({ message: "Enter a valid expense date." });

  db.query("SELECT start_date, end_date FROM trips WHERE id = ? AND user_id = ?", [tripId, req.user.id], (err, trips) => {
    if (err) return sendDatabaseError(res, err);
    if (trips.length === 0) return res.status(404).json({ message: "Trip not found." });
    const tripStart = parseDate(formatDatabaseDate(trips[0].start_date));
    const tripEnd = parseDate(formatDatabaseDate(trips[0].end_date));
    if (!tripStart || !tripEnd || expenseDate < tripStart || expenseDate > tripEnd) {
      return res.status(400).json({ message: "Expense date must be within trip dates." });
    }
    db.query(
      "INSERT INTO expenses (trip_id, category, amount, expense_date) VALUES (?, ?, ?, ?)",
      [tripId, category, amount, req.body.expense_date],
      (insertErr) => {
        if (insertErr) return sendDatabaseError(res, insertErr);
        
        // Broadcast to other users in the room
        const io = req.app.get("io");
        if (io) {
          io.to(String(tripId)).emit("trip_updated", { tripId: String(tripId) });
        }
        
        return res.status(201).json({ message: "Expense Added Successfully" });
      }
    );
  });
};

const updateExpense = (req, res) => {
  const expenseId = parseId(req.params.id);
  const amount = Number(req.body.amount);
  const expenseDate = parseDate(req.body.expense_date);
  const category = typeof req.body.category === "string" ? req.body.category.trim() : "";

  if (!expenseId) return res.status(400).json({ message: "Invalid expense id." });
  if (!EXPENSE_CATEGORIES.has(category)) return res.status(400).json({ message: "Select a valid expense category." });
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BUDGET) {
    return res.status(400).json({ message: "Expense amount must be greater than 0 and within a reasonable range." });
  }
  if (!expenseDate) return res.status(400).json({ message: "Enter a valid expense date." });

  const ownershipQuery = `SELECT expenses.trip_id, trips.start_date, trips.end_date FROM expenses
    JOIN trips ON expenses.trip_id = trips.id
    WHERE expenses.id = ? AND trips.user_id = ?`;
  db.query(ownershipQuery, [expenseId, req.user.id], (err, rows) => {
    if (err) return sendDatabaseError(res, err);
    if (rows.length === 0) return res.status(404).json({ message: "Expense not found." });
    const tripStart = parseDate(formatDatabaseDate(rows[0].start_date));
    const tripEnd = parseDate(formatDatabaseDate(rows[0].end_date));
    if (!tripStart || !tripEnd || expenseDate < tripStart || expenseDate > tripEnd) {
      return res.status(400).json({ message: "Expense date must be within trip dates." });
    }
    db.query(
      "UPDATE expenses SET category = ?, amount = ?, expense_date = ? WHERE id = ?",
      [category, amount, req.body.expense_date, expenseId],
      (updateErr) => {
        if (updateErr) return sendDatabaseError(res, updateErr);

        // Fetch the trip ID for broadcasting (or we could have queried it above)
        // Since we joined expenses and trips above, we can extract the trip_id from the first row.
        const io = req.app.get("io");
        if (io && rows.length > 0) {
          const tripId = rows[0].trip_id; // Wait, did I select trip_id?
          if (tripId) {
             io.to(String(tripId)).emit("trip_updated", { tripId: String(tripId) });
          }
        }
        
        return res.status(200).json({ message: "Expense Updated Successfully" });
      }
    );
  });
};

const getTotalExpenses = (req, res) => {
  const query = `SELECT IFNULL(SUM(expenses.amount), 0) AS totalExpenses
    FROM expenses JOIN trips ON expenses.trip_id = trips.id WHERE trips.user_id = ?`;
  db.query(query, [req.user.id], (err, result) => {
    if (err) return sendDatabaseError(res, err);
    return res.status(200).json(result[0]);
  });
};

const getTripAnalytics = (req, res) => {
  const tripId = parseId(req.params.tripId);
  if (!tripId) return res.status(400).json({ message: "Invalid trip id." });
  const query = `SELECT trips.trip_name, trips.budget,
    IFNULL(SUM(expenses.amount), 0) AS total_spent,
    trips.budget - IFNULL(SUM(expenses.amount), 0) AS remaining_budget
    FROM trips LEFT JOIN expenses ON trips.id = expenses.trip_id
    WHERE trips.id = ? AND trips.user_id = ? GROUP BY trips.id`;
  db.query(query, [tripId, req.user.id], (err, result) => {
    if (err) return sendDatabaseError(res, err);
    if (result.length === 0) return res.status(404).json({ message: "Trip not found." });
    return res.status(200).json(result[0]);
  });
};

const deleteTrip = (req, res) => {
  const tripId = parseId(req.params.id);
  if (!tripId) return res.status(400).json({ message: "Invalid trip id." });
  db.beginTransaction((transactionErr) => {
    if (transactionErr) return sendDatabaseError(res, transactionErr);
    db.query("DELETE FROM expenses WHERE trip_id = ? AND EXISTS (SELECT 1 FROM trips WHERE id = ? AND user_id = ?)", [tripId, tripId, req.user.id], (expenseErr) => {
      if (expenseErr) return db.rollback(() => sendDatabaseError(res, expenseErr));
      db.query("DELETE FROM trips WHERE id = ? AND user_id = ?", [tripId, req.user.id], (err, result) => {
        if (err) return db.rollback(() => sendDatabaseError(res, err));
        if (result.affectedRows === 0) return db.rollback(() => res.status(404).json({ message: "Trip not found." }));
        db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => sendDatabaseError(res, commitErr));
          return res.status(200).json({ message: "Trip Deleted Successfully" });
        });
      });
    });
  });
};

const updateTrip = (req, res) => {
  const tripId = parseId(req.params.id);
  if (!tripId) return res.status(400).json({ message: "Invalid trip id." });
  const trip = normalizeTrip(req.body);
  const validationError = validateTripFields(trip);
  if (validationError) return res.status(400).json({ message: validationError });
  const query = `UPDATE trips SET trip_name = ?, destination = ?, budget = ?
    WHERE id = ? AND user_id = ?`;
  db.query(query, [trip.tripName, trip.destination, trip.budget, tripId, req.user.id], (err, result) => {
    if (err) return sendDatabaseError(res, err);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Trip not found." });
    return res.status(200).json({ message: "Trip Updated Successfully" });
  });
};

const getTripExpenses = (req, res) => {
  const tripId = parseId(req.params.id);
  if (!tripId) return res.status(400).json({ message: "Invalid trip id." });
  const query = `SELECT expenses.* FROM expenses JOIN trips ON expenses.trip_id = trips.id
    WHERE expenses.trip_id = ? AND trips.user_id = ? ORDER BY expenses.expense_date ASC`;
  db.query(query, [tripId, req.user.id], (err, expenses) => {
    if (err) return sendDatabaseError(res, err);
    return res.status(200).json(expenses);
  });
};

module.exports = { createTrip, getTrips, addExpense, updateExpense, getTripAnalytics, deleteTrip, updateTrip, getTripExpenses, getTotalExpenses };
