import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AuthServices } from "./auth.service";
import config from "../../config";
import AppError from "../../errors/AppError";

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUserFromDB(req.body);

  const { accessToken, user, refreshToken } = result;

  res.cookie("refreshToken", refreshToken, {
    secure: config.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",

    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { ...passwordData } = req.body;

  const result = await AuthServices.changePasswordIntoDB(
    req.user,
    passwordData
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password updated successfully!",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.cookies;
  const result = await AuthServices.refreshTokenFromDB(refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Access token retrieved successfully!",
    data: result,
  });
});

const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthServices.forgetPasswordFromDB(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Please check your email",
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const token = req.headers.authorization;

  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, "Something went wrong !");
  }

  const result = await AuthServices.resetPasswordFromDB(
    req.body,
    token as string
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully!",
    data: result,
  });
});

export const AuthControllers = {
  loginUser,
  changePassword,
  refreshToken,
  forgetPassword,
  resetPassword,
};
