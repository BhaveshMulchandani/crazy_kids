// Single source of truth for how a customer's name is shown across the app:
// Parent Name / Guardian Name when present, otherwise the first child's
// name. Accepts a session, invoice.customer+children, membership.customer,
// or any plain object shaped like { parentName, children | registeredChildren }.
const getDisplayName = (entity) => {
  const parentName = String(entity?.parentName ?? "").trim();
  if (parentName) return parentName;

  const children = Array.isArray(entity?.children)
    ? entity.children
    : Array.isArray(entity?.registeredChildren)
      ? entity.registeredChildren
      : [];

  const firstChildName = String(children[0]?.name ?? "").trim();
  // A child name is always required when a session/membership is created, so
  // this should never be reached in practice — kept only as a last resort so
  // a display name is never blank.
  return firstChildName || "Guest";
};

module.exports = { getDisplayName };
