const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getPendingRequests,
  getFriendsList,
} = require("../controllers/friendController");

router.post("/request", protect, sendFriendRequest);
router.put("/accept/:requestId", protect, acceptFriendRequest);
router.put("/reject/:requestId", protect, rejectFriendRequest);
router.delete("/cancel/:requestId", protect, cancelFriendRequest);
router.get("/pending", protect, getPendingRequests);
router.get("/list", protect, getFriendsList);

module.exports = router;
