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