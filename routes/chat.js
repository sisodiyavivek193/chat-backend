const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getOrCreateConversationRoute,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
} = require("../controllers/chatController");

router.post("/conversation", protect, getOrCreateConversationRoute);
router.get("/conversations", protect, getConversations);
router.get("/messages/:userId", protect, getMessages);
router.post("/send", protect, sendMessage);
router.delete("/message/:messageId", protect, deleteMessage);

module.exports = router;
