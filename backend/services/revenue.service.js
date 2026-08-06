// Splits Session Revenue and Cafe Revenue by payment mode (cash/upi/card),
// shared by the admin dashboard and all three customer reports (daily/
// monthly/yearly) so they can never disagree with each other — one
// implementation, called with different date-filtered invoice sets.
//
// An invoice's payment isn't recorded separately per session-vs-cafe —
// payment.breakdown is one array covering the whole grand total. Each
// invoice's charges.sessionTotal/charges.cafeTotal is therefore split using
// that same invoice's own payment-method ratios (a split cash+UPI payment
// divides fairly across both revenue streams); payment.method is the
// fallback when breakdown is still empty (e.g. a session completed while
// fully "pending"), so every invoice always resolves to ratios summing to
// exactly 1. That's what guarantees cash+upi+card reproduces the existing
// sessionTotal/cafeTotal totals exactly — no revenue is invented, lost, or
// double-counted, only re-bucketed by how it was/will be paid.

const PAYMENT_METHODS = ["cash", "upi", "card"];

const normalizeMethod = (method) => {
  const value = String(method || "").toLowerCase().trim();
  return PAYMENT_METHODS.includes(value) ? value : "cash";
};

const methodRatiosForInvoice = (invoice) => {
  const breakdown = (invoice.payment?.breakdown || []).filter((entry) => Number(entry?.amount) > 0);
  const amountPaid = breakdown.reduce((sum, entry) => sum + Number(entry.amount), 0);

  if (amountPaid > 0) {
    return breakdown.map((entry) => ({
      method: normalizeMethod(entry.method),
      ratio: Number(entry.amount) / amountPaid,
    }));
  }

  return [{ method: normalizeMethod(invoice.payment?.method), ratio: 1 }];
};

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

const emptyBucket = () => ({ total: 0, cash: 0, upi: 0, card: 0 });

// `invoices` — lean docs shaped { charges: { sessionTotal, cafeTotal,
// membershipPurchaseTotal }, payment: { breakdown, method } }. Returns
// { session: {total,cash,upi,card}, cafe: {total,cash,upi,card},
//   membership: {total,cash,upi,card} }.
//
// membership uses the same per-invoice payment-method ratios as
// session/cafe above — a membership purchased alongside/within a session's
// invoice settles via that same payment.breakdown, so it's split the same
// way for consistency, not tracked separately.
const aggregateRevenueByMethod = (invoices) => {
  const session = emptyBucket();
  const cafe = emptyBucket();
  const membership = emptyBucket();

  for (const invoice of invoices) {
    const sessionTotal = Number(invoice.charges?.sessionTotal || 0);
    const cafeTotal = Number(invoice.charges?.cafeTotal || 0);
    const membershipTotal = Number(invoice.charges?.membershipPurchaseTotal || 0);
    const ratios = methodRatiosForInvoice(invoice);

    session.total += sessionTotal;
    cafe.total += cafeTotal;
    membership.total += membershipTotal;

    for (const { method, ratio } of ratios) {
      session[method] += sessionTotal * ratio;
      cafe[method] += cafeTotal * ratio;
      membership[method] += membershipTotal * ratio;
    }
  }

  const roundBucket = (bucket) => ({
    total: round(bucket.total),
    cash: round(bucket.cash),
    upi: round(bucket.upi),
    card: round(bucket.card),
  });

  return { session: roundBucket(session), cafe: roundBucket(cafe), membership: roundBucket(membership) };
};

module.exports = { aggregateRevenueByMethod };
