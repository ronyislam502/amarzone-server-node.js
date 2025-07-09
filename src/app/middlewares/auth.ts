import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utilities/catchAsync";
import { TUserRole } from "../modules/user/user.interface";
import AppError from "../errors/AppError";
import config from "../config";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../modules/user/user.model";

const auth = (...requiredRoles: TUserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;

    // checking if the token is missing
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    // checking if the given token is valid
    const decoded = jwt.verify(
      token,
      config.access_token_secret as string
    ) as JwtPayload;

    const { role, email, iat } = decoded;

    // checking if the user is exist
    const user = await User.isUserExistsByEmail(email);

    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "This user is not found !");
    }
    // checking if the user is already deleted

    const isDeleted = user?.isDeleted;

    if (isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, "This user is deleted !");
    }

    if (
      user.passwordChangedAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangedAt,
        iat as number
      )
    ) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized !");
    }

    // checking if the user is blocked

    if (requiredRoles && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    req.user = decoded as JwtPayload;
    next();
  });
};

export default auth;
