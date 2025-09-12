import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { StaffServices } from "./staff.service";

const allStaffs = catchAsync(async (req, res) => {
  const result = await StaffServices.getAllStaffsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Staffs retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const singleStaff = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await StaffServices.singleStaffFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Staff retrieved successfully",
    data: result,
  });
});

export const StaffControllers = {
  allStaffs,
  singleStaff,
};
