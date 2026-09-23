const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanName) return res.status(400).json({ message: "Name is required" });
    if (cleanName.length < 2 || cleanName.length > 50) return res.status(400).json({ message: "Name must be between 2 and 50 characters" });
    if (!cleanEmail) return res.status(400).json({ message: "Email is required" });
    if (!EMAIL_REGEX.test(cleanEmail)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (typeof password !== "string" || !password) return res.status(400).json({ message: "Password is required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters long" });

    db.query("SELECT * FROM users WHERE email = ?", [cleanEmail], async (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (result.length > 0) return res.status(400).json({ message: "User already exists" });

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query("INSERT INTO users(name,email,password) VALUES(?,?,?)", [cleanName, cleanEmail, hashedPassword], (err) => {
          if (err) return res.status(500).json({ message: "Database error" });
          return res.status(201).json({ message: "User Registered Successfully" });
        });
      } catch (error) {
        return res.status(500).json({ message: "Registration failed" });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
};

const loginUser = (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail) return res.status(400).json({ message: "Email is required" });
    if (!EMAIL_REGEX.test(cleanEmail)) return res.status(400).json({ message: "Please enter a valid email address" });
    if (typeof password !== "string" || !password) return res.status(400).json({ message: "Password is required" });

    db.query("SELECT * FROM users WHERE email = ?", [cleanEmail], async (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (result.length === 0) return res.status(401).json({ message: "Invalid email or password" });

      try {
        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });
        if (!process.env.JWT_SECRET) return res.status(500).json({ message: "Server configuration error" });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return res.status(200).json({ message: "Login Successful", token });
      } catch (error) {
        return res.status(500).json({ message: "Login failed" });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
};

const getUserPreferences = async (req, res) => {
  try {
    const [prefs] = await db.promise().query("SELECT * FROM preferences WHERE user_id = ?", [req.user.id]);
    if (prefs.length === 0) return res.json({});
    res.json(prefs[0]);
  } catch (error) {
    res.status(500).json({ message: "Error fetching preferences" });
  }
};

const updateUserPreferences = async (req, res) => {
  const { travel_style, preferred_activities, food_preference, budget_preference } = req.body;
  try {
    const [existing] = await db.promise().query("SELECT * FROM preferences WHERE user_id = ?", [req.user.id]);
    if (existing.length === 0) {
      await db.promise().query(
        "INSERT INTO preferences (user_id, travel_style, preferred_activities, food_preference, budget_preference) VALUES (?, ?, ?, ?, ?)",
        [req.user.id, travel_style, preferred_activities, food_preference, budget_preference]
      );
    } else {
      await db.promise().query(
        "UPDATE preferences SET travel_style=?, preferred_activities=?, food_preference=?, budget_preference=? WHERE user_id=?",
        [travel_style, preferred_activities, food_preference, budget_preference, req.user.id]
      );
    }
    res.json({ message: "Preferences updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating preferences" });
  }
};

module.exports = { registerUser, loginUser, getUserPreferences, updateUserPreferences };
