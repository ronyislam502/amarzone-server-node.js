import { model, Schema } from "mongoose";
import { TDepartment } from "./department.interface";

const departmentSchema = new Schema<TDepartment>(
    {
        name: {
            type: String,
            required: [true, "Title is required"],
            unique: true,
        },
        icon: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

departmentSchema.pre("find", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

departmentSchema.pre("findOne", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

departmentSchema.pre("aggregate", function (next) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    next();
});

export const Department = model<TDepartment>("Department", departmentSchema)