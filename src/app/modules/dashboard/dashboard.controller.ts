import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DashboardServices } from "./dashboard.service";
import { JwtPayload } from "jsonwebtoken";

const getDashboardStatistics = catchAsync(async (req, res) => {
  const result = await DashboardServices.statisticsDashboardDataFromDB(
    req.user as JwtPayload,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard statistics retrieved successfully",
    data: result,
  });
});

export const DashboardControllers = {
  getDashboardStatistics,
};
