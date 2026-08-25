import { Router } from "express";
import { CustomerControllers } from "./customer.controller";

const router = Router();

router.get("/", CustomerControllers.allCustomers)

router.delete("/delete/:id", CustomerControllers.deleteCustomer)


export const CustomerRoutes = router