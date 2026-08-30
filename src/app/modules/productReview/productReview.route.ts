import { Router } from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";
import { USER_ROLE } from "../../interface/common";
import { ProductReviewControllers } from "./productReview.controller";
import { ProductReviewValidations } from "./productReview.validation";

const router = Router();

router.post(
  "/create-review",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(ProductReviewValidations.createProductReviewValidationSchema),
  ProductReviewControllers.createProductReview
);

router.patch(
  "/update/:id",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(ProductReviewValidations.updateProductReviewValidationSchema),
  ProductReviewControllers.updateProductReview
);

router.delete(
  "/:id",
  auth(USER_ROLE.CUSTOMER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  ProductReviewControllers.deleteProductReview
);


router.get("/:id", ProductReviewControllers.getSingleProductReview);



export const ProductReviewRoutes = router;
