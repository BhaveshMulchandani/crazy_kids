const Offer = require("../models/offer.model");
const Membership = require("../models/membership.model");
const { refreshStatus } = require("../controllers/membership.controller");

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayName = (date) => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

const calculateInvoiceCharges = async ({ session, settings, kots, extraDiscount, extraDiscountType, extraDiscountValue }) => {
  const totalHours = Number(session.totalHours || 1);
  const extensionHours = Math.max(totalHours - 1, 0);
  const children = Array.isArray(session.children) ? session.children : [];

  // A group booking (10-20+ kids, see session.model.js) never carries real
  // per-child entries — `children` is a single display-only placeholder —
  // so every place below that needs "how many kids are on this session"
  // must use this headcount instead of `children.length`.
  const groupBooking = session.groupBooking?.isGroup ? session.groupBooking : null;
  const childCount = groupBooking ? Number(groupBooking.totalChildren || 0) : children.length;

  // Membership is resolved before the offer, and always wins: when an
  // active membership covers this session, any offer attached to the
  // session is ignored outright — not fetched, not applied to child
  // pricing, and not recorded — rather than merely zeroed out numerically.
  // (Group bookings never carry a membership — see session.controller.js.)
  let membershipApplied = false;
  let membership = null;
  const membershipId = session.membership?._id || session.membership;
  if (membershipId) {
    membership = await Membership.findById(membershipId);
    if (membership) refreshStatus(membership);
    if (membership?.status === "active" && membership.kidsAllowed >= childCount && membership.remainingPlayHours >= totalHours) membershipApplied = true;
  }

  let offer = null;
  if (!membershipApplied) {
    offer = session.offer && typeof session.offer === "object" ? session.offer : null;
    if (!offer && session.offer) offer = await Offer.findById(session.offer);
    if (offer && !offer.active) offer = null;
  }

  let specialPricingApplied = false;
  const specialDayMatches = offer?.type === "special_pricing" && String(offer.rules?.day || "").toLowerCase() === dayName(new Date()).toLowerCase();

  const rateFor = (under3) => {
    const normalFirst = Number(under3 ? settings?.firstHourUnder3 : settings?.firstHourAbove3) || 0;
    const normalExtension = Number(under3 ? settings?.extensionUnder3 : settings?.extensionAbove3) || 0;
    const firstHourCharge = specialDayMatches ? Number(offer.rules?.firstHourPrice || 0) : normalFirst;
    const extensionRate = specialDayMatches ? Number(offer.rules?.nextHourPrice || 0) : normalExtension;
    if (specialDayMatches) specialPricingApplied = true;
    return { firstHourCharge, extensionRate };
  };

  let childCharges;
  if (groupBooking) {
    // Priced entirely from the above/below-3 headcount rather than
    // iterating individual children — same per-head first-hour/extension
    // rates as a normal booking, just multiplied by count instead of
    // computed once per named child.
    const aboveCount = Number(groupBooking.aboveThreeCount || 0);
    const belowCount = Number(groupBooking.belowThreeCount || 0);
    const aboveRates = rateFor(false);
    const belowRates = rateFor(true);
    childCharges = [
      aboveCount > 0 && {
        name: `Children above 3 years (${aboveCount})`,
        dob: null,
        age: null,
        gender: "not_specified",
        firstHourCharge: aboveRates.firstHourCharge,
        extensionHours,
        extensionRate: aboveRates.extensionRate,
        childTotal: round(aboveCount * (aboveRates.firstHourCharge + extensionHours * aboveRates.extensionRate)),
        socksOpted: false,
        groupCount: aboveCount,
      },
      belowCount > 0 && {
        name: `Children below 3 years (${belowCount})`,
        dob: null,
        age: null,
        gender: "not_specified",
        firstHourCharge: belowRates.firstHourCharge,
        extensionHours,
        extensionRate: belowRates.extensionRate,
        childTotal: round(belowCount * (belowRates.firstHourCharge + extensionHours * belowRates.extensionRate)),
        socksOpted: false,
        groupCount: belowCount,
      },
    ].filter(Boolean);
  } else {
    childCharges = children.map((child) => {
      const { firstHourCharge, extensionRate } = rateFor(Number(child.age || 0) < 3);
      return { name: child.name || "", dob: child.dob || null, age: Number(child.age || 0), gender: child.gender || "not_specified", firstHourCharge, extensionHours, extensionRate, childTotal: round(firstHourCharge + extensionHours * extensionRate), socksOpted: Boolean(child.socksOpted) };
    });
  }
  const normalSessionTotal = round(childCharges.reduce((sum, child) => sum + child.childTotal, 0));
  const offerConditionsMet = offer && childCount >= Number(offer.rules?.minKids || Infinity);
  let discountAmount = 0;
  if (offer?.type === "discount" && offerConditionsMet) {
    discountAmount = round(normalSessionTotal * Number(offer.value || 0) / 100);
  } else if (offer?.type === "flat_discount" && offerConditionsMet) {
    discountAmount = round(Math.min(Number(offer.value || 0), normalSessionTotal));
  }
  const sessionTotal = membershipApplied ? 0 : round(Math.max(normalSessionTotal - discountAmount, 0));
  const cafeItems = (kots || []).flatMap((kot) => (kot.items || []).map((item) => ({ name: item.name || "", quantity: Number(item.quantity || 1), unitPrice: Number(item.price || 0), lineTotal: Number(item.total || 0) })));
  const cafeSubtotal = round(cafeItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const cafeGST = round(cafeSubtotal * 0.05);
  const cafeTotal = round(cafeSubtotal + cafeGST);
  const membershipPurchase = session.membershipPurchase || null;
  const membershipPurchaseTotal = Number(membershipPurchase?.price || 0);
  // A group booking has no per-child socksOpted flags to count — it collects
  // a single "how many socks does the group need" headcount instead.
  const socksQty = groupBooking
    ? Number(groupBooking.socksRequired || 0)
    : children.filter((child) => child.socksOpted).length;
  const socksRate = Number(settings?.socksCost || 0);
  const socksTotal = round(socksQty * socksRate);
  const preDiscountGrandTotal = round(sessionTotal + cafeTotal + membershipPurchaseTotal + socksTotal);
  // An operator-entered discount applied at checkout, on top of any
  // offer/membership pricing — either a flat ₹ amount or a % of the
  // pre-discount total. `extraDiscountValue`/`extraDiscountType` are the
  // current fields; `extraDiscount` (flat ₹, no type) is kept as a fallback
  // so older callers/requests keep working unchanged. Clamped so the value
  // is never negative, a percentage never exceeds 100%, and the resulting
  // amount can never take the payable total below zero.
  const normalizedExtraDiscountType = extraDiscountType === "percentage" ? "percentage" : "flat";
  const rawExtraDiscountValue = Math.max(Number(extraDiscountValue ?? extraDiscount) || 0, 0);
  const extraDiscountAmount = normalizedExtraDiscountType === "percentage"
    ? round(preDiscountGrandTotal * (Math.min(rawExtraDiscountValue, 100) / 100))
    : round(Math.min(rawExtraDiscountValue, preDiscountGrandTotal));
  const grandTotal = round(preDiscountGrandTotal - extraDiscountAmount);
  return { totalHours, extensionHours, childCharges, cafeItems, normalSessionTotal, sessionTotal, cafeSubtotal, cafeGST, cafeTotal, grandTotal, discountAmount, extraDiscountAmount, extraDiscountType: normalizedExtraDiscountType, extraDiscountValue: rawExtraDiscountValue, membershipApplied, membership, specialPricingApplied, offer: offer ? { name: offer.name, type: offer.type, value: offer.value } : null, membershipPurchase, socksQty, socksRate, socksTotal, groupBooking: groupBooking ? { representativeChildName: groupBooking.representativeChildName || "", totalChildren: Number(groupBooking.totalChildren || 0), aboveThreeCount: Number(groupBooking.aboveThreeCount || 0), belowThreeCount: Number(groupBooking.belowThreeCount || 0), socksRequired: Number(groupBooking.socksRequired || 0) } : null };
};

module.exports = { calculateInvoiceCharges, round };
