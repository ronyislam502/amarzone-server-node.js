import { Types } from "mongoose";

export type TCategory = {
  department: Types.ObjectId;
  name: string;
  isDeleted: Boolean
};
