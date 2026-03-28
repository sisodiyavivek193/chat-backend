const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  searchUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUserProfile,
} = require("../controllers/userController");

router.get("/search", protect, searchUsers);
router.post("/block/:userId", protect, blockUser);
router.delete("/unblock/:userId", protect, unblockUser);
router.get("/blocked", protect, getBlockedUsers);
router.get("/:userId", protect, getUserProfile);

module.exports = router;
