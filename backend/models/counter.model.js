const mongoose = require("mongoose");

// Backs atomic sequence generation (services/counter.service.js) for every
// human-facing sequential number in the app (session/invoice/KOT numbers).
// One document per named sequence, e.g. _id: "sessionNumber".
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0, required: true },
});

module.exports = mongoose.model("Counter", counterSchema);
