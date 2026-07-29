const cafemodel = require("../models/cafe.model");
const menumodel = require("../models/menu.model");
const sessionmodel = require("../models/session.model");
const { getNextFormattedNumber } = require("../services/counter.service");
const { buildCustomerNameOr } = require("../utils/customerSearch");

const searchCustomer = async (req, res) => {
  try {
    const q = req.query.q?.trim();

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const customers = await sessionmodel
      .find({
        status: {
          $in: ["running", "paused"],
        },
        $or: [
          ...buildCustomerNameOr(q, { exact: true }),
          {
            mobileNumber: q,
          },
          {
            bandNumber: q,
          },
          {
            sessionNumber: q,
          },
        ],
      })
      .select(
        "_id sessionNumber parentName mobileNumber bandNumber children"
      );

    return res.status(200).json({
      sessions: customers,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const createKOT = async (req, res) => {
  try {

    const {
      sessionId,
      tableNumber,
      items,
    } = req.body;

    console.log("after",req.body)

    if (!sessionId) {
      return res.status(400).json({
        message: "Session is required",
      });
    }

    if (!tableNumber?.trim()) {
      return res.status(400).json({
        message: "Table Number is required.",
      });
    }

    if (!items?.length) {
      return res.status(400).json({
        message:
          "At least one item is required",
      });
    }

    const session =
      await sessionmodel.findById(
        sessionId
      );

      console.log(session)

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    let totalAmount = 0;

    const processedItems = [];

    for (const item of items) {
      const menuItem =
        await menumodel.findById(item.menuItem);

      if (!menuItem) {
        return res.status(404).json({
          message: `Menu item not found`,
        });
      }

      const quantity =
        item.quantity || 1;

      const itemTotal =
        menuItem.price * quantity;

      totalAmount += itemTotal;

      processedItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        notes: item.notes || "",
        total: itemTotal,
      });
    }

    // countDocuments()+1 is not concurrency-safe — two cafe orders placed
    // close together can both read the same count before either insert
    // lands, generating the same kotNumber and crashing on its unique index.
    const kotNumber = await getNextFormattedNumber({
      name: "kotNumber",
      model: cafemodel,
      field: "kotNumber",
      prefix: "KOT-",
      padLength: 5,
    });

    const kot = await cafemodel.create({
      kotNumber,
      session: sessionId,
      tableNumber,
      items: processedItems,
      totalAmount,
    });

    return res.status(201).json({
      message:
        "KOT created successfully",
      kot,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const getKOT = async (req, res) => {
  try {
    const kot = await cafemodel.findById(
      req.params.id
    )
      .populate("session")
      .populate("items.menuItem");

    if (!kot) {
      return res.status(404).json({
        message: "KOT not found",
      });
    }

    return res.status(200).json(kot);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const getSessionKOTs = async (
  req,
  res
) => {
  try {
    const kots = await cafemodel.find({
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

module.exports = {searchCustomer,createKOT,getKOT,getSessionKOTs}
