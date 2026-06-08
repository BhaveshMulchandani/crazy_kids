const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  firstHourUnder3: {
    type: Number,
    required: true,
    default: 200,
  },

  extensionUnder3: {
    type: Number,
    required: true,
    default: 150,
  },

  firstHourAbove3: {
    type: Number,
    required: true,
    default: 300,
  },

  extensionAbove3: {
    type: Number,
    required: true,
    default: 200,
  },

  socksCost: {
    type: Number,
    required: true,
    default: 30,
  },

  loyaltyPointsPer100: {
    type: Number,
    required: true,
    default: 10,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Setting", settingSchema);