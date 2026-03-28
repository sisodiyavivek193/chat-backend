const User = require("../models/User");
const BlockedUser = require("../models/BlockedUser");
const FriendRequest = require("../models/FriendRequest");

// ─────────────────────────────────────────────
// GET /api/users/search?username=raj
// ─────────────────────────────────────────────
const searchUsers = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.length < 2) {
      return res.status(400).json({ error: "Enter at least 2 characters to search" });
    }

    const myBlocks = await BlockedUser.find({ blockedBy: req.user._id }).select("blockedUser");
    const myBlockedIds = myBlocks.map((b) => b.blockedUser);

    const blockedMe = await BlockedUser.find({ blockedUser: req.user._id }).select("blockedBy");
    const blockedMeIds = blockedMe.map((b) => b.blockedBy);

    const excludeIds = [...myBlockedIds, ...blockedMeIds, req.user._id];

    const users = await User.find({
      username: { $regex: username.toLowerCase(), $options: "i" },
      _id: { $nin: excludeIds },
    })
      .select("fullName username profilePicture bio isOnline lastSeen")
      .limit(20);

    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const friendRequest = await FriendRequest.findOne({
          $or: [
            { fromUser: req.user._id, toUser: user._id },
            { fromUser: user._id, toUser: req.user._id },
          ],
        });

        let friendStatus = "none";
        if (friendRequest) {
          if (friendRequest.status === "accepted") friendStatus = "friends";
          else if (friendRequest.status === "pending") {
            friendStatus =
              friendRequest.fromUser.toString() === req.user._id.toString()
                ? "pending_sent"
                : "pending_received";
          }
        }

        return {
          ...user.toObject(),
          friendStatus,
          requestId: friendRequest?._id || null,
        };
      })
    );

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/users/block/:userId
// ─────────────────────────────────────────────
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const alreadyBlocked = await BlockedUser.findOne({
      blockedBy: req.user._id,
      blockedUser: userId,
    });
    if (alreadyBlocked) {
      return res.status(400).json({ error: "User already blocked" });
    }

    await BlockedUser.create({ blockedBy: req.user._id, blockedUser: userId });

    await FriendRequest.deleteMany({
      $or: [
        { fromUser: req.user._id, toUser: userId },
        { fromUser: userId, toUser: req.user._id },
      ],
    });

    res.json({ success: true, message: `@${targetUser.username} blocked successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/users/unblock/:userId
// ─────────────────────────────────────────────
const unblockUser = async (req, res) => {
  try {
    const block = await BlockedUser.findOneAndDelete({
      blockedBy: req.user._id,
      blockedUser: req.params.userId,
    });

    if (!block) return res.status(404).json({ error: "User not blocked" });

    res.json({ success: true, message: "User unblocked" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/users/blocked
// ─────────────────────────────────────────────
const getBlockedUsers = async (req, res) => {
  try {
    const blocked = await BlockedUser.find({ blockedBy: req.user._id }).populate(
      "blockedUser",
      "fullName username profilePicture"
    );

    res.json({ success: true, blockedUsers: blocked.map((b) => b.blockedUser) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/users/:userId
// ─────────────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { searchUsers, blockUser, unblockUser, getBlockedUsers, getUserProfile };
