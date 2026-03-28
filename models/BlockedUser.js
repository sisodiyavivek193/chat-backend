const mongoose = require("mongoose");

const blockedUserSchema = new mongoose.Schema(
  {
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Ek user ek dusre ko ek baar hi block kar sakta hai
blockedUserSchema.index({ blockedBy: 1, blockedUser: 1 }, { unique: true });

module.exports = mongoose.model("BlockedUser", blockedUserSchema);
