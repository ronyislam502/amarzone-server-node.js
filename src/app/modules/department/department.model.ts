import { model, Schema } from "mongoose";
import { TDepartment } from "./department.interface";

const departmentSchema = new Schema<TDepartment>(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            unique: true,
        },
    },
    { timestamps: true }
);

export const Department = model<TDepartment>("Department", departmentSchema);