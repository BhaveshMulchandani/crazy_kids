const sessionmodel = require("../models/session.model");

const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();

  let age =
    today.getFullYear() -
    birthDate.getFullYear();

  const monthDiff =
    today.getMonth() -
    birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 &&
      today.getDate() <
      birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

const isBirthdayToday = (dob) => {
  if (!dob) return false;

  const today = new Date();
  const birthDate = new Date(dob);

  return (
    today.getDate() === birthDate.getDate() &&
    today.getMonth() === birthDate.getMonth()
  );
};

const Invoice = require('../models/invoice.model');
const KOT = require('../models/cafe.model');
const PriceSetting = require('../models/price.model');
const Membership = require('../models/membership.model');
const { createMembership, refreshStatus } = require('./membership.controller');
const { calculateInvoiceCharges } = require('../services/billing.service');

const membershipChildKey = (child) => `${String(child.name || "").trim().toLowerCase()}|${new Date(child.dob).toISOString().slice(0, 10)}`;

const createsession = async (
  req,
  res
) => {
  try {
    const {
      parentName,
      mobileNumber,
      bandNumber,
      children,
      offer,
      reference,
      socksRequired,
      notes,
      paymentStatus,
      paymentMethod,
      paymentBreakdown,
      amountPaid,
      purchaseMembershipPlan,
    } = req.body;

    // Validations

    if (!parentName?.trim()) {
      return res.status(400).json({
        message:
          "Parent name is required",
      });
    }

    if (!mobileNumber?.trim()) {
      return res.status(400).json({
        message:
          "Mobile number is required",
      });
    }

    if (
      !children ||
      !Array.isArray(children) ||
      children.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one child is required",
      });
    }

    const processedChildren =
      children.map((child) => {
        if (
          !child.name ||
          !child.dob
        ) {
          throw new Error(
            "Each child must have name and DOB"
          );
        }

        return {
          name: child.name.trim(),
          dob: child.dob,
          age: calculateAge(
            child.dob
          ),
        };
      });

    const count =
      (await sessionmodel.countDocuments()) +
      1;

    const sessionNumber = `CK-${String(
      count
    ).padStart(5, "0")}`;

    let purchasedMembership = null;
    if (purchaseMembershipPlan) {
      purchasedMembership = await createMembership({ parentName, mobileNumber, planId: purchaseMembershipPlan });
    }
    const activeMembership = purchasedMembership || await Membership.findOne({ "customer.mobileNumber": mobileNumber.trim(), status: "active", expiryDate: { $gt: new Date() }, remainingPlayHours: { $gt: 0 } }).sort({ expiryDate: 1 });
    if (activeMembership) {
      refreshStatus(activeMembership);
      await activeMembership.save();
    }
    if (activeMembership?.status === "active") {
      const registeredChildren = activeMembership.registeredChildren || [];
      const registeredKeys = new Set(registeredChildren.map(membershipChildKey));
      const newChildren = processedChildren.filter((child) => !registeredKeys.has(membershipChildKey(child)));
      if (registeredChildren.length + newChildren.length > activeMembership.kidsAllowed) {
        return res.status(400).json({ message: "Membership child limit reached. This membership already has the maximum allowed children." });
      }
      if (newChildren.length) {
        activeMembership.registeredChildren.push(...newChildren.map((child) => ({ name: child.name, dob: child.dob })));
        await activeMembership.save();
      }
    }
    const session =
      await sessionmodel.create({
        sessionNumber,

        parentName:
          parentName.trim(),

        mobileNumber:
          mobileNumber.trim(),

        bandNumber:
          bandNumber?.trim() || "",

        children:
          processedChildren,

        offer:
          purchaseMembershipPlan ? null : offer || null,
        membership: activeMembership?.status === "active" ? activeMembership._id : null,
        membershipPurchase: purchasedMembership ? { membership: purchasedMembership._id, planName: purchasedMembership.planName, price: purchasedMembership.purchasePrice } : undefined,

        reference:
          reference?.trim() || "",

        socksRequired:
          socksRequired ?? false,

        notes:
          notes?.trim() || "",

        paymentStatus:
          ["pending", "paid", "partially_paid"].includes(paymentStatus)
            ? paymentStatus
            : "pending",

        paymentMethod:
          paymentMethod?.trim() || "cash",

        paymentBreakdown: Array.isArray(paymentBreakdown)
          ? paymentBreakdown.map((entry) => ({
            method: entry?.method?.trim() || "cash",
            amount: Number(entry?.amount) || 0,
          }))
          : [],

        amountPaid: Number(amountPaid) || 0,

        bookedHours: 1,
        extendedHours: 0,
        totalHours: 1,

        status: "booked",
      });

    return res.status(201).json({
      message:
        "Session created successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        error.message ||
        "Internal server error",
    });
  }
};

