const settingModel = require('../models/price.model')

const getSettings = async (req, res) => {
  try {
    let settings = await settingModel.findOne();

    if (!settings) {
      settings = await settingModel.create({});
    }

    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const {
      firstHourUnder3,
      extensionUnder3,
      firstHourAbove3,
      extensionAbove3,
      socksCost,
      loyaltyPointsPer100,
    } = req.body;

    let settings = await settingModel.findOne();

    if (!settings) {
      settings = await settingModel.create({});
    }

    settings.firstHourUnder3 = firstHourUnder3;
    settings.extensionUnder3 = extensionUnder3;
    settings.firstHourAbove3 = firstHourAbove3;
    settings.extensionAbove3 = extensionAbove3;
    settings.socksCost = socksCost;
    settings.loyaltyPointsPer100 = loyaltyPointsPer100;

    await settings.save();

    return res.status(200).json({
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {getSettings,updateSettings}