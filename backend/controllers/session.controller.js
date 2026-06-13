const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDiff =
    today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

const sessionmodel = require("../models/session.model");

const createsession = async (req, res) => {
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

    // Required validations

    if (!parentName || !mobileNumber) {
      return res.status(400).json({
        message:
          "Parent name and mobile number are required",
      });
    }

    if (!children || children.length === 0) {
      return res.status(400).json({
        message: "At least one child is required",
      });
    }

    // Child validation + age calculation

    const processedChildren = children.map(
      (child) => {
        if (!child.name || !child.dob) {
          throw new Error(
            "Child name and DOB are required"
          );
        }

        return {
          name: child.name,
          dob: child.dob,
          age: calculateAge(child.dob),
        };
      }
    );

    // Session Number

    const count =
      (await sessionmodel.countDocuments()) + 1;

    const sessionNumber = `CK-${String(
      count
    ).padStart(5, "0")}`;

    const session = await sessionmodel.create({
      sessionNumber,

      parentName,
      mobileNumber,

      bandNumber: bandNumber || "",

      children: processedChildren,

      offer: offer || null,

      reference: reference || "",

      socksRequired:
        socksRequired ?? false,

      notes: notes || "",

      status: "booked",
    });

    return res.status(201).json({
      message:
        "Session created successfully",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {createsession}