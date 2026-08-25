import httpStatus from "http-status";
import sendResponse from "../../utilities/sendResponse";
import { CategoryServices } from "./category.service";
import catchAsync from "./../../utilities/catchAsync";

const createCategory = catchAsync(async (req, res) => {
  const result = await CategoryServices.createCategoryIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const allCategories = catchAsync(async (req, res) => {
  const result = await CategoryServices.AllCategoriesFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const singleCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CategoryServices.singleCategoryFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category retrieved successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CategoryServices.updateCategoryIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const allCategoriesByDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await CategoryServices.allCategoriesByDepartmentFromDB(
    id,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Department by Categories retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const CategoryControllers = {
  createCategory,
  allCategories,
  singleCategory,
  updateCategory,
  allCategoriesByDepartment,
};
