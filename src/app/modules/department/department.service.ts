import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { TDepartment } from "./department.interface";
import { Department } from "./department.model";

const createDepartmentIntoDB = async (payload: TDepartment) => {

    const result = await Department.create(payload);

    return result;
}

const allDepartmentsFromDB = async () => {
    const result = await Department.find();

    return result
}

const updateDepartmentIntoDB = async (id: string, payload: Partial<TDepartment>) => {
    const isDepartmentExists = await Department.findById(id);

    if (!isDepartmentExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this Department not found")
    };

    const result = await Department.findByIdAndUpdate(isDepartmentExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
}


export const DepartmentServices = {
    createDepartmentIntoDB,
    updateDepartmentIntoDB,
    allDepartmentsFromDB
}