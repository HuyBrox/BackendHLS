import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import Follow from "../models/follow.model.js";

//[GET] /api/notification
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ receiver: req.userId })
            .populate("sender", "_id username fullname profilePicture")
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        return res.status(500).json({ msg: error.message });
    }
}
//[PATCH] /api/notification/:notificationId/read
export const readNotification = async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        await Notification.findOneAndUpdate({ _id: notificationId }, { isRead: true });
        res.json({
            message: "Đã đọc thông báo",
            success: true,
        });
    }
    catch (error) {
        return res.status(500).json({ msg: error.message });
    }
}