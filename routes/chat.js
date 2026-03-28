const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const FriendRequest = require("../models/FriendRequest");
const BlockedUser = require("../models/BlockedUser");

// Helper: Get or create conversation between 2 users
const getOrCreateConversation = async (userId1, userId2) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [userId1, userId2], $size: 2 },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userId1, userId2],
    });
  }

  return conversation;
};

// ─────────────────────────────────────────────
// GET /api/chat/conversations
// Get all conversations (chat list) for current user
// ─────────────────────────────────────────────
router.get("/conversations", protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "fullName username profilePicture isOnline lastSeen")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    // Format: remove self from participants
    const formatted = conversations.map((conv) => {
      const otherUser = conv.participants.find(
        (p) => p._id.toString() !== req.user._id.toString()
      );
      return {
        _id: conv._id,
        otherUser,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
      };
    });

    res.json({ success: true, conversations: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/chat/messages/:userId
// Get messages with a specific user
// ─────────────────────────────────────────────
router.get("/messages/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check friendship
    const friendship = await FriendRequest.findOne({
      $or: [
        { fromUser: req.user._id, toUser: userId },
        { fromUser: userId, toUser: req.user._id },
      ],
      status: "accepted",
    });

    if (!friendship) {
      return res.status(403).json({ error: "You must be friends to view messages" });
    }

    // Check block
    const isBlocked = await BlockedUser.findOne({
      $or: [
        { blockedBy: req.user._id, blockedUser: userId },
        { blockedBy: userId, blockedUser: req.user._id },
      ],
    });
    if (isBlocked) {
      return res.status(403).json({ error: "Cannot view messages with this user" });
    }

    const conversation = await getOrCreateConversation(req.user._id, userId);

    const messages = await Message.find({
      conversationId: conversation._id,
      isDeleted: false,
    })
      .populate("sender", "fullName username profilePicture")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId: conversation._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({
      success: true,
      messages: messages.reverse(), // oldest first
      conversationId: conversation._id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/chat/send
// Send a message
// Note: encryptedContent is already encrypted on client side (E2E)
// ─────────────────────────────────────────────
router.post("/send", protect, async (req, res) => {
  try {
    const { toUserId, encryptedContent } = req.body;

    if (!toUserId || !encryptedContent) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }

    // Check friendship
    const friendship = await FriendRequest.findOne({
      $or: [
        { fromUser: req.user._id, toUser: toUserId },
        { fromUser: toUserId, toUser: req.user._id },
      ],
      status: "accepted",
    });

    if (!friendship) {
      return res.status(403).json({ error: "You must be friends to send messages" });
    }

    // Check block
    const isBlocked = await BlockedUser.findOne({
      $or: [
        { blockedBy: req.user._id, blockedUser: toUserId },
        { blockedBy: toUserId, blockedUser: req.user._id },
      ],
    });
    if (isBlocked) {
      return res.status(403).json({ error: "Cannot send message to this user" });
    }

    const conversation = await getOrCreateConversation(req.user._id, toUserId);

    const message = await Message.create({
      conversationId: conversation._id,
      sender: req.user._id,
      encryptedContent,
      readBy: [req.user._id],
    });

    // Update conversation lastMessage
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "fullName username profilePicture"
    );

    // Real-time: emit to receiver
    const socketMap = global.socketUserMap || {};
    const receiverSocketId = socketMap[toUserId];
    if (receiverSocketId && global.io) {
      global.io.to(receiverSocketId).emit("newMessage", {
        message: populatedMessage,
        conversationId: conversation._id,
      });
    }

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/chat/message/:messageId
// Delete a message (soft delete)
// ─────────────────────────────────────────────
router.delete("/message/:messageId", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) return res.status(404).json({ error: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    message.isDeleted = true;
    message.encryptedContent = "This message was deleted";
    message.deletedAt = new Date();
    await message.save();

    // Notify other user via socket
    const conversation = await Conversation.findById(message.conversationId);
    const otherUserId = conversation.participants.find(
      (p) => p.toString() !== req.user._id.toString()
    );

    const socketMap = global.socketUserMap || {};
    const receiverSocketId = socketMap[otherUserId?.toString()];
    if (receiverSocketId && global.io) {
      global.io.to(receiverSocketId).emit("messageDeleted", {
        messageId: message._id,
        conversationId: message.conversationId,
      });
    }

    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
