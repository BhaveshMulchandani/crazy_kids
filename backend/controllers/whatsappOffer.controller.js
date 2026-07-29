const Offer = require("../models/offer.model");
const Session = require("../models/session.model");
const { getWhatsappOfferQueue } = require("../queues/whatsappOffer.queue");
const { getDisplayName } = require("../utils/customerDisplay");

// One line of human-readable offer detail for the WhatsApp template's
// {{3}} placeholder — falls back to a type-specific summary (mirrors how
// Offers.jsx renders each offer type) when the offer has no description.
const buildOfferHighlight = (offer) => {
  if (offer.description?.trim()) return offer.description.trim();

  const rules = offer.rules || {};
  switch (offer.type) {
    case "membership":
      return `Rs. ${Number(offer.value || 0).toLocaleString("en-IN")} for ${rules.kidsAllowed || 1} kid(s), ${rules.playHours || 0} play hours, valid ${rules.validityMonths || 0} month(s)`;
    case "discount":
      return `${Number(offer.value || 0)}% off for ${rules.minKids || 1}+ kids`;
    case "flat_discount":
      return `Rs. ${Number(offer.value || 0).toLocaleString("en-IN")} off for ${rules.minKids || 1}+ kids`;
    case "special_pricing":
      return `${rules.day || "Special day"}: Rs. ${rules.firstHourPrice || 0} first hour, Rs. ${rules.nextHourPrice || 0}/hr after`;
    default:
      return offer.name;
  }
};

// One row per unique mobileNumber across every session ever recorded
// (any status) — a broadcast offer isn't gated on having completed a visit,
// unlike the billing customer directory in admin.controller.js.
const fetchEligibleCustomers = async () => {
  const rows = await Session.aggregate([
    { $match: { mobileNumber: { $exists: true, $ne: "" } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$mobileNumber",
        parentName: { $first: "$parentName" },
        children: { $first: "$children" },
      },
    },
  ]);

  return rows.map((row) => ({ mobileNumber: row._id, parentName: getDisplayName(row) }));
};

// Creates one BullMQ job per eligible customer and returns immediately —
// this endpoint only enqueues; whatsappOffer.worker.js does the actual
// sending, with its own retry/concurrency handling.
const sendOfferCampaign = async (req, res) => {
  try {
    const { offerId } = req.body;
    if (!offerId) {
      return res.status(400).json({ message: "offerId is required" });
    }

    const offer = await Offer.findById(offerId).lean();
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const customers = await fetchEligibleCustomers();
    if (!customers.length) {
      return res.status(200).json({ message: "No eligible customers found.", queued: 0 });
    }

    const offerHighlight = buildOfferHighlight(offer);
    const queue = getWhatsappOfferQueue();

    await Promise.all(
      customers.map((customer) =>
        queue.add(
          "send-offer",
          {
            offerId: String(offer._id),
            offerName: offer.name,
            offerHighlight,
            mobileNumber: customer.mobileNumber,
            parentName: customer.parentName,
          },
          // Stable per offer+customer — re-clicking "Send" for the same
          // offer while a prior run's job for that customer is still
          // queued/active can't create a duplicate send.
          { jobId: `offer:${offer._id}:${customer.mobileNumber}` }
        )
      )
    );

    console.log("[whatsapp-offer.controller] campaign queued", {
      offerId: String(offer._id),
      offerName: offer.name,
      queued: customers.length,
    });

    return res.status(202).json({
      message: "Campaign has been queued successfully.",
      offerName: offer.name,
      queued: customers.length,
    });
  } catch (error) {
    console.error("[whatsapp-offer.controller] send failed:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(error.statusCode || 500).json({
      message: error.message || "Unable to queue WhatsApp offer campaign.",
    });
  }
};

module.exports = { sendOfferCampaign };
