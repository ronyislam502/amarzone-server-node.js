import { model, Schema } from "mongoose";
import { TVendor, VendorModel } from "./vendor.interface";
import { addressSchema } from "../user/user.model";


const VendorSchema = new Schema<TVendor, VendorModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      unique: true,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      match: [
        /^([\w-.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        "Please fill a valid email address",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
    },
    address: {
      type: addressSchema,
      required: [true, "address is required"],
    },
    logo: {
      type: String,
      default: "",
    },
    banner: {
      type: String,
      default: "",
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

VendorSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

VendorSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

VendorSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

VendorSchema.statics.isUserExists = async function (email: string) {
  const existingUser = await Vendor.findOne({ email });

  return existingUser;
};

export const Vendor = model<TVendor, VendorModel>("Vendor", VendorSchema);
