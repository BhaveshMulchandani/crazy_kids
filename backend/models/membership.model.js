const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema({
  customer: {
    parentName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true, index: true },
  },
  membershipPlan: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true },
  planName: { type: String, required: true },
  purchasePrice: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true, index: true },
  totalPlayHours: { type: Number, required: true, min: 0 },
  usedPlayHours: { type: Number, default: 0, min: 0 },
  remainingPlayHours: { type: Number, required: true, min: 0 },
  kidsAllowed: { type: Number, required: true, min: 1 },
  bonusHours: { type: Number, default: 0, min: 0 },
  benefits: [{ type: String, trim: true }],
  registeredChildren: [{
    name: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
  }],
  status: { type: String, enum: ["active", "expired", "exhausted"], default: "active", index: true },
}, { timestamps: true });

membershipSchema.index({ "customer.mobileNumber": 1, status: 1, expiryDate: 1 });

module.exports = mongoose.model("Membership", membershipSchema);
