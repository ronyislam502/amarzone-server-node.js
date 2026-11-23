import { Router } from "express";
import { RankingControllers } from "./ranking.controller";

const router = Router();

// Unified Variant Ranking API:
// Call using Variant ID (or ASIN) to retrieve all ranking details:
// - Global Rank (across entire marketplace)
// - Department Rank & Department Name
// - Category Rank & Category Name
// - Parent Product & Variant information
router.get("/:id", RankingControllers.getRanking);

export const RankingRoutes = router;
