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

const bestSellingProductsVariants = catchAsync(async (req, res) => {
    const result = await RankingServices.bestSellingProductsVariantsFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Best selling product variants retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const bestSellingDepartmentProductsVariants = catchAsync(async (req, res) => {
    const { departmentId, id } = req.params;
    const targetDeptId = departmentId || id;
    const result = await RankingServices.bestSellingDepartmentProductsVariantsFrom(targetDeptId, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Best selling department product variants retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const bestSellingCategoryProductsVariants = catchAsync(async (req, res) => {
    const { categoryId, id } = req.params;
    const targetCatId = categoryId || id;
    const result = await RankingServices.bestSellingCategoryProductsVariantsFrom(targetCatId, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Best selling category product variants retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

export const RankingControllers = {
    getRanking,
    bestSellingProductsVariants,
    bestSellingDepartmentProductsVariants,
    bestSellingCategoryProductsVariants,
};
