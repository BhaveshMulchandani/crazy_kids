// The KOT receipt markup — used both for the just-placed order
// (Cafepos.jsx) and for reprinting an existing order from its order history
// (Runningbills.jsx) so the two can never visually diverge. `items` is
// always `{ name, qty, price, notes }[]`, regardless of whether the
// caller's source data used `qty` (a live cart) or `quantity` (a stored
// KOT) — callers normalize before passing in. Printing itself lives in
// utils/cafeReceiptPrint.js (kept out of this file so it stays
// components-only for fast refresh).
export function CafeReceiptMarkup({
  elementId = "cafe-receipt",
  kotNumber,
  sessionNumber,
  customerName,
  tableNumber,
  createdAt,
  items,
  total,
}) {
  return (
    <div id={elementId} style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "#000", padding: 8 }}>
      <div className="text-center" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>CRAZIKIDS CAFE</div>
        <div>KOT #{kotNumber}</div>
        <div>{createdAt.toLocaleString()}</div>
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Session</span>
        <span>{sessionNumber}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Customer</span>
        <span>{customerName}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Table</span>
        <span>{tableNumber || "—"}</span>
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      {items.map((item, index) => (
        <div key={index} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{item.qty}× {item.name}</span>
            <span>₹{item.qty * item.price}</span>
          </div>
          {item.notes && <div style={{ fontSize: 11, color: "#444", paddingLeft: 8 }}>* {item.notes}</div>}
        </div>
      ))}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
        <span>TOTAL</span>
        <span>₹{total}</span>
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ textAlign: "center", marginTop: 4 }}>Thank you!</div>
    </div>
  );
}
