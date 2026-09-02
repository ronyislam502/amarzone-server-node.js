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
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    OUT_OF_DELIVERY: "OUT_OF_DELIVERY",
    REFUNDED: "REFUNDED",
} as const;

export const PAYMENT_STATUS = {
    PENDING: "PENDING",
    PAID: "PAID",
    UNPAID: "UNPAID",
    REFUNDED: "REFUNDED",
} as const;

export const CONVERSATION_TYPE = {
    NORMAL: "NORMAL",
    ORDER: "ORDER",
    DISPUTE: "DISPUTE",
    SUPPORT: "SUPPORT",
} as const;

export const MESSAGE_TYPE = {
    TEXT: "TEXT",
    IMAGE: "IMAGE",
    VIDEO: "VIDEO",
    FILE: "FILE",
} as const;

export const MESSAGE_STATUS = {
    SENT: "SENT",
    DELIVERED: "DELIVERED",
    READ: "READ",
} as const;