import { Model, Types } from "mongoose";
import { USER_ROLE, USER_STATUS } from "../../interface/common";

export type TUserRole = keyof typeof USER_ROLE;


export type TAddress = {
    street: string;
    postalCode: string;
    state: string;
    country: string;
}

export type TUser = {
    name: string;
    email: string;
    password: string;
    role: TUserRole;
    status: keyof typeof USER_STATUS;
    passwordChangedAt?: Date;
    isDeleted: boolean;
}


export interface UserModel extends Model<TUser> {
    //instance methods for checking if the user exist
    isUserExistsByEmail(email: string): Promise<(TUser & { _id: Types.ObjectId }) | null>;
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