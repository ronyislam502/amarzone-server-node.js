import { model, Schema } from "mongoose";
import { TCreatedBy, TProduct } from "./product.interface";
import { USER_ROLE } from "../user/user.const";

const CreatedBySchema = new Schema<TCreatedBy>({
  role: {
    type: String,
    enum: Object.keys(USER_ROLE),
    default: USER_ROLE.ADMIN,
    required: true,
  },
  id: {
    type: Schema.Types.ObjectId,
    ref: "Vendor",
  },
  name: {
    type: String,
    required: true,
  },
});

const ProductSchema = new Schema<TProduct>(
  {
    createdBy: {
      type: CreatedBySchema,
      required: [true, "Category is required"],
    },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "department is required"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    asin: {
      type: String,
      required: [true, "asin must be string"],
      unique: true,
    },
    title: {
      type: String,
      required: [true, "title must be string"],
    },
    description: {
      type: String,
      required: [true, "Description must be string"],
    },
    images: [
      {
        type: String,
        default: "",
      },
    ],
    brand: {
      type: String,
      required: true,
    },
    isCreatedByVendor: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ProductSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

ProductSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

ProductSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

export const Product = model<TProduct>("Product", ProductSchema);
