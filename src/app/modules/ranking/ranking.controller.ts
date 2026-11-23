import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { RankingServices } from "./ranking.service";

const getRanking = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await RankingServices.getUnifiedRankingFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Variant ranking details retrieved successfully",
        data: result,
    });
});

export const RankingControllers = {
    getRanking,
};
