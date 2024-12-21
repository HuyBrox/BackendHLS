import {
    getNotifications,
    readNotification
} from "../controllers/notification.controller.js";

import isAuth from "../middlewares/isAuth.middleware.js";
import { isIdObj } from "../middlewares/isIdObj.js";
import express from "express";
const router = express.Router();

router.get("/", isAuth, getNotifications);
router.patch("/:notificationId/read", isAuth, isIdObj("notificationId"), readNotification);

export default router;