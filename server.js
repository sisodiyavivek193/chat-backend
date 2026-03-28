const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
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
// Middleware
// ─────────────────────────────────────────────
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "http://localhost:5173",
//     credentials: true,
//   })
// );

// ─── Sabse pehle yeh add karo ───
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url} | Origin: ${req.headers.origin}`);
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      process.env.FRONTEND_URL,  // ← Railway se aayega
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Socket.io Setup
// ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        process.env.FRONTEND_URL,
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize socket events
initSocket(io);


// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chat", chatRoutes);

// Health check
// Temporary debug route - CORS check karne ke liye
app.get("/debug-cors", (req, res) => {
  res.json({
    FRONTEND_URL: process.env.FRONTEND_URL,
    NODE_ENV: process.env.NODE_ENV,
    message: "CORS Debug Info"
  });
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
// MongoDB Connection + Server Start
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