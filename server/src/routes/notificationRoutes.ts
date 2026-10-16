import express from "express";
import {
  GetNotifications,
  GetUnreadCount,
  MarkAsRead,
  ClearNotifications,
  GetNotificationPreferences,
  UpdateNotificationPreferences,
} from "../controllers/notificationControllers";

export const notificationRouter = express.Router();

// Preference routes are registered before the generic wallet routes for
// clarity; Express only matches `/:walletAddress` for a single path segment,
// so `/x/preferences` never falls through to the notifications list.
notificationRouter.get(
  "/:walletAddress/preferences",
  GetNotificationPreferences,
);
notificationRouter.put(
  "/:walletAddress/preferences",
  UpdateNotificationPreferences,
);

notificationRouter.get("/:walletAddress", GetNotifications);
notificationRouter.get("/:walletAddress/unread-count", GetUnreadCount);
notificationRouter.post("/:walletAddress/mark-read", MarkAsRead);
notificationRouter.delete("/:walletAddress", ClearNotifications);
