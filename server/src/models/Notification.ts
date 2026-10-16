import mongoose from "mongoose";

/**
 * Notification types split into two delivery classes:
 *
 *  - Optional  (`prompt_update`, `purchase_receipt`) — suppressed when the
 *    recipient has turned the type off in their notification preferences.
 *  - Mandatory (`security_alert`, `account_lifecycle`, `entitlement_update`,
 *    `support_access_notice`) — lifecycle/security alerts that must stay
 *    deliverable regardless of preferences, and are audited on delivery.
 *
 * Keep `MANDATORY_NOTIFICATION_TYPES` in `notificationPreferences.ts` as the
 * single source of truth for routing; this enum only bounds persisted values.
 */
export type NotificationType =
  | "prompt_update"
  | "purchase_receipt"
  | "security_alert"
  | "account_lifecycle"
  | "entitlement_update"
  | "support_access_notice";

export const NOTIFICATION_TYPES: NotificationType[] = [
  "prompt_update",
  "purchase_receipt",
  "security_alert",
  "account_lifecycle",
  "entitlement_update",
  "support_access_notice",
];

/**
 * Delivery-class policy — the single source of truth for routing:
 *  - Mandatory alerts ignore preferences and are always persisted + audited.
 *  - Optional notifications are suppressed when the recipient opted out.
 */
export const MANDATORY_NOTIFICATION_TYPES: NotificationType[] = [
  "security_alert",
  "account_lifecycle",
  "entitlement_update",
  "support_access_notice",
];

export const OPTIONAL_NOTIFICATION_TYPES: NotificationType[] = NOTIFICATION_TYPES.filter(
  (type) => !MANDATORY_NOTIFICATION_TYPES.includes(type),
);

export function isMandatoryNotificationType(type: string): type is NotificationType {
  return (MANDATORY_NOTIFICATION_TYPES as string[]).includes(type);
}

const notificationSchema = new mongoose.Schema(
  {
    recipientWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    // Prompt context is optional so lifecycle/security alerts that are not
    // tied to a listing can use the same durable collection. Existing
    // `prompt_update` writers still populate all three fields.
    promptId: {
      type: String,
      default: "",
      index: true,
    },
    promptTitle: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
    },
    message: {
      type: String,
      required: true,
    },
    versionIndex: {
      type: Number,
      default: 0,
    },
    changeNote: {
      type: String,
      default: "",
    },
    // True for security/lifecycle alerts that ignore preferences. Stored so
    // incident review can distinguish mandatory deliveries from optional ones.
    mandatory: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Stable identity of the underlying event (e.g. `support_access:<grantId>`).
    // Unique when present so retries/duplicate projections deliver exactly once.
    dedupeKey: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientWallet: 1, read: 1, createdAt: -1 });
notificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
