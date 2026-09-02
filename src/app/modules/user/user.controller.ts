import httpStatus from "http-status";
import { TImageFile, TImageFiles } from "../../interface/image.interface";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { UserServices } from "./user.service";


// const getAllUsers = catchAsync(async (req, res) => {
//     const result = await UserServices.getAllUsersFromDB(req.query);

//     sendResponse(res, {
//         statusCode: httpStatus.OK,
//         success: true,
//         message: "Users fetched successfully",
//         meta: result.meta,
//         data: result.result
//     });
// });

export const UserControllers = {
    // getAllUsers
}