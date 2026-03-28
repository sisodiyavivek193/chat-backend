const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const FriendRequest = require("../models/FriendRequest");
const BlockedUser = require("../models/BlockedUser");
const User = require("../models/User");

// Get active socket map (for real-time notifications)
const getSocketMap = () => global.socketUserMap || {};

// Helper: Emit notification to a user if online
const emitToUser = (userId, event, data) => {
  const socketMap = getSocketMap();
  const socketId = socketMap[userId.toString()];
  if (socketId && global.io) {
    global.io.to(socketId).emit(event, data);
  }
};

// ─────────────────────────────────────────────
// POST /api/friends/request
// Send friend request
// ─────────────────────────────────────────────
router.post("/request", protect, async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user._id;

    if (toUserId === fromUserId.toString()) {
      return res.status(400).json({ error: "You cannot send request to yourself" });
    }

    // Check if target user exists
    const targetUser = await User.findById(toUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if blocked
    const isBlocked = await BlockedUser.findOne({
      $or: [
        { blockedBy: fromUserId, blockedUser: toUserId },
        { blockedBy: toUserId, blockedUser: fromUserId },
      ],
    });
    if (isBlocked) {
      return res.status(403).json({ error: "Cannot send request to this user" });
    }

    // Check if already friends or request pending
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { fromUser: fromUserId, toUser: toUserId },
        { fromUser: toUserId, toUser: fromUserId },
      ],
    });

    if (existingRequest) {
      if (existingRequest.status === "accepted") {
        return res.status(400).json({ error: "Already friends!" });
      }
      if (existingRequest.status === "pending") {
        return res.status(400).json({ error: "Request already sent!" });
      }
      // If rejected, delete and re-send
      await existingRequest.deleteOne();
    }

    const friendRequest = await FriendRequest.create({
      fromUser: fromUserId,
      toUser: toUserId,
    });

    // Real-time notification to target user
    emitToUser(toUserId, "friendRequestReceived", {
      requestId: friendRequest._id,
      fromUser: {
        _id: req.user._id,
        fullName: req.user.fullName,
        username: req.user.username,
        profilePicture: req.user.profilePicture,
      },
    });

    res.status(201).json({ success: true, message: "Friend request sent!", requestId: friendRequest._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT /api/friends/accept/:requestId
// Accept friend request
// ─────────────────────────────────────────────
router.put("/accept/:requestId", protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId).populate("fromUser", "fullName username profilePicture");

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    request.status = "accepted";
    await request.save();

    // Notify sender (User A) - request accepted
    emitToUser(request.fromUser._id, "friendRequestAccepted", {
      message: `${req.user.fullName} accepted your friend request!`,
      user: {
        _id: req.user._id,
        fullName: req.user.fullName,
        username: req.user.username,
        profilePicture: req.user.profilePicture,
      },
    });

    res.json({ success: true, message: "Friend request accepted!", friend: request.fromUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT /api/friends/reject/:requestId
// Reject friend request
// ─────────────────────────────────────────────
router.put("/reject/:requestId", protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId).populate("fromUser", "fullName username");

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Notify sender (User A) - request rejected
    emitToUser(request.fromUser._id, "friendRequestRejected", {
      message: `${req.user.username} rejected your friend request`,
      userId: req.user._id,
    });

    await request.deleteOne();

    res.json({ success: true, message: "Friend request rejected" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/friends/cancel/:requestId
// Cancel sent request (by sender)
// ─────────────────────────────────────────────
router.delete("/cancel/:requestId", protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.fromUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await request.deleteOne();
    res.json({ success: true, message: "Request cancelled" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/friends/pending
// Get all pending incoming requests (for User B)
// ─────────────────────────────────────────────
router.get("/pending", protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      toUser: req.user._id,
      status: "pending",
    }).populate("fromUser", "fullName username profilePicture bio");

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/friends/list
// Get all accepted friends
// ─────────────────────────────────────────────
router.get("/list", protect, async (req, res) => {
  try {
    const friendships = await FriendRequest.find({
      $or: [{ fromUser: req.user._id }, { toUser: req.user._id }],
      status: "accepted",
    })
      .populate("fromUser", "fullName username profilePicture isOnline lastSeen")
      .populate("toUser", "fullName username profilePicture isOnline lastSeen");

    const friends = friendships.map((f) => {
      return f.fromUser._id.toString() === req.user._id.toString() ? f.toUser : f.fromUser;
    });

    res.json({ success: true, friends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
