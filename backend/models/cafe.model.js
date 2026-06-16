const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "menu",
    required: true,
  },

  name: String,

  price: Number,

  quantity: {
    type: Number,
    default: 1,
  },

  notes: {
    type: String,
    default: "",
  },

  total: Number,
});

const kotSchema = new mongoose.Schema(
  {
    kotNumber: {
      type: String,
      unique: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "session",
      required: true,
      index: true,
    },

    tableNumber: {
      type: String,
      required: true,
    },

    items: [itemSchema],

    totalAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "prepared", "served"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("KOT", kotSchema);