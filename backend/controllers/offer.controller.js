const offermodel = require("../models/offer.model");

// Shared by create and update so both routes enforce identical rules.
// Returns an error message string, or null when the payload is valid.
const validateOfferPayload = ({ name, type, value, rules }) => {
  if (!name || !type) {
    return "Name and type are required";
  }

  const allowedTypes = [
    "membership",
    "discount",
    "flat_discount",
    "special_pricing",
  ];

  if (!allowedTypes.includes(type)) {
    return "Invalid offer type";
  }

  if (type === "membership") {
    if (
      !value ||
      !rules?.kidsAllowed ||
      !rules?.playHours ||
      !rules?.validityMonths
    ) {
      return "Please fill all membership fields";
    }
  }

  if (type === "discount") {
    if (!value || !rules?.minKids) {
      return "Discount percentage and minimum kids are required";
    }
  }

  if (type === "flat_discount") {
    if (!value || !rules?.minKids) {
      return "Discount amount and minimum kids are required";
    }
  }

  if (type === "special_pricing") {
    if (!rules?.day || !rules?.firstHourPrice || !rules?.nextHourPrice) {
      return "Please fill all pricing fields";
    }
  }

  if (Number(value) < 0 || (type === "discount" && Number(value) > 100)) {
    return "Offer value is invalid";
  }

  return null;
};

const createOffer = async (req, res) => {
  try {
    const { name, description, type, value, rules, active } = req.body;

    const validationError = validateOfferPayload({ name, type, value, rules });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const offer = await offermodel.create({
      name,
      description,
      type,
      value,
      rules,
      active,
    });

    return res.status(201).json({
      message: "Offer created successfully",
      offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getoffer = async (req, res) => {
  try {
    const offers = await offermodel
      .find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: offers.length,
      offers,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getactiveoffers = async (req, res) => {
  try {
    const offers = await offermodel
      .find({ active: true })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: offers.length,
      offers,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const toggleoffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await offermodel.findById(id);

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    offer.active = !offer.active;

    await offer.save();

    return res.status(200).json({
      message: `Offer ${
        offer.active ? "activated" : "deactivated"
      } successfully`,
      offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateoffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, value, rules } = req.body;

    const offer = await offermodel.findById(id);

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    const validationError = validateOfferPayload({ name, type, value, rules });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    offer.name = name;
    offer.description = description ?? "";
    offer.type = type;
    offer.value = value;
    offer.rules = rules;

    await offer.save();

    return res.status(200).json({
      message: "Offer updated successfully",
      offer,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteoffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await offermodel.findById(id);

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    await offermodel.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Offer deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createOffer,
  getoffer,
  getactiveoffers,
  toggleoffer,
  updateoffer,
  deleteoffer,
};
