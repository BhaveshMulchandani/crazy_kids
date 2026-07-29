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
