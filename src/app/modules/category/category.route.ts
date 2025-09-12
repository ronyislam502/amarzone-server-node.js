import { Router } from "express";
import { CategoryControllers } from "./category.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { CategoryValidations } from "./category.validation";

const router = Router();

router.post(
  "/create-category",
  validateRequest(CategoryValidations.createCategoryValidationSchema),
  CategoryControllers.createCategory
);

router.get("/", CategoryControllers.allCategories);

router.get("/department/:id", CategoryControllers.allCategoriesByDepartment);

router.patch("/update/:id", CategoryControllers.updateCategory);

export const CategoryRoutes = router;
