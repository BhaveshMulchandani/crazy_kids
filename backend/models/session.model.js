const mongoose = require("mongoose");

const childTimerSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["running", "paused"],
      default: "running",
    },

    scheduledEndTime: {
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
  },
  { _id: false }
);

const childSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    dob: {
      type: Date,
      default: null,
    },

    age: {
      type: Number,
      default: null,
      min: 0,
    },

    gender: {
      type: String,
      enum: ["boy", "girl", "not_specified"],
      default: "not_specified",
    },

    socksOpted: {
      type: Boolean,
      default: false,
    },

    timer: {
      type: childTimerSchema,
      default: () => ({}),
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

    // Optional — a customer without a Parent/Guardian Name on file falls
    // back to their first child's name everywhere the app displays or
    // searches by name (see backend/utils/customerDisplay.js).
    parentName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    area: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      default: "",
      trim: true,
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

    // A large-group booking (10-20+ kids) skips per-child name/DOB entry —
    // `children` above still holds exactly one placeholder entry (see
    // createsession) so the schema's "at least one child" rule and the
    // existing display-name fallback (customerDisplay.js) keep working
    // unchanged. Billing branches on `groupBooking.isGroup` to price by
    // headcount instead of iterating individual children.
    groupBooking: {
      isGroup: { type: Boolean, default: false },
      representativeChildName: { type: String, default: "", trim: true },
      totalChildren: { type: Number, default: 0, min: 0 },
      aboveThreeCount: { type: Number, default: 0, min: 0 },
      belowThreeCount: { type: Number, default: 0, min: 0 },
      // How many socks are needed for the whole group — a headcount, not the
      // per-child socksOpted flag used elsewhere, since a group booking has
      // no per-child entries to opt in individually.
      socksRequired: { type: Number, default: 0, min: 0 },
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

    // Set once an "session ended, waiting for checkout" notification has
    // been raised for this session, so the overdue watcher never raises a
    // second one for the same session. Reset on extend, since the session
    // is no longer overdue once its scheduled end time moves forward.
    overdueNotified: {
      type: Boolean,
      default: false,
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
