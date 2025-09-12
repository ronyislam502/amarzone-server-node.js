export const USER_ROLE = {
  SUPER_ADMIN:"SUPER_ADMIN",
  ADMIN: "ADMIN",
  STAFF:"STAFF",
  USER: "USER",
  AGENT:"AGENT"
} as const;

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED",
} as const;

export const Gender ={
  MALE: "MALE",
  FEMALE: "FEMALE",
} as const;

export type TAddress = {
  Village: string;
  postOffice:string;
  postalCode?: string;
  policeStation: string;
  district: string;
  division:string;
  country: string;
};

export const UserSearchableFields = [
  "name",
  "email",
  "phone",
  "role",
  "status",
];

export const adminSearchableFields = ["name", "email", "phone"];
