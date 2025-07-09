import { model, Schema } from "mongoose";
import { TDepartment } from "./department.interface";

const DepartmentSchema = new Schema<TDepartment>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,
    },
  },
  { timestamps: true }
);

export const Department = model<TDepartment>("Department", DepartmentSchema);
