import { model, Schema } from "mongoose";
import { TAddress, TVendor, VendorModel } from "./vendor.interface";

export const addressSchema = new Schema<TAddress>({
  street: {
    type: String,
    required: true,
  },
  house: {
    type: String,
    required: true,
  },
  sector: {
    type: String,
    required: true,
  },
  area: {
    type: String,
    required: true,
  },
  postalCode: {
    type: String,
    required: true,
  },
  district: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
});

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
      //validate email
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
    avatar: {
      type: String,
      default: "",
    },
    isShopped: {
      type: Boolean,
      default: false,
    },
    isCreateProduct: {
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
