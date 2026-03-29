const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const FriendRequest = require("../models/FriendRequest");
const BlockedUser = require("../models/BlockedUser");

// Helper: Get or Create Conversation
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
// POST /api/chat/conversation
// ─────────────────────────────────────────────
const getOrCreateConversationRoute = async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId) {
      return res.status(400).json({ error: "toUserId is required" });
    }

    const friendship = await FriendRequest.findOne({
      $or: [
        { fromUser: req.user._id, toUser: toUserId },
        { fromUser: toUserId, toUser: req.user._id },
      ],
      status: "accepted",
    });
    if (!friendship) {
      return res.status(403).json({ error: "You must be friends to start a chat" });
    }

    const conversation = await getOrCreateConversation(req.user._id, toUserId);
    const populated = await Conversation.findById(conversation._id).populate(
      "participants",
      "fullName username profilePicture isOnline lastSeen"
    );

    const otherUser = populated.participants.find(
      (p) => p._id.toString() !== req.user._id.toString()
    );

    res.json({
      success: true,
      conversation: {
        _id: populated._id,
        otherUser,
        lastMessage: populated.lastMessage,
        lastMessageAt: populated.lastMessageAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/chat/conversations
// ─────────────────────────────────────────────
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "fullName username profilePicture isOnline lastSeen")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

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
};

// ─────────────────────────────────────────────
// GET /api/chat/messages/:userId
// ─────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

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
      messages: messages.reverse(),
      conversationId: conversation._id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/chat/send
// ─────────────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { toUserId, encryptedContent } = req.body;

    if (!toUserId || !encryptedContent) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }

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

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "fullName username profilePicture"
    );

    if (global.io) {
      // ✅ Room-based emit — socket.join(userId) pe depend karta hai
      // socketMap pe depend nahi — server restart safe hai
      global.io.to(toUserId.toString()).emit("newMessage", {
        message: populatedMessage,
        conversationId: conversation._id,
      });

      // ✅ Sender ko bhi emit karo (agar alag device/tab pe ho)
      const senderId = req.user._id.toString();
      if (senderId !== toUserId.toString()) {
        global.io.to(senderId).emit("newMessage", {
          message: populatedMessage,
          conversationId: conversation._id,
        });
      }
    }

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/chat/message/:messageId
// ─────────────────────────────────────────────
const deleteMessage = async (req, res) => {
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
};

module.exports = {
  getOrCreateConversationRoute,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
};