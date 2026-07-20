const Counter = require("../models/counter.model");

// Atomically reserves and returns the next integer in a named sequence.
// findByIdAndUpdate($inc) is a single atomic document write in MongoDB, so
// two concurrent callers can never be handed the same number — unlike
// countDocuments()-based generation (two concurrent readers can observe the
// same snapshot count before either write lands) or Date.now()-based
// generation (collides if two writes land in the same millisecond).
const getNextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

// One-time bootstrap: if the named counter doesn't exist yet, seeds it from
// the highest numeric suffix already used for `prefix` in `model[field]`,
// so numbering picks up where the old, non-atomic generator left off
// instead of restarting at 1 and colliding with documents that already
// exist. Safe to call on every request — it's a no-op once the counter
// document exists, and if two requests race to seed it, only one create()
// wins (duplicate _id) and the other simply proceeds to the atomic
// increment below.
const ensureSeeded = async (name, model, field, prefix) => {
  const existing = await Counter.findById(name).select("_id").lean();
  if (existing) return;

  const [result] = await model.aggregate([
    { $match: { [field]: { $regex: `^${prefix}\\d+$` } } },
    // onError:null (instead of bare $toInt) — legacy documents numbered by
    // the old Date.now() generator (e.g. "INV-1783791615042") overflow a
    // 32-bit $toInt and would crash the whole aggregation, taking checkout
    // down with it.
    {
      $project: {
        seq: {
          $convert: {
            input: { $arrayElemAt: [{ $split: [`$${field}`, prefix] }, 1] },
            to: "long",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    // Timestamp-style numbers are not part of the sequence — seeding from
    // one would continue numbering at 13 digits forever. Anything at or
    // above 10^9 can only be a legacy timestamp, never a real sequence
    // value, so skip those (and unparseable values) when picking the seed.
    { $match: { seq: { $ne: null, $lt: 1000000000 } } },
    { $group: { _id: null, maxSeq: { $max: "$seq" } } },
  ]);
  const seed = Number(result?.maxSeq || 0);

  try {
    await Counter.create({ _id: name, seq: seed });
  } catch (error) {
    // Another concurrent request won the race to seed this counter — fine,
    // it already exists with a correct seed; fall through to the atomic
    // increment in getNextSequence.
    if (error.code !== 11000) throw error;
  }
};

// Bootstrap-if-needed, then atomically reserve the next number, formatted
// as `${prefix}${paddedSeq}` (e.g. "CK-00011").
const getNextFormattedNumber = async ({ name, model, field, prefix, padLength = 5 }) => {
  await ensureSeeded(name, model, field, prefix);
  const seq = await getNextSequence(name);
  return `${prefix}${String(seq).padStart(padLength, "0")}`;
};

module.exports = { getNextSequence, getNextFormattedNumber };
