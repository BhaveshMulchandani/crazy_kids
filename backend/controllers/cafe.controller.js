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

// Edits an existing order in place — quantity/notes changes, item removals,
// and new items added to the same KOT (not a new order/kotNumber). Nothing
// downstream of this (calculateFoodCharge on the frontend,
// calculateInvoiceCharges at checkout) caches cafe totals anywhere — both
// always re-sum straight from the KOT documents, so correctly mutating this
// document is the entire fix; no billing code elsewhere needs to change.
const updateKOT = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        message: "items must be an array",
      });
    }

    const kot = await cafemodel.findById(req.params.id);

    if (!kot) {
      return res.status(404).json({
        message: "KOT not found",
      });
    }

    // A KOT with zero items can't exist (mirrors createKOT's "at least one
    // item" rule) — the sensible meaning of editing every item away is that
    // the whole order goes away, not a saved order with nothing in it.
    if (items.length === 0) {
      await cafemodel.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        message: "Order removed — no items remained",
        deleted: true,
      });
    }

    const existingById = new Map(
      kot.items.map((item) => [String(item._id), item])
    );

    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const quantity = item.quantity || 1;
      const existing = item._id ? existingById.get(String(item._id)) : null;

      // An already-existing item keeps its originally-charged price — an
      // edited quantity shouldn't retroactively re-price the line if the
      // menu price has since changed. Only a genuinely new item looks up
      // the menu's current price, exactly like createKOT does.
      let name;
      let price;
      let menuItemId;
      if (existing) {
        name = existing.name;
        price = existing.price;
        menuItemId = existing.menuItem;
      } else {
        const menuItem = await menumodel.findById(item.menuItem);
        if (!menuItem) {
          return res.status(404).json({
            message: "Menu item not found",
          });
        }
        name = menuItem.name;
        price = menuItem.price;
        menuItemId = menuItem._id;
      }

      const itemTotal = price * quantity;
      totalAmount += itemTotal;

      processedItems.push({
        _id: existing?._id,
        menuItem: menuItemId,
        name,
        price,
        quantity,
        notes: item.notes || "",
        total: itemTotal,
      });
    }

    kot.items = processedItems;
    kot.totalAmount = totalAmount;
    await kot.save();

    return res.status(200).json({
      message: "Order updated successfully",
      kot,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

// Removes an entire order — e.g. the whole KOT was placed against the wrong
// session/table. Cafe order data for every other KOT on the session is
// untouched.
const deleteKOT = async (req, res) => {
  try {
    const kot = await cafemodel.findByIdAndDelete(req.params.id);

    if (!kot) {
      return res.status(404).json({
        message: "KOT not found",
      });
    }

    return res.status(200).json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {searchCustomer,createKOT,getKOT,getSessionKOTs,updateKOT,deleteKOT}
