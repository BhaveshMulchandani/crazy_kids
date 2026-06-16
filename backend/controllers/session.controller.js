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

    return res.status(200).json({
      message: "Booked sessions fetched successfully",
      count: sessions.length,
      sessions,
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

    return res.status(200).json({
      message: "Running sessions fetched successfully",
      count: sessions.length,
      sessions,
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


module.exports = {
  createsession,bookedsession,startsession,pausesession,resumesession,extendsession,completesession,runningsession,getSessionKOTs
};