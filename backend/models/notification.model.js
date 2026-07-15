const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: "session_overdue",
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "session",
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    resolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
