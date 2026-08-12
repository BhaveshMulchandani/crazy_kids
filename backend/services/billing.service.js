const Offer = require("../models/offer.model");
const Membership = require("../models/membership.model");
const { refreshStatus } = require("../controllers/membership.controller");

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayName = (date) => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

// Pricing bracket now comes from the operator-selected ageCategory, not DOB —
// DOB is optional and no longer drives billing. `age` (dob-derived, if any)
// is kept only as a fallback for sessions booked before ageCategory existed,
// so old/in-flight sessions keep pricing exactly as they did before.
const isUnder3 = (child) => {
  if (child.ageCategory === "below_3") return true;
  if (child.ageCategory === "above_3") return false;
  return Number(child.age || 0) < 3;
};

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

  // Mirrors the membership resolution above: `session.offer` may be an
  // already-populated Offer document (e.g. from runningsession's
  // .populate("offer")) or a raw ObjectId (e.g. from completesession's plain
  // findById) — a raw ObjectId is also `typeof "object"`, so it can't be
  // told apart from a populated doc that way. Only a populated doc has
  // `name` (a required Offer field), so that's used to decide whether a
  // fresh fetch is needed.
  let offer = null;
  if (!membershipApplied && session.offer) {
    const offerId = session.offer._id || session.offer;
    offer = session.offer.name !== undefined ? session.offer : await Offer.findById(offerId);
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

  // Computed before childCharges below — a Birthday Offer prices every child
  // at a flat ₹-per-child rate (never first-hour/extension, never an
  // above/below-3-years split) only once the booking meets the offer's
  // Minimum Kids Allowed (createsession already enforces this at booking
  // time; this is the checkout-time backstop for the same rule).
  const offerConditionsMet = offer && childCount >= Number(offer.rules?.minKids || Infinity);
  const birthdayApplied = offer?.type === "birthday" && offerConditionsMet;

  let childCharges;
  if (birthdayApplied) {
    const birthdayRate = Number(offer.value || 0);
    // A group booking applying a Birthday Offer only ever collects a total
    // headcount (see session.controller.js/session.model.js) — never an
    // above/below-3-years split — so this is a single summary row, not two.
    childCharges = groupBooking
      ? [{
          name: `Children (${childCount})`,
          dob: null,
          age: null,
          gender: "not_specified",
          firstHourCharge: birthdayRate,
          extensionHours: 0,
          extensionRate: 0,
          childTotal: round(childCount * birthdayRate),
          socksOpted: false,
          groupCount: childCount,
        }]
      : children.map((child) => ({
          name: child.name || "",
          dob: child.dob || null,
          age: Number(child.age || 0),
          ageCategory: child.ageCategory || null,
          gender: child.gender || "not_specified",
          firstHourCharge: birthdayRate,
          extensionHours: 0,
          extensionRate: 0,
          childTotal: round(birthdayRate),
          socksOpted: Boolean(child.socksOpted),
        }));
  } else if (groupBooking) {
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
      const { firstHourCharge, extensionRate } = rateFor(isUnder3(child));
      return { name: child.name || "", dob: child.dob || null, age: Number(child.age || 0), ageCategory: child.ageCategory || null, gender: child.gender || "not_specified", firstHourCharge, extensionHours, extensionRate, childTotal: round(firstHourCharge + extensionHours * extensionRate), socksOpted: Boolean(child.socksOpted) };
    });
  }
  // For a Birthday Offer, normalSessionTotal already IS the applied charge
  // (childCount × per-child amount, see above) — there's no separate
  // "normal" price to discount from, so discountAmount naturally stays 0 and
  // sessionTotal below just passes normalSessionTotal straight through.
  const normalSessionTotal = round(childCharges.reduce((sum, child) => sum + child.childTotal, 0));
  let discountAmount = 0;
  if (offer?.type === "discount" && offerConditionsMet) {
    discountAmount = round(normalSessionTotal * Number(offer.value || 0) / 100);
  } else if (offer?.type === "flat_discount" && offerConditionsMet) {
    discountAmount = round(Math.min(Number(offer.value || 0), normalSessionTotal));
  }
  const sessionTotal = membershipApplied ? 0 : round(Math.max(normalSessionTotal - discountAmount, 0));
  // Cafe pricing is completely untouched by a Birthday Offer's selected
  // food/benefit items — those are only a descriptive "what's included in
  // this package" configuration on the offer, never a billing override. A
  // parent ordering the same item from Cafe POS is charged the normal cafe
  // price exactly as before.
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
  return { totalHours, extensionHours, childCharges, cafeItems, normalSessionTotal, sessionTotal, cafeSubtotal, cafeGST, cafeTotal, grandTotal, discountAmount, extraDiscountAmount, extraDiscountType: normalizedExtraDiscountType, extraDiscountValue: rawExtraDiscountValue, membershipApplied, membership, specialPricingApplied, birthdayApplied, offer: offer ? { name: offer.name, type: offer.type, value: offer.value } : null, membershipPurchase, socksQty, socksRate, socksTotal, groupBooking: groupBooking ? { isBirthday: Boolean(groupBooking.isBirthday), representativeChildName: groupBooking.representativeChildName || "", totalChildren: Number(groupBooking.totalChildren || 0), aboveThreeCount: Number(groupBooking.aboveThreeCount || 0), belowThreeCount: Number(groupBooking.belowThreeCount || 0), socksRequired: Number(groupBooking.socksRequired || 0) } : null };
};

module.exports = { calculateInvoiceCharges, round, dayName };
