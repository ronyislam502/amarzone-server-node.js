import { Router } from "express";
import { RankingControllers } from "./ranking.controller";

const router = Router();

// Best Selling Product Variants Endpoints:
// - Global best selling variants across entire marketplace
router.get("/best-selling-products", RankingControllers.bestSellingProductsVariants);

// - Best selling variants within a specific Department
router.get("/best-selling-department/:departmentId", RankingControllers.bestSellingDepartmentProductsVariants);

// - Best selling variants within a specific Category
router.get("/best-selling-category/:categoryId", RankingControllers.bestSellingCategoryProductsVariants);

// Unified Variant Ranking API:
// Call using Variant ID (or ASIN) to retrieve all ranking details
router.get("/:id", RankingControllers.getRanking);

export const RankingRoutes = router;
