const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  description: {
    type: String,
  },

  type: {
    type: String,
    required: true,
    enum: [
      "discount",
      "membership",
      "special_pricing",
    ],
  },

  value: {
    type: Number,
  },

  rules: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  active: {
    type: Boolean,
    default: true,
  },

  startDate: Date,

  endDate: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model("Offer", offerSchema);