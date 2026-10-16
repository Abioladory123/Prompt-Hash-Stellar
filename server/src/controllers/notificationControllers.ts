import { Request, Response } from "express";
import connectDb from "../db/connectDb";
import Notification from "../models/Notification";
import {
  NotificationPreferenceError,
  getEffectivePreferences,
  updateNotificationPreferences,
  type PreferencePatch,
} from "../services/notificationPreferences";
import { MANDATORY_NOTIFICATION_TYPES, OPTIONAL_NOTIFICATION_TYPES } from "../models/Notification";

export const GetNotifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    const notifications = await Notification.find({
      recipientWallet: walletAddress.toLowerCase(),
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(notifications);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const GetUnreadCount = async (req: Request, res: Response): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    const count = await Notification.countDocuments({
      recipientWallet: walletAddress.toLowerCase(),
      read: false,
    });

    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const MarkAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    await Notification.updateMany(
      {
        recipientWallet: walletAddress.toLowerCase(),
        read: false,
      },
      { read: true }
    );

    return res.json({ message: "Notifications marked as read." });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const ClearNotifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    await Notification.deleteMany({
      recipientWallet: walletAddress.toLowerCase(),
    });

    return res.json({ message: "Notifications cleared." });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

/**
 * GET /api/notifications/:walletAddress/preferences
 * Effective notification preferences plus the type policy, so clients can
 * render which alerts are configurable and which are mandatory.
 */
export const GetNotificationPreferences = async (req: Request, res: Response): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    const preferences = await getEffectivePreferences(walletAddress);
    return res.json({
      preferences,
      optionalTypes: OPTIONAL_NOTIFICATION_TYPES,
      mandatoryTypes: MANDATORY_NOTIFICATION_TYPES,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};

/**
 * PUT /api/notifications/:walletAddress/preferences
 * Body: { preferences: { <optionalType>: { inApp?: boolean, email?: boolean } } }
 * Mandatory lifecycle/security types are rejected — they are always routed.
 */
export const UpdateNotificationPreferences = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    await connectDb();
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required." });
    }

    const patch = (req.body?.preferences ?? req.body) as PreferencePatch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return res.status(400).json({ error: "preferences object is required." });
    }

    const preferences = await updateNotificationPreferences(walletAddress, patch, {
      requestId: req.correlationId ?? null,
    });

    return res.json({
      preferences,
      optionalTypes: OPTIONAL_NOTIFICATION_TYPES,
      mandatoryTypes: MANDATORY_NOTIFICATION_TYPES,
    });
  } catch (err) {
    if (err instanceof NotificationPreferenceError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
};
