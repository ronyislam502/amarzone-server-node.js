import { model, Schema } from "mongoose";
import { Gender, TAddress } from "../../utilities/const";
import { StaffModel, TStaff } from "./staff.interface";
import { addressSchema } from "../admin/admin.model";

const staffSchema=new Schema<TStaff, StaffModel>({
    user: {
      type: Schema.Types.ObjectId,
      required: [true, "User id is required"],
      unique: true,
      ref: "User",
    },
    name:{
        type:String,
        required:[true, "Name is required"]
    },
    email:{
      type: String,
      required:[ true, "E-mail is required"],
      unique: true,
    },
    designation:{
        type:String,
        required:[true, "Designation is required"]
    },
    gender:{
        type: String,
        enum: Object.keys(Gender),
        required: [true, "Role is required"],
    },
    avatar:{
        type: String,
        default:""
    },
    phone:{
        type: String,
        required: [true,"Phone is required"],
    },
    nidNo:{
        type: String,
        required:[true, "NIDNO is required"],
        unique:true
    },
    nidImg:[
      {
        type: String,
        required: [true, 'nidImg is required'],
        default: '',
      },
    ],
    dateOfBirth:{
        type: Date
    },
    presentAddress:{
        type:addressSchema,
        required:[true, "Present address is required"]
    },
    permanentAddress:{
        type:addressSchema,
        required:[true, "Permanent address is required"]
    }
},{
    timestamps:true
});

staffSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

staffSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

staffSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

staffSchema.statics.isUserExists = async function (email: string) {
  const existingUser = await Staff.findOne({ email });

  return existingUser;
};

export const Staff = model<TStaff, StaffModel>("Admin", staffSchema);
