const mongoose = require("mongoose");

// A ledger of manual loyalty-point operations (redemptions/corrections),
// kept entirely separate from Invoice.charges.loyaltyPoints (which is how
// points are earned and is never written to by this model). A customer's
// current redeemable balance is always:
//   SUM(Invoice.charges.loyaltyPoints for that mobileNumber)
//   + SUM(LoyaltyTransaction.points for that mobileNumber)
// — see services/loyalty.service.js. This additive design means past
// invoices never need to be touched to redeem or correct a balance, and a
// fresh deploy (empty ledger) reproduces today's balances exactly.
const loyaltyTransactionSchema = new mongoose.Schema(
  {
    mobileNumber: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ["redeemed", "adjusted"], required: true },
    // Signed delta against the balance — negative for a redemption or a
    // downward correction, positive for an upward correction.
    points: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    // Snapshot of the balance immediately after this entry, so the history
    // list can show it without recomputing the running total client-side.
    balanceAfter: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ mobileNumber: 1, createdAt: -1 });

module.exports = mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);
