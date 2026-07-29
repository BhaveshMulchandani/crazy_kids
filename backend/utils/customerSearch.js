// Shared "find a customer" query builder — every module that lets an
// operator search for a customer (billing, cafe, admin directory) should
// match on the same set of fields: parent/guardian name, mobile number,
// and now child name, so a family with no parent name on file can still be
// found by searching any of their children.
const escapeRegex = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `exact` anchors the regex to a full-string match (^...$) — used where the
// caller wants an exact (case-insensitive) name match rather than a
// substring search. `prefix` lets callers target nested/aliased fields
// (e.g. "latestSession." in an aggregation pipeline).
const buildCustomerNameOr = (query, { exact = false, prefix = "" } = {}) => {
  const pattern = escapeRegex(String(query ?? "").trim());
  const regex = exact ? `^${pattern}$` : pattern;

  return [
    { [`${prefix}parentName`]: { $regex: regex, $options: "i" } },
    { [`${prefix}children.name`]: { $regex: regex, $options: "i" } },
  ];
};

module.exports = { escapeRegex, buildCustomerNameOr };
