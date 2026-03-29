const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getOrCreateConversationRoute,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  deleteMultipleMessages,
  searchMessages,
  clearChat,
  deleteChat,
  reportUser,
} = require("../controllers/chatController");

router.post("/conversation", protect, getOrCreateConversationRoute);
router.get("/conversations", protect, getConversations);
router.get("/messages/:userId", protect, getMessages);
router.get("/search/:userId", protect, searchMessages);       // 🔍 Search
router.post("/send", protect, sendMessage);
router.delete("/message/:messageId", protect, deleteMessage); // Single delete
router.delete("/messages/bulk", protect, deleteMultipleMessages); // Bulk delete
router.delete("/clear/:userId", protect, clearChat);          // 🗑️ Clear chat
router.delete("/delete/:userId", protect, deleteChat);        // ❌ Delete chat
router.post("/report/:userId", protect, reportUser);          // 🚩 Report

module.exports = router;


// const express = require("express");
// const router = express.Router();
// const { protect } = require("../middleware/auth");
// const {
//   getOrCreateConversationRoute,
//   getConversations,
//   getMessages,
//   sendMessage,
//   deleteMessage,
// } = require("../controllers/chatController");

// router.post("/conversation", protect, getOrCreateConversationRoute);
// router.get("/conversations", protect, getConversations);
// router.get("/messages/:userId", protect, getMessages);
// router.post("/send", protect, sendMessage);
// router.delete("/message/:messageId", protect, deleteMessage);

// module.exports = router;
