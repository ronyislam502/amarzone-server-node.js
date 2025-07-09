export const USER_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  VENDOR: "VENDOR",
  CUSTOMER: "CUSTOMER",
} as const;

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
} as const;

export const UserSearchableFields = [
  "name",
  "email",
  "phone",
  "role",
  "status",
];
