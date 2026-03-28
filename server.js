const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const friendRoutes = require("./routes/friends");
const chatRoutes = require("./routes/chat");

// Socket
const initSocket = require("./socket/socketEvents");

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Socket.io
// ─────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
initSocket(io);

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chat", chatRoutes);

// Health Check
app.get("/", (req, res) => {
  res.json({ message: "ChatApp API is running 🚀", status: "OK" });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!", message: err.message });
});

// ─────────────────────────────────────────────
// MongoDB + Server Start
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas connected successfully");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
