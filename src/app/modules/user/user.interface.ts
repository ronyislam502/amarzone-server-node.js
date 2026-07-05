/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { Model } from "mongoose";
import { USER_ROLE, USER_STATUS } from "../../interface/common";

export type TAddress = {
  street: string;
  postalCode: string;
  state: string;
  country: string;
};

export type TUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: keyof typeof USER_ROLE;
  status: keyof typeof USER_STATUS;
  passwordChangedAt?: Date;
  isDeleted: boolean;
};

export interface UserModel extends Model<TUser> {
  //instance methods for checking if the user exist
  isUserExistsByEmail(email: string): Promise<TUser>;
  //instance methods for checking if passwords are matched
  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string
  ): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number
  ): boolean;
}

export type TUserRole = keyof typeof USER_ROLE;
