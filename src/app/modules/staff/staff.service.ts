import QueryBuilder from "../../builder/queryBuilder";
import { UserSearchableFields } from "../../utilities/const";
import { Staff } from "./staff.model";

const getAllStaffsFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(Staff.find(), query)
    .search(UserSearchableFields)
    .fields()
    .paginate()
    .sort()
    .filter();

  const meta = await userQuery.countTotal();
  const data = await userQuery.modelQuery;

  return {
    meta,
    data,
  };
};

const singleStaffFromDB = async (id: string) => {
  const result = await Staff.findById(id);

  return result;
};

export const StaffServices = {
  getAllStaffsFromDB,
  singleStaffFromDB,
};
