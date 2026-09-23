const express = require("express");
const cors = require("cors");

require("dotenv").config();

const db = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const tripRoutes = require("./routes/tripRoutes");
const aiRoutes = require("./routes/aiRoutes");
const { initRAG } = require("./services/ragService");
const helmet = require("helmet");
const promClient = require("prom-client");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const app = express();

app.use(helmet());

// Setup Swagger
const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Setup Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 200, 300, 400, 500, 1000]
});
register.registerMetric(httpRequestDurationMicroseconds);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', async (req, res) => {
  try {
    const [rows] = await require('./config/db').promise().query('SELECT 1');
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Initialize RAG System
initRAG();

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
