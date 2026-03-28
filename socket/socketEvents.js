const jwt = require("jsonwebtoken");
const User = require("../models/User");

// userId → socketId map (in-memory, production me Redis use karo)
const socketUserMap = {};

const initSocket = (io) => {
  // Store io globally for routes to use
  global.io = io;
  global.socketUserMap = socketUserMap;

  // JWT Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication error: No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (!user) return next(new Error("Authentication error: User not found"));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`✅ User connected: ${socket.user.username} (${socket.id})`);

    // Store socket ID
    socketUserMap[userId] = socket.id;

    // Mark user as online in DB
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Broadcast online status to friends (optional)
    socket.broadcast.emit("userOnline", { userId });

    // ─────────────────────────────────────────────
    // User joins their personal room
    socket.join(userId);
    // ─────────────────────────────────────────────

    // ─────────────────────────────────────────────
    // Typing indicator
    // ─────────────────────────────────────────────
    socket.on("typing", ({ toUserId }) => {
      const receiverSocketId = socketUserMap[toUserId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userTyping", {
          fromUserId: userId,
          fromUsername: socket.user.username,
        });
      }
    });

    socket.on("stopTyping", ({ toUserId }) => {
      const receiverSocketId = socketUserMap[toUserId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("userStoppedTyping", { fromUserId: userId });
      }
    });

    // ─────────────────────────────────────────────
    // Disconnect
    // ─────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${socket.user.username}`);
      delete socketUserMap[userId];

      // Mark offline
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      socket.broadcast.emit("userOffline", { userId });
    });
  });
};

module.exports = initSocket;
