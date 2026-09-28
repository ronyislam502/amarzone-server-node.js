/**
 * Artificial Intelligence Module Validation Schemas
 *
 * Enforces strict input validation using Zod for all AI endpoints.
 */

import { z } from "zod";
import { DASHBOARD_FOCUS_AREAS } from "./ai.constant";

// ==========================================
// 1. PRODUCT CONTENT GENERATOR VALIDATION
// ==========================================

const productSpecificationSchema = z.object({
  key: z.string({ required_error: "Specification key is required" }).min(1),
  value: z.string({ required_error: "Specification value is required" }).min(1),
});

const generateProductContentValidationSchema = z.object({
  body: z
    .object({
      imageUrl: z.string().optional(),
      image: z.string().optional(),
      title: z
        .string()
        .min(2, "Product title must be at least 2 characters")
        .max(300, "Product title cannot exceed 300 characters")
        .optional(),
      category: z
        .string()
        .min(2, "Category name must be at least 2 characters")
        .optional(),
      brand: z.string().min(1, "Brand name is required").optional(),
      features: z
        .union([
          z.array(z.string().min(1)).min(1, "At least one feature is required"),
          z.string().min(3, "Features description must be at least 3 characters"),
        ])
        .optional(),
      specifications: z
        .union([z.record(z.any()), z.array(productSpecificationSchema)])
        .optional(),
      targetAudience: z.string().max(200).optional(),
      tone: z.string().max(50).optional(),
      keywords: z.array(z.string().min(1)).optional(),
    })
    .refine(
      (data) => {
        // If image is supplied, manual text inputs are completely optional
        if (data.imageUrl || data.image) {
          return true;
        }
        // Otherwise, enforce existing required text fields
        return Boolean(data.title && data.category && data.brand && data.features);
      },
      {
        message:
          "Either a product image or required product information (title, category, brand, features) must be provided.",
        path: ["title"],
      }
    ),
});

// ==========================================
// 2. SHOPPING ASSISTANT VALIDATION
// ==========================================

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1, "Message content cannot be empty"),
  name: z.string().optional(),
});

const shoppingAssistantValidationSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: "Message is required" })
      .min(1, "Message cannot be empty")
      .max(2000, "Message cannot exceed 2000 characters"),
    chatHistory: z.array(chatMessageSchema).max(20).optional(),
    context: z
      .object({
        category: z.string().optional(),
        budget: z.number().positive().optional(),
        currency: z.string().optional(),
        preferredBrands: z.array(z.string()).optional(),
        userPreferences: z.record(z.any()).optional(),
        currentProductId: z.string().optional(),
      })
      .optional(),
    filters: z
      .object({
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().positive().optional(),
        brand: z.string().optional(),
        category: z.string().optional(),
        rating: z.number().min(0).max(5).optional(),
      })
      .optional(),
  }),
});

// ==========================================
// 3. EXECUTIVE DASHBOARD INSIGHTS VALIDATION
// ==========================================

const dashboardInsightsValidationSchema = z.object({
  body: z.object({
    stats: z
      .record(z.any(), { required_error: "Dashboard statistics are required" })
      .refine(
        (val) => Object.keys(val).length > 0,
        "Dashboard statistics payload cannot be empty"
      ),
    timeframe: z
      .enum(["daily", "weekly", "monthly", "yearly", "custom"])
      .optional()
      .default("monthly"),
    focusArea: z
      .enum([
        DASHBOARD_FOCUS_AREAS.ALL,
        DASHBOARD_FOCUS_AREAS.REVENUE,
        DASHBOARD_FOCUS_AREAS.OPERATIONS,
        DASHBOARD_FOCUS_AREAS.VENDOR_PERFORMANCE,
        DASHBOARD_FOCUS_AREAS.CUSTOMER_SATISFACTION,
      ])
      .optional()
      .default(DASHBOARD_FOCUS_AREAS.ALL),
    comparisonTimeframe: z.string().optional(),
  }),
});

// ==========================================
// 4. FUTURE CAPABILITY VALIDATIONS
// ==========================================

const semanticSearchValidationSchema = z.object({
  body: z.object({
    query: z.string().min(2, "Search query must be at least 2 characters"),
    category: z.string().optional(),
    topK: z.number().int().positive().max(50).optional().default(10),
    minScore: z.number().min(0).max(1).optional().default(0.7),
  }),
});

const reviewModerationValidationSchema = z.object({
  body: z.object({
    reviewText: z.string().min(1, "Review text cannot be empty"),
    rating: z.number().min(1).max(5),
    productTitle: z.string().optional(),
  }),
});

const fraudAnalysisValidationSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    orderAmount: z.number().positive(),
    paymentMethod: z.string().min(1),
    shippingAddress: z.record(z.any()),
    billingAddress: z.record(z.any()),
    recentAttemptsCount: z.number().int().nonnegative().optional(),
  }),
});

export const AiValidation = {
  generateProductContentValidationSchema,
  shoppingAssistantValidationSchema,
  dashboardInsightsValidationSchema,
  semanticSearchValidationSchema,
  reviewModerationValidationSchema,
  fraudAnalysisValidationSchema,
};
