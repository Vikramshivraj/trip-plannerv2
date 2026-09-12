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

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

// Attach socket.io to the app so controllers can use it
app.set("io", io);

// Socket.IO logic
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // When a user opens a specific trip, they join a "room" for that trip
  socket.on("join_trip", (tripId) => {
    const room = String(tripId);
    socket.join(room);
    console.log(`User ${socket.id} joined trip room: ${room}`);
  });

  // When someone adds/deletes an expense or edits an itinerary
  socket.on("update_trip", (data) => {
    // Broadcast to everyone else in the trip room
    socket.to(data.tripId).emit("trip_updated", data);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
