import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Department } from "../department/department.model";
import { TCategory } from "./category.interface";
import { Category } from "./category.model";

const createCategoryIntoDB = async (payload: TCategory) => {
  const isDepartment = await Department.findById(payload?.department);

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const result = await Category.create(payload);

  return result;
};

const AllCategoriesFromDB = async () => {
  const result = await Category.find().populate("department");

  return result;
};

const allCategoriesByDepartmentFromDB = async (id: string) => {
  const isDepartment = await Department.findById(id);

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const result = await Category.find({ department: isDepartment._id }).populate(
    "department"
  );

  return result;
};

const updateCategoryIntoDB = async (
  id: string,
  payload: Partial<TCategory>
) => {
  const isCategory = await Category.findById(id);

  if (!isCategory) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  const isDepartment = isCategory.department;

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
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
  allCategoriesByDepartmentFromDB,
  updateCategoryIntoDB,
};
