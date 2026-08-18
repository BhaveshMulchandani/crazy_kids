const mongoose = require("mongoose");

// A customer profile is only required for customers entered directly by an
// administrator. Session history remains the source of truth for billing and
// reports; this small profile lets an old customer exist before their first
// new session, without creating a fake completed visit/invoice.
const customerChildSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dob: { type: Date, default: null },
  age: { type: Number, default: null },
  ageCategory: { type: String, enum: ["above_3", "below_3", null], default: null },
  gender: { type: String, enum: ["boy", "girl", "not_specified"], default: "not_specified" },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  customerNumber: { type: String, required: true, unique: true, index: true },
  parentName: { type: String, required: true, trim: true },
  mobileNumber: { type: String, required: true, unique: true, trim: true, index: true },
  children: { type: [customerChildSchema], default: [] },
  // These fields intentionally start at zero. They are derived from invoices
  // by the existing customer/report flows rather than being independently
  // incremented here.
  area: { type: String, default: "" },
  city: { type: String, default: "" },
  bandNumber: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);
