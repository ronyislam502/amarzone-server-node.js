import { model, Schema } from "mongoose";
import { TCategory } from "./category.interface";

const CategorySchema = new Schema<TCategory>(
  {
    department: {
      type: Schema.Types.ObjectId,
      required: [true, "Department is required"],
      ref: "Department",
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      unique: true,
    },
  },
  { timestamps: true }
);

export const Category = model<TCategory>("Category", CategorySchema);
