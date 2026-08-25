import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";
import AppError from "../../errors/AppError";
import { TImageFile } from "../../interface/image.interface";
import { TDepartment } from "./department.interface";
import { Department } from "./department.model";


const createDepartmentIntoDB = async (icon: TImageFile, payload: TDepartment) => {

    if (icon && icon.path) {
        payload.icon = icon.path;
    }

    const result = await Department.create(payload);

    return result;

}

const allDepartmentsFromDB = async (query: Record<string, unknown>) => {
    const departmentsQuery = new QueryBuilder(Department.find(), query)
        .search(["name"])
        .filter()
        .sort()
        .paginate()
        .fields()

    const meta = await departmentsQuery.countTotal();
    const data = await departmentsQuery.modelQuery;

    return { meta, data }
}


const updateDepartmentIntoDB = async (id: string, icon: TImageFile, payload: Partial<TDepartment>) => {
    const isDepartmentExists = await Department.findById(id);

    if (!isDepartmentExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this Department not found")
    };

    if (icon && icon.path) {
        payload.icon = icon.path;
    }

    const result = await Department.findByIdAndUpdate(isDepartmentExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
}

export const DepartmentServices = {
    createDepartmentIntoDB,
    allDepartmentsFromDB,
    updateDepartmentIntoDB
}