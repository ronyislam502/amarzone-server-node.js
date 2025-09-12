import { model, Schema } from "mongoose";
import { TShop } from "./shop.interface";

const shopSchema = new Schema<TShop>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      unique: true,
      ref: "Vendor",
    },
    shopName: {
      type: String,
      required: true,
      unique: true,
    },
    shopEmail: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      //validate email
      match: [
        /^([\w-.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        "Please fill a valid email address",
      ],
    },
    shopPhone: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    logo: {
      type: String,
      default: "",
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Shop = model<TShop>("Shop", shopSchema);
