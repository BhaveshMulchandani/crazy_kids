const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      index: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "session",
      required: true,
      index: true,
    },

    customer: {
      parentName: { type: String, default: "" },
      mobileNumber: { type: String, default: "" },
      bandNumber: { type: String, default: "" },
      sessionNumber: { type: String, default: "" },
    },

    children: [
      {
        name: { type: String, default: "" },
        dob: { type: Date, default: null },
        age: { type: Number, default: 0 },
        firstHourCharge: { type: Number, default: 0 },
        extensionHours: { type: Number, default: 0 },
        extensionRate: { type: Number, default: 0 },
        childTotal: { type: Number, default: 0 },
      },
    ],

    sessionDetails: {
      startTime: { type: Date, default: null },
      endTime: { type: Date, default: null },
      actualDurationMinutes: { type: Number, default: 0 },
      totalHours: { type: Number, default: 1 },
      extensionHours: { type: Number, default: 0 },
      pauseTimeMinutes: { type: Number, default: 0 },
    },

    cafeItems: [
      {
        name: { type: String, default: "" },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
      },
    ],

    charges: {
      sessionTotal: { type: Number, default: 0 },
      cafeTotal: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
      loyaltyPoints: { type: Number, default: 0 },
    },

    payment: {
      status: {
        type: String,
        enum: ["pending", "paid", "partially_paid"],
        default: "pending",
      },
      breakdown: [
        {
          method: { type: String, default: "cash" },
          amount: { type: Number, default: 0 },
        },
      ],
      amountPaid: { type: Number, default: 0 },
      pendingAmount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
