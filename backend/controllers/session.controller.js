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
const Notification = require('../models/notification.model');
const { getNextFormattedNumber } = require('../services/counter.service');

const membershipChildKey = (child) => `${String(child.name || "").trim().toLowerCase()}|${new Date(child.dob).toISOString().slice(0, 10)}`;

const createsession = async (
  req,
  res
) => {
  try {
    const {
      parentName,
      mobileNumber,
      area,
      city,
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

    if (!/^\d{10}$/.test(mobileNumber.trim())) {
      return res.status(400).json({
        message:
          "Mobile number must be exactly 10 digits",
      });
    }

    if (!area?.trim()) {
      return res.status(400).json({
        message:
          "Area is required",
      });
    }

    if (!city?.trim()) {
      return res.status(400).json({
        message:
          "City is required",
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

    const GENDER_VALUES = ["boy", "girl", "not_specified"];

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
          gender: GENDER_VALUES.includes(child.gender)
            ? child.gender
            : "not_specified",
          socksOpted: Boolean(child.socksOpted),
        };
      });

    // countDocuments()+1 is not concurrency-safe — two bookings arriving
    // close together can both read the same count before either insert
    // lands, generating the same sessionNumber and crashing on the unique
    // index. getNextFormattedNumber() reserves the number atomically.
    const sessionNumber = await getNextFormattedNumber({
      name: "sessionNumber",
      model: sessionmodel,
      field: "sessionNumber",
      prefix: "CK-",
      padLength: 5,
    });

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

        area:
          area.trim(),

        city:
          city.trim(),

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

    session.children.forEach((child) => {
      child.timer.status = "running";
      child.timer.scheduledEndTime = session.scheduledEndTime;
      child.timer.pauseHistory = [];
      child.timer.totalPausedMinutes = 0;
    });

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

    const pausedAt = new Date();

    session.pauseHistory.push({
      pausedAt,
    });

    // Cascade to every child that isn't already individually paused —
    // a main pause must pause everyone, but a child already paused on
    // their own keeps their own pause entry (no double-pausing).
    session.children.forEach((child) => {
      if (child.timer.status === "running") {
        child.timer.pauseHistory.push({ pausedAt });
        child.timer.status = "paused";
      }
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

    // Main resume brings every child back, even one that was paused
    // individually before the main pause kicked in.
    session.children.forEach((child) => {
      if (child.timer.status === "paused") {
        const childLastPause = child.timer.pauseHistory[child.timer.pauseHistory.length - 1];
        if (childLastPause && !childLastPause.resumedAt) {
          childLastPause.resumedAt = resumedAt;
          const childPausedMinutes = Math.ceil((resumedAt - childLastPause.pausedAt) / (1000 * 60));
          child.timer.totalPausedMinutes += childPausedMinutes;
          if (child.timer.scheduledEndTime) {
            child.timer.scheduledEndTime = new Date(child.timer.scheduledEndTime.getTime() + childPausedMinutes * 60 * 1000);
          }
        }
        child.timer.status = "running";
      }
    });

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

const pauseChild = async (req, res) => {
  try {
    const { id, index } = req.params;
    const childIndex = Number(index);

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status !== "running") {
      return res.status(400).json({ message: "Only children in a running session can be paused" });
    }

    const child = session.children[childIndex];
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    if (child.timer.status !== "running") {
      return res.status(400).json({ message: "Child is not running" });
    }

    child.timer.pauseHistory.push({ pausedAt: new Date() });
    child.timer.status = "paused";

    await session.save();

    return res.status(200).json({
      message: "Child paused successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const resumeChild = async (req, res) => {
  try {
    const { id, index } = req.params;
    const childIndex = Number(index);

    const session = await sessionmodel.findById(id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (session.status !== "running") {
      return res.status(400).json({ message: "Only children in a running session can be resumed" });
    }

    const child = session.children[childIndex];
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    if (child.timer.status !== "paused") {
      return res.status(400).json({ message: "Child is not paused" });
    }

    const lastPause = child.timer.pauseHistory[child.timer.pauseHistory.length - 1];
    if (!lastPause || !lastPause.pausedAt) {
      return res.status(400).json({ message: "Invalid pause history" });
    }

    const resumedAt = new Date();
    lastPause.resumedAt = resumedAt;

    const pausedMinutes = Math.ceil((resumedAt - lastPause.pausedAt) / (1000 * 60));
    child.timer.totalPausedMinutes += pausedMinutes;

    if (child.timer.scheduledEndTime) {
      child.timer.scheduledEndTime = new Date(child.timer.scheduledEndTime.getTime() + pausedMinutes * 60 * 1000);
    }

    child.timer.status = "running";

    await session.save();

    return res.status(200).json({
      message: "Child resumed successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

    session.children.forEach((child) => {
      if (child.timer.scheduledEndTime) {
        child.timer.scheduledEndTime = new Date(child.timer.scheduledEndTime.getTime() + 60 * 60 * 1000);
      }
    });

    // The session is no longer overdue now that its end time has moved
    // forward — allow the watcher to notify again if it becomes overdue
    // later, and clear any "waiting for checkout" notification already
    // raised for it.
    session.overdueNotified = false;

    await session.save();
    await Notification.updateMany(
      { session: session._id, resolved: false },
      { resolved: true, read: true }
    );

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
    const { extraDiscount } = req.body || {};

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
    await Notification.updateMany(
      { session: session._id, resolved: false },
      { resolved: true, read: true }
    );

    const existingInvoice = await Invoice.findOne({ session: id });
    if (!existingInvoice) {
      const settings = await PriceSetting.findOne();
      const kots = await KOT.find({ session: id }).sort({ createdAt: -1 });
      const calculation = await calculateInvoiceCharges({ session, settings, kots, extraDiscount });
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
      // Date.now() collides if two sessions complete within the same
      // millisecond, crashing checkout on the unique invoiceNumber index.
      // Shares the same atomic "invoiceNumber" sequence as
      // invoice.controller.js:createInvoice so neither path can collide
      // with the other.
      const invoiceNumber = await getNextFormattedNumber({
        name: "invoiceNumber",
        model: Invoice,
        field: "invoiceNumber",
        prefix: "INV-",
        padLength: 5,
      });
      try {
        await Invoice.create({ invoiceNumber, session: session._id,
          customer: { parentName: session.parentName, mobileNumber: session.mobileNumber, bandNumber: session.bandNumber, sessionNumber: session.sessionNumber, area: session.area || "", city: session.city || "" },
          children: calculation.childCharges,
          sessionDetails: { startTime: session.startTime, endTime: session.actualEndTime, actualDurationMinutes, totalHours: calculation.totalHours, extensionHours: calculation.extensionHours, pauseTimeMinutes: session.totalPausedMinutes || 0 },
          cafeItems: calculation.cafeItems,
          charges: { sessionTotal: calculation.sessionTotal, cafeSubtotal: calculation.cafeSubtotal, cafeGST: calculation.cafeGST, cafeTotal: calculation.cafeTotal, grandTotal: calculation.grandTotal, loyaltyPoints, normalSessionTotal: calculation.normalSessionTotal, discountAmount: calculation.discountAmount, extraDiscountAmount: calculation.extraDiscountAmount, membershipPurchaseTotal: Number(calculation.membershipPurchase?.price || 0), socksQty: calculation.socksQty, socksRate: calculation.socksRate, socksTotal: calculation.socksTotal },
          offer: { name: calculation.offer?.name || "", type: calculation.offer?.type || "", discountAmount: calculation.discountAmount, specialPricingApplied: calculation.specialPricingApplied },
          membership: { applied: calculation.membershipApplied, membership: calculation.membership?._id || null, planName: calculation.membership?.planName || "", hoursConsumed: calculation.membershipApplied ? calculation.totalHours : 0, hoursBeforeSession: calculation.membershipApplied ? hoursBeforeSession : 0, remainingHours: calculation.membershipApplied ? calculation.membership.remainingPlayHours : 0, expiryDate: calculation.membershipApplied ? calculation.membership.expiryDate : null, purchase: { planName: calculation.membershipPurchase?.planName || "", price: Number(calculation.membershipPurchase?.price || 0) } },
          payment: { status: session.paymentStatus || "pending", breakdown: session.paymentBreakdown || [], amountPaid: Number(session.amountPaid || 0), pendingAmount: Math.max(calculation.grandTotal - Number(session.amountPaid || 0), 0) },
        });
      } catch (invoiceError) {
        // A concurrent/duplicate checkout request already created the
        // invoice for this session (caught here by the unique index on
        // Invoice.session) — the session is completed either way, so this
        // isn't a failure the operator needs to see.
        if (invoiceError.code !== 11000) throw invoiceError;
      }
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

// Always the latest N (default 5) completed sessions, sorted by when they
// actually ended — used by the desk "Recently closed" panel, which must
// reflect the real checkout history rather than only sessions completed
// during the current browser tab's lifetime.
const recentCompletedSessions = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const sessions = await sessionmodel
      .find({ status: "completed" })
      .sort({ actualEndTime: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const sessionIds = sessions.map((session) => session._id);
    const invoices = await Invoice.find({ session: { $in: sessionIds } })
      .select("session invoiceNumber charges.grandTotal")
      .lean();
    const invoiceMap = new Map(invoices.map((invoice) => [String(invoice.session), invoice]));

    const result = sessions.map((session) => {
      const invoice = invoiceMap.get(String(session._id));

      return {
        _id: session._id,
        parentName: session.parentName,
        mobileNumber: session.mobileNumber,
        children: session.children,
        closed_at: session.actualEndTime,
        invoice_no: invoice?.invoiceNumber || "",
        invoiceData: invoice ? { charges: invoice.charges } : null,
      };
    });

    return res.status(200).json({
      message: "Recently completed sessions fetched successfully",
      count: result.length,
      sessions: result,
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
      .select("_id sessionNumber parentName mobileNumber area city bandNumber children reference notes createdAt")
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
    // `matches` is sorted newest-first, so the first session seen per
    // mobile number is kept as the customer's profile. But that latest
    // visit may have left an optional field (area, city, band number)
    // blank even though an earlier visit had it on file — backfill from
    // those older sessions rather than surfacing a blank value when a
    // saved one exists elsewhere in the customer's history.
    const customers = matches.reduce((uniqueCustomers, session) => {
      if (!uniqueCustomers.has(session.mobileNumber)) {
        uniqueCustomers.set(session.mobileNumber, { ...session.toObject(), ...(totalsByMobile.get(session.mobileNumber) || {}) });
      } else {
        const existing = uniqueCustomers.get(session.mobileNumber);
        if (!existing.area && session.area) existing.area = session.area;
        if (!existing.city && session.city) existing.city = session.city;
        if (!existing.bandNumber && session.bandNumber) existing.bandNumber = session.bandNumber;
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
  searchBillingCustomer, createsession, bookedsession, startsession, pausesession, resumesession, extendsession, completesession, runningsession, recentCompletedSessions, getSessionKOTs, pauseChild, resumeChild
};
