const express = require("express");
const cors = require("cors");

require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const tripRoutes = require("./routes/tripRoutes");
const aiRoutes = require("./routes/aiRoutes");
const app = express();

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("API Running...");
});

app.use((error, req, res, next) => {
  console.error("Request error:", error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }
  return res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
