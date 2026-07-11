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
          offer || null,

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

      const children = Array.isArray(session.children) ? session.children : [];
      const totalHours = Number(session.totalHours || 1);
      const extensionHours = Math.max(totalHours - 1, 0);
      const pauseTimeMinutes = Number(session.totalPausedMinutes || 0);
      const startTime = session.startTime ? new Date(session.startTime) : null;
      const endTime = session.actualEndTime ? new Date(session.actualEndTime) : null;
      const actualDurationMinutes = startTime && endTime
        ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
        : 0;

      const childCharges = children.map((child) => {
        const age = Number(child?.age ?? 0);
        const isUnder3 = age < 3;
        const firstHourRate = isUnder3
          ? Number(settings?.firstHourUnder3 ?? 0)
          : Number(settings?.firstHourAbove3 ?? 0);
        const extensionRate = isUnder3
          ? Number(settings?.extensionUnder3 ?? 0)
          : Number(settings?.extensionAbove3 ?? 0);
        const childTotal = firstHourRate + Math.max(totalHours - 1, 0) * extensionRate;

        return {
          name: child?.name || "",
          dob: child?.dob || null,
          age,
          firstHourCharge: firstHourRate,
          extensionHours,
          extensionRate,
          childTotal,
        };
      });

      const cafeItems = (kots || []).flatMap((kot) => (kot?.items || []).map((item) => ({
        name: item?.name || "",
        quantity: Number(item?.quantity || 1),
        unitPrice: Number(item?.price || 0),
        lineTotal: Number(item?.total || 0),
      })));
      const sessionTotal = childCharges.reduce((sum, child) => sum + Number(child.childTotal || 0), 0);
      const cafeTotal = cafeItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
      const grandTotal = sessionTotal + cafeTotal;
      const pointsPer100 = Number(settings?.loyaltyPointsPer100 ?? 10);
      const loyaltyPoints = Math.floor(Number(grandTotal || 0) / 100) * pointsPer100;

      await Invoice.create({
        invoiceNumber: `INV-${Date.now()}`,
        session: session._id,
        customer: {
          parentName: session.parentName || "",
          mobileNumber: session.mobileNumber || "",
          bandNumber: session.bandNumber || "",
          sessionNumber: session.sessionNumber || "",
        },
        children: childCharges,
        sessionDetails: {
          startTime: session.startTime || null,
          endTime: session.actualEndTime || null,
          actualDurationMinutes,
          totalHours,
          extensionHours,
          pauseTimeMinutes,
        },
        cafeItems,
        charges: {
          sessionTotal,
          cafeTotal,
          grandTotal,
          loyaltyPoints,
        },
        payment: {
          status: session.paymentStatus || "pending",
          breakdown: Array.isArray(session.paymentBreakdown)
            ? session.paymentBreakdown.map((entry) => ({
                method: entry?.method || "cash",
                amount: Number(entry?.amount || 0),
              }))
            : [],
          amountPaid: Number(session.amountPaid || 0),
          pendingAmount: Math.max(grandTotal - Number(session.amountPaid || 0), 0),
        },
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

    const customers = await sessionmodel
      .find({
        status: {
          $in: ["completed"],
        },
        $or: [
          {
            parentName: {
              $regex: `^${q.trim()}$`,
              $options: "i",
            },
          },
          {
            mobileNumber: q.trim(),
          }
        ],
      })
      .select(
        "_id sessionNumber parentName mobileNumber bandNumber children reference notes"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: customers.length,
      customers,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};


module.exports = {
  searchBillingCustomer,createsession, bookedsession, startsession, pausesession, resumesession, extendsession, completesession, runningsession, getSessionKOTs
};