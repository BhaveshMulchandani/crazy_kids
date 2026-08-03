// Single source of truth for how a customer's name is shown across the app:
// Parent Name / Guardian Name when present, otherwise the first child's
// name. Accepts a session/bill, invoice (customer + children), membership
// (customer + registeredChildren), or any object shaped that way.
export const getDisplayName = (entity) => {
  const parentName = String(entity?.parentName ?? "").trim();
  if (parentName) return parentName;

  const children = Array.isArray(entity?.children)
    ? entity.children
    : Array.isArray(entity?.registeredChildren)
      ? entity.registeredChildren
      : [];

  const firstChildName = String(children[0]?.name ?? "").trim();
  // A child name is always required to create a session/membership, so this
  // should never be reached in practice — kept only so a display name is
  // never blank.
  return firstChildName || "Guest";
};

// KOT-only: always the first child's name, never parentName, regardless of
// how many children are on the session — a group booking's children[0].name
// is already the representative child (mirrored at session-creation time),
// so no special-casing is needed for that case.
export const getKotDisplayName = (entity) => {
  const children = Array.isArray(entity?.children) ? entity.children : [];
  const firstChildName = String(children[0]?.name ?? "").trim();
  return firstChildName || "Guest";
};

// Invoice-only: { label, value } for the customer-identity line. Never reads
// parentName. A single child (or a group booking, which has exactly one
// representative name) shows just that name; multiple children show every
// name, comma-joined, since the invoice has no single "the" child to pick.
export const getInvoiceDisplayName = (entity) => {
  const repName = String(entity?.groupBooking?.representativeChildName ?? "").trim();
  const children = Array.isArray(entity?.children) ? entity.children : [];
  const names = repName
    ? [repName]
    : children.map((child) => String(child?.name ?? "").trim()).filter(Boolean);

  return names.length <= 1
    ? { label: "Child Name", value: names[0] || "Guest" }
    : { label: "Child Name(s)", value: names.join(", ") };
};
