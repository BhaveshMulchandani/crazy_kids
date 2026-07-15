const Notification = require("../models/notification.model");

const listPending = async (req, res) => {
  try {
    const notifications = await Notification.find({ resolved: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.status(200).json({
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch notifications" });
  }
};

const markRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ notification });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update notification" });
  }
};

module.exports = { listPending, markRead };
