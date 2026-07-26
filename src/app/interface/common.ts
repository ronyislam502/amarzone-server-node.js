export const USER_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  VENDOR: "VENDOR",
  CUSTOMER: "CUSTOMER",
} as const;

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
  SUSPENDED: "SUSPENDED",
} as const;

export const ORDER_STATUS = {
  PENDING: "PENDING",
  UNSHIPPED: "UNSHIPPED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  OUT_OF_DELIVERY: "OUT_OF_DELIVERY",
  REFUNDED: "REFUNDED",
  COMPLETE: "COMPLETE",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  UNPAID: "UNPAID",
  REFUNDED: "REFUNDED",
} as const;

export const VENDOR_HEALTH = {
  HEALTHY: "HEALTHY",
  AT_RISK: "AT_RISK",
  CRITICAL: "CRITICAL",
  SUSPENDED: "SUSPENDED",
} as const;

export const FRAUD_STATUS = {
  SAFE: "SAFE",
  PENDING: "PENDING",
  INVESTIGATING: "INVESTIGATING",
  CONFIRMED: "CONFIRMED",
  CLEARED: "CLEARED",
} as const;

export const SLA_SEVERITY = {
  WARNING: "Warning",
  SUSPENSION: "Suspension",
} as const;

export const SLA_METRIC = {
  ORDER_DEFECT_RATE: "Order Defect Rate",
  LATE_SHIPMENT_RATE: "Late Shipment Rate",
  CANCELLATION_RATE: "Cancellation Rate",
  VALID_TRACKING_RATE: "Valid Tracking Rate",
} as const;

export const SOCKET_EVENTS = {
  ADMIN_ROOM: "ADMIN",
  SLA_WARNING: "sla-warning",
  SLA_SUSPENDED: "sla-suspended",
  SLA_RESOLVED: "sla-resolved",
  FRAUD_ALERT_CREATED: "fraudAlertCreated",
  FRAUD_ALERT_UPDATED: "fraudAlertUpdated",
  FRAUD_STATUS_CHANGED: "fraudStatusChanged",
  FRAUD_RESOLVED: "fraudResolved",
  BUY_BOX_UPDATED: "buy-box-updated",
  BEST_SELLER_UPDATED: "best-seller-updated",
  CATEGORY_BEST_SELLER_UPDATED: "category-best-seller-updated",
} as const;
