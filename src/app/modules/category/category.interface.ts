import { Types } from "mongoose";

export type TCategory = {
  department: Types.ObjectId;
  title: string;
};
