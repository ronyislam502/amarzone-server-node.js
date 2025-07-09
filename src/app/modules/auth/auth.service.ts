import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { User } from "../user/user.model";
import { TLoginUser } from "./auth.interface";
import { createToken, verifyToken } from "./auth.utilities";
import config from "../../config";
import bcrypt from "bcrypt";
import { JwtPayload } from "jsonwebtoken";
import { USER_STATUS } from "../user/user.const";
import sendEmail from "../../utilities/sendEmail";

const loginUserFromDB = async (payload: TLoginUser) => {
  const isUser = await User.isUserExistsByEmail(payload?.email);

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "This user is not found !");
  }

  const isDeleted = isUser?.isDeleted;
  if (isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "This user is deleted !");
  }

  if (!(await User.isPasswordMatched(payload?.password, isUser?.password))) {
    throw new AppError(httpStatus.FORBIDDEN, "Password do not matched");
  }
  const jwtPayload = {
    email: isUser.email,
    role: isUser.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.access_token_secret as string,
    config.access_token_expire_in as string
  );

  const refreshToken = createToken(
    jwtPayload,
    config.refresh_token_secret as string,
    config.refresh_token_expire_in as string
  );

  return {
    accessToken,
    user: isUser,
    refreshToken,
  };
};

const changePasswordIntoDB = async (
  userData: JwtPayload,
  payload: { oldPassword: string; newPassword: string }
) => {
  // checking if the user is exist
  const user = await User.isUserExistsByEmail(userData.email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "This user is not found!");
  }

  // checking if the user is blocked

  const userStatus = user?.status;

  if (userStatus === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "This user is suspended!");
  }

  //checking if the password is correct

  if (!(await User.isPasswordMatched(payload.oldPassword, user?.password)))
    throw new AppError(httpStatus.FORBIDDEN, "Password do not matched");

  //hash new password
  const newHashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  await User.findOneAndUpdate(
    {
      email: userData.email,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      passwordChangedAt: new Date(),
    }
  );

  return {
    message: "password change successfully",
  };
};

const refreshTokenFromDB = async (token: string) => {
  // checking if the given token is valid
  const decoded = verifyToken(
    token,
    config.refresh_token_secret as string
  ) as JwtPayload;

  const { email, iat } = decoded;

  // checking if the user is exist
  const user = await User.isUserExistsByEmail(email);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "This user is not found!");
  }

  // checking if the user is blocked
  const userStatus = user?.status;

  if (userStatus === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "This user is suspend!");
  }

  if (
    user.passwordChangedAt &&
    User.isJWTIssuedBeforePasswordChanged(user.passwordChangedAt, iat as number)
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized !");
  }

  const jwtPayload = {
    email: user?.email,
    role: user?.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.access_token_secret as string,
    config.access_token_expire_in as string
  );

  return {
    accessToken,
  };
};

const forgetPasswordFromDB = async (email: string) => {
  const isUser = await User.isUserExistsByEmail(email);

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isDelete = isUser.isDeleted;

  if (isDelete) {
    throw new AppError(httpStatus.FORBIDDEN, "this user is deleted");
  }

  const userStatus = isUser.status;
  if (userStatus === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "this user is blocked");
  }

  const jwtPayload = {
    email: isUser.email,
    role: isUser.role,
  };

  const resetToken = createToken(
    jwtPayload,
    config.access_token_secret as string,
    config.reset_pass_token_expire_in as string
  );

  const resetPassLink = `${config.reset_pass_link}?email=${isUser.email}&token=${resetToken}`;

  const emailHtml = `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: auto; background-color: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h2 style="color: #1e40af;">Reset Your Password</h2>
      <p>Dear ${isUser?.name},</p>
      <p>We received a request to reset your password. Click the button below to proceed:</p>
      <p style="text-align: center;">
        <a href="${resetPassLink}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p>If you didn’t request this, you can safely ignore this email.</p>
      <p>Thanks,<br/>The Support Team</p>
    </div>
  </div>
`;
  await sendEmail(isUser.email, emailHtml);

  console.log("reset", resetPassLink);
};

const resetPasswordFromDB = async (
  payload: { email: string; newPassword: string },
  token: string
) => {
  const isUser = await User.isUserExistsByEmail(payload.email);

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isDelete = isUser.isDeleted;

  if (isDelete) {
    throw new AppError(httpStatus.FORBIDDEN, "this user is deleted");
  }

  const userStatus = isUser.status;
  if (userStatus === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "this user is blocked");
  }

  const isTokenValid = verifyToken(token, config.access_token_secret as string);

  if (!isTokenValid) {
    throw new AppError(httpStatus.FORBIDDEN, "Forbidden!");
  }

  const hashPassword = await bcrypt.hash(
    payload.newPassword,
    Number(config.bcrypt_salt_rounds)
  );

  await User.findOneAndUpdate(
    {
      email: isTokenValid.email,
      role: isTokenValid.role,
    },
    {
      password: hashPassword,
      passwordChangedAt: new Date(),
    }
  );
};

export const AuthServices = {
  loginUserFromDB,
  changePasswordIntoDB,
  refreshTokenFromDB,
  forgetPasswordFromDB,
  resetPasswordFromDB,
};
