import { TDepartment } from "./department.interface";
import { Department } from "./department.model";

const createDepartmentIntoDB = async (payload: TDepartment) => {
  const result = await Department.create(payload);

  return result;
};

const allDepartmentsFromDB = async () => {
  const result = await Department.find();

  return result;
};

const updateDepartmentIntoDB = async (
  id: string,
  payload: Partial<TDepartment>
) => {
  const result = await Department.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

export const DepartmentServices = {
  createDepartmentIntoDB,
  allDepartmentsFromDB,
  updateDepartmentIntoDB,
};