const bookedsession = async (req, res) => {
  try {
    const sessions = await sessionmodel
      .find({ status: "booked" })
      .populate("offer")
      .populate("membership")
      .sort({ createdAt: -1 });

    const updatedSessions = sessions.map((session) => {
      const sessionObj = session.toObject();

      sessionObj.children = sessionObj.children.map((child) => ({
        ...child,
        isBirthdayToday: isBirthdayToday(child.dob),
      }));

      return sessionObj;
    });

    return res.status(200).json({
      message: "Booked sessions fetched successfully",
      count: updatedSessions.length,
      sessions: updatedSessions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const startsession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (session.status !== "booked") {
      return res.status(400).json({
        message: "Session already started",
      });
    }

    const now = new Date();

    session.startTime = now;

    session.scheduledEndTime = new Date(
      now.getTime() +
      session.totalHours * 60 * 60 * 1000
    );

    session.status = "running";

    await session.save();

    return res.status(200).json({
      message: "Session started successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const pausesession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (session.status !== "running") {
      return res.status(400).json({
        message: "Only running sessions can be paused",
      });
    }

    session.pauseHistory.push({
      pausedAt: new Date(),
    });

    session.status = "paused";

    await session.save();

    return res.status(200).json({
      message: "Session paused successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const resumesession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (session.status !== "paused") {
      return res.status(400).json({
        message: "Session is not paused",
      });
    }

    const lastPause =
      session.pauseHistory[
      session.pauseHistory.length - 1
      ];

    if (!lastPause || !lastPause.pausedAt) {
      return res.status(400).json({
        message: "Invalid pause history",
      });
    }

    const resumedAt = new Date();

    lastPause.resumedAt = resumedAt;

    const pausedMinutes = Math.ceil(
      (resumedAt - lastPause.pausedAt) /
      (1000 * 60)
    );

    session.totalPausedMinutes +=
      pausedMinutes;

    session.scheduledEndTime = new Date(
      session.scheduledEndTime.getTime() +
      pausedMinutes * 60 * 1000
    );

    session.status = "running";

    await session.save();

    return res.status(200).json({
      message: "Session resumed successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const extendsession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (
      session.status !== "running" &&
      session.status !== "paused"
    ) {
      return res.status(400).json({
        message:
          "Only active sessions can be extended",
      });
    }

    session.extendedHours += 1;
    session.totalHours += 1;

    session.extensions.push({
      hours: 1,
      addedAt: new Date(),
    });

    session.scheduledEndTime = new Date(
      session.scheduledEndTime.getTime() +
      60 * 60 * 1000
    );

    await session.save();

    return res.status(200).json({
      message: "Session extended by 1 hour",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const completesession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    if (session.status === "completed") {
      return res.status(400).json({
        message: "Session already completed",
      });
    }

    session.status = "completed";
    session.actualEndTime = new Date();
    await session.save();

    const existingInvoice = await Invoice.findOne({ session: id });
    if (!existingInvoice) {
      const settings = await PriceSetting.findOne();
      const kots = await KOT.find({ session: id }).sort({ createdAt: -1 });
      const calculation = await calculateInvoiceCharges({ session, settings, kots });
      let hoursBeforeSession = 0;
      if (calculation.membershipApplied) {
        hoursBeforeSession = Number(calculation.membership.remainingPlayHours);
        calculation.membership.usedPlayHours += calculation.totalHours;
        calculation.membership.remainingPlayHours -= calculation.totalHours;
        refreshStatus(calculation.membership);
        await calculation.membership.save();
      }
      const startTime = session.startTime ? new Date(session.startTime) : null;
      const actualDurationMinutes = startTime ? Math.max(0, Math.round((session.actualEndTime - startTime) / 60000)) : 0;
      const pointsPer100 = Number(settings?.loyaltyPointsPer100 ?? 10);
      const loyaltyPoints = Math.floor(calculation.grandTotal / 100) * pointsPer100;
      await Invoice.create({ invoiceNumber: `INV-${Date.now()}`, session: session._id,
        customer: { parentName: session.parentName, mobileNumber: session.mobileNumber, bandNumber: session.bandNumber, sessionNumber: session.sessionNumber },
        children: calculation.childCharges,
        sessionDetails: { startTime: session.startTime, endTime: session.actualEndTime, actualDurationMinutes, totalHours: calculation.totalHours, extensionHours: calculation.extensionHours, pauseTimeMinutes: session.totalPausedMinutes || 0 },
        cafeItems: calculation.cafeItems,
        charges: { sessionTotal: calculation.sessionTotal, cafeSubtotal: calculation.cafeSubtotal, cafeGST: calculation.cafeGST, cafeTotal: calculation.cafeTotal, grandTotal: calculation.grandTotal, loyaltyPoints, normalSessionTotal: calculation.normalSessionTotal, discountAmount: calculation.discountAmount, membershipPurchaseTotal: Number(calculation.membershipPurchase?.price || 0) },
        offer: { name: calculation.offer?.name || "", type: calculation.offer?.type || "", discountAmount: calculation.discountAmount, specialPricingApplied: calculation.specialPricingApplied },
        membership: { applied: calculation.membershipApplied, membership: calculation.membership?._id || null, planName: calculation.membership?.planName || "", hoursConsumed: calculation.membershipApplied ? calculation.totalHours : 0, hoursBeforeSession: calculation.membershipApplied ? hoursBeforeSession : 0, remainingHours: calculation.membershipApplied ? calculation.membership.remainingPlayHours : 0, expiryDate: calculation.membershipApplied ? calculation.membership.expiryDate : null, purchase: { planName: calculation.membershipPurchase?.planName || "", price: Number(calculation.membershipPurchase?.price || 0) } },
        payment: { status: session.paymentStatus || "pending", breakdown: session.paymentBreakdown || [], amountPaid: Number(session.amountPaid || 0), pendingAmount: Math.max(calculation.grandTotal - Number(session.amountPaid || 0), 0) },
      });
    }

    return res.status(200).json({
      message: "Session completed successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const runningsession = async (req, res) => {
  try {
    const sessions = await sessionmodel
      .find({
        status: {
          $in: ["running", "paused"],
        },
      })
      .populate("offer")
      .populate("membership")
      .sort({ startTime: -1 });

    const updatedSessions = sessions.map((session) => {
      const sessionObj = session.toObject();

      sessionObj.children = sessionObj.children.map((child) => ({
        ...child,
        isBirthdayToday: isBirthdayToday(child.dob),
      }));

      return sessionObj;
    });

    return res.status(200).json({
      message: "Running sessions fetched successfully",
      count: updatedSessions.length,
      sessions: updatedSessions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getSessionKOTs = async (
  req,
  res
) => {
  try {
    const kots = await KOT.find({
      session: req.params.sessionId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      count: kots.length,
      kots,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const searchBillingCustomer = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = await sessionmodel
      .find({
        status: {
          $in: ["completed"],
        },
        $or: [
          {
            parentName: {
              $regex: `^${escapedQuery}$`,
              $options: "i",
            },
          },
          {
            mobileNumber: q.trim(),
          }
        ],
      })
      .select("_id sessionNumber parentName mobileNumber bandNumber children reference notes createdAt")
      .sort({ createdAt: -1 });

    const mobileNumbers = [...new Set(matches.map((session) => session.mobileNumber))];
    const completedSessions = mobileNumbers.length
      ? await sessionmodel.find({ status: "completed", mobileNumber: { $in: mobileNumbers } }).select("_id mobileNumber").lean()
      : [];
    const invoices = completedSessions.length
      ? await Invoice.find({ session: { $in: completedSessions.map((session) => session._id) } }).select("session charges.grandTotal charges.loyaltyPoints").lean()
      : [];
    const sessionMobileById = new Map(completedSessions.map((session) => [String(session._id), session.mobileNumber]));
    const totalsByMobile = new Map(mobileNumbers.map((mobileNumber) => [mobileNumber, { visit_count: 0, total_spent: 0, reward_points: 0 }]));
    completedSessions.forEach((session) => { totalsByMobile.get(session.mobileNumber).visit_count += 1; });
    invoices.forEach((invoice) => {
      const totals = totalsByMobile.get(sessionMobileById.get(String(invoice.session)));
      if (totals) {
        totals.total_spent += Number(invoice.charges?.grandTotal || 0);
        totals.reward_points += Number(invoice.charges?.loyaltyPoints || 0);
      }
    });
    const customers = matches.reduce((uniqueCustomers, session) => {
      if (!uniqueCustomers.has(session.mobileNumber)) {
        uniqueCustomers.set(session.mobileNumber, { ...session.toObject(), ...(totalsByMobile.get(session.mobileNumber) || {}) });
      }
      return uniqueCustomers;
    }, new Map());

    return res.status(200).json({
      count: customers.size,
      customers: [...customers.values()],
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};


module.exports = {
  searchBillingCustomer, createsession, bookedsession, startsession, pausesession, resumesession, extendsession, completesession, runningsession, getSessionKOTs
};
