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

const extensionSchema = new mongoose.Schema(
  {
    hours: {
      type: Number,
      default: 1,
    },

    addedAt: {
      type: Date,
      default: Date.now,
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
      ref: "Offer",
      default: null,
    },

    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Membership",
      default: null,
    },

    membershipPurchase: {
      membership: { type: mongoose.Schema.Types.ObjectId, ref: "Membership" },
      planName: { type: String, default: "" },
      price: { type: Number, default: 0 },
    },

    reference: {
      type: String,
      default: "",
      trim: true,
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

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "partially_paid"],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      default: "cash",
      trim: true,
    },

    paymentBreakdown: [
      {
        method: {
          type: String,
          trim: true,
        },
        amount: {
          type: Number,
          default: 0,
        },
      },
    ],

    amountPaid: {
      type: Number,
      default: 0,
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

    // Timing

    startTime: {
      type: Date,
      default: null,
    },

    scheduledEndTime: {
      type: Date,
      default: null,
    },

    actualEndTime: {
      type: Date,
      default: null,
    },

    // Hours

    bookedHours: {
      type: Number,
      default: 1,
      min: 1,
    },

    extendedHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalHours: {
      type: Number,
      default: 1,
      min: 1,
    },

    extensions: [extensionSchema],

    // Pause tracking

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
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ status: 1, scheduledEndTime: 1 });

module.exports = mongoose.model(
  "session",
  sessionSchema
);
