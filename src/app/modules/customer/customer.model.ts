import { model, Schema } from "mongoose";
import { CustomerModel, TCustomer } from "./customer.interface";
import { addressSchema } from "../vendor/vendor.model";

const customerSchema = new Schema<TCustomer, CustomerModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      required: [true, "User id is required"],
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
    avatar: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
    },
    address: {
      type: addressSchema,
      required: [true, "address is required"],
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

customerSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

customerSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

customerSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

customerSchema.statics.isUserExists = async function (email: string) {
  const existingUser = await Customer.findOne({ email });

  return existingUser;
};

export const Customer = model<TCustomer, CustomerModel>(
  "Customer",
  customerSchema
);
