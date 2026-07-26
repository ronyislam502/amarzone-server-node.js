import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utilities/catchAsync";
import AppError from "../errors/AppError";
import { User } from "../modules/user/user.model";
import { USER_STATUS } from "../interface/common";

/**
 * Middleware to restrict suspended vendors from selling or modifying products/inventory.
 */

const checkVendorNotSuspended = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.email) {
      throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const user = await User.isUserExistsByEmail(req.user.email);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your vendor account is currently suspended from selling or modifying inventory."
      );
    }

    next();
  }
);

export default checkVendorNotSuspended;
