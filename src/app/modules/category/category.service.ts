import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { TCategory } from "./category.interface";
import { Category } from "./category.model";
import { Department } from "../department/department.model";
import QueryBuilder from "../../builder/queryBuilder";

const createCategoryIntoDB = async (payload: TCategory) => {
  const isDepartment = await Department.findById(payload?.department);

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const result = await Category.create(payload);

  return result;
};

const AllCategoriesFromDB = async (query: Record<string, unknown>) => {
  const categoryQuery = new QueryBuilder(
    Category.find().populate("department"),
    query
  )
    .search(["name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await categoryQuery.countTotal();
  const data = await categoryQuery.modelQuery;

  return { meta, data };
};

const singleCategoryFromDB = async (id: string) => {
  const isCategory = await Category.findById(id).populate("department");

  if (!isCategory) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  return isCategory;
};

const allCategoriesByDepartmentFromDB = async (
  id: string,
  query: Record<string, unknown>
) => {
  const isDepartment = await Department.findById(id);

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const categoryQuery = new QueryBuilder(
    Category.find({ department: isDepartment._id }).populate("department"),
    query
  )
    .search(["name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await categoryQuery.countTotal();
  const data = await categoryQuery.modelQuery;

  return { meta, data };
};

const updateCategoryIntoDB = async (
  id: string,
  payload: Partial<TCategory>
) => {
  const isCategory = await Category.findById(id);

  if (!isCategory) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  const result = await Category.findByIdAndUpdate(isCategory._id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

export const CategoryServices = {
  createCategoryIntoDB,
  AllCategoriesFromDB,
  singleCategoryFromDB,
  allCategoriesByDepartmentFromDB,
  updateCategoryIntoDB,
};
