import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/useWallet";

export type BuyerNotificationType =
  | "prompt_update"
  | "purchase_receipt"
  | "security_alert"
  | "account_lifecycle"
  | "entitlement_update"
  | "support_access_notice";

export interface BuyerNotification {
  _id: string;
  recipientWallet: string;
  promptId: string;
  promptTitle: string;
  type: BuyerNotificationType;
  message: string;
  versionIndex: number;
  changeNote: string;
  read: boolean;
  /**
   * Present on alerts that ignore notification preferences. Optional so
   * responses from older server versions still parse.
   */
  mandatory?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UseBuyerNotifications {
  notifications: BuyerNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAllRead: () => void;
  clearAll: () => void;
  refetch: () => void;
}

const API_BASE = "/api/notifications";

export function useBuyerNotifications(): UseBuyerNotifications {
  const { address } = useWallet();
  const [notifications, setNotifications] = useState<BuyerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${address}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification: BuyerNotification) => !notification.read).length,
    [notifications],
  );

  const markAllRead = useCallback(async () => {
    if (!address) return;
    try {
      const response = await fetch(`${API_BASE}/${address}/mark-read`, {
        method: "POST",
      });
      if (response.ok) {
        setNotifications((current: BuyerNotification[]) =>
          current.map((notification: BuyerNotification) => ({ ...notification, read: true })),
        );
      }
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  }, [address]);

  const clearAll = useCallback(async () => {
    if (!address) return;
    try {
      const response = await fetch(`${API_BASE}/${address}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  }, [address]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAllRead,
    clearAll,
    refetch: fetchNotifications,
  };
}
