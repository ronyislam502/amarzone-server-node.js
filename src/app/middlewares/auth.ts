import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utilities/catchAsync";
import { TUserRole } from "../modules/user/user.interface";
import AppError from "../errors/AppError";
import config from "../config";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../modules/user/user.model";
import { USER_STATUS } from "../interface/common";

const auth = (...requiredRoles: TUserRole[]) => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        let token =
            req.headers.authorization ||
            req.cookies?.accessToken ||
            req.cookies?.token ||
            (req.headers.token as string) ||
            (req.headers["x-access-token"] as string);

        // Strip Bearer prefix if present
        if (token && typeof token === "string") {
            if (token.startsWith("Bearer ") || token.startsWith("bearer ")) {
                token = token.slice(7).trim();
            }
        }

        // checking if the token is missing or an invalid placeholder
        if (!token || token === "undefined" || token === "null" || (typeof token === "string" && token.trim() === "")) {
            throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
        }

        // checking if the given token is valid
        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(
                token as string,
                config.access_token_secret as string
            ) as JwtPayload;
        } catch {
            throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
        }

        const { role, email, iat } = decoded;

        // checking if the user exists
        const user = await User.isUserExistsByEmail(email);

        if (!user) {
            throw new AppError(httpStatus.NOT_FOUND, "This user is not found !");
        }

        // checking if the user is already deleted
        const isDeleted = user?.isDeleted;
        if (isDeleted) {
            throw new AppError(httpStatus.FORBIDDEN, "This user is deleted !");
        }

        // checking if the user is blocked
        if (user?.status === USER_STATUS.BLOCKED) {
            throw new AppError(httpStatus.FORBIDDEN, "This user is blocked !");
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

        if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(role)) {
            throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
        }

        req.user = decoded as JwtPayload;
        next();
    });
};

export default auth;

