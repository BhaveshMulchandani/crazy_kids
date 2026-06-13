const mongoose = require("mongoose");

const childSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    age: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    sessionNumber: {
      type: String,
      unique: true,
      index: true,
    },

    parentName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    bandNumber: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    children: {
      type: [childSchema],
      validate: {
        validator: (children) => children.length > 0,
        message: "At least one child is required",
      },
    },

    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "offer",
      default: null,
    },

    socksRequired: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    reference: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "booked",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
      default: "booked",
      index: true,
    },

    startTime: {
      type: Date,
      default: null,
    },

    endTime: {
      type: Date,
      default: null,
    },

    pauseHistory: [
      {
        pausedAt: Date,
        resumedAt: Date,
      },
    ],

    totalPausedMinutes: {
      type: Number,
      default: 0,
    },

    cafeAmount: {
      type: Number,
      default: 0,
    },

    sessionAmount: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({
  parentName: 1,
});

sessionSchema.index({
  mobileNumber: 1,
});

sessionSchema.index({
  bandNumber: 1,
});

sessionSchema.index({
  status: 1,
});

module.exports = mongoose.model("session", sessionSchema);