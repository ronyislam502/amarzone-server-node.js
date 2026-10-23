import { Router } from "express";
import { CustomerControllers } from "./customer.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { CustomerValidations } from "./customer.validation";

const router = Router();

router.get("/", CustomerControllers.allCustomers);

router.patch(
    "/update/:id",
    validateRequest(CustomerValidations.updateCustomerValidationSchema),
    CustomerControllers.updateCustomer
);

router.delete("/delete/:id", CustomerControllers.deleteCustomer);

export const CustomerRoutes = router;