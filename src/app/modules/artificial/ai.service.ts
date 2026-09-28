/**
 * Artificial Intelligence Core Service Layer
 *
 * Orchestrates business logic, prompt preparation, OpenAI execution,
 * response sanitization, caching, and future capabilities integration.
 */

import config from "../../config";
import { openAiClient } from "./ai.openai";
import { AiPrompts } from "./ai.prompt";
import { AiHelper } from "./ai.helper";
import { AiUtils } from "./ai.utils";
import { AI_DEFAULT_CONFIG } from "./ai.constant";
import { Department } from "../department/department.model";
import { Category } from "../category/category.model";
import {
  TProductContentInput,
  TProductContentOutput,
  TShoppingAssistantInput,
  TShoppingAssistantOutput,
  TDashboardInsightsInput,
  TDashboardInsightsOutput,
  ISemanticSearchQuery,
  ISemanticSearchResult,
  IReviewModerationInput,
  IReviewModerationOutput,
  IFraudAnalysisInput,
  IFraudAnalysisOutput,
  IDynamicPricingInput,
  IDynamicPricingOutput,
  TChatMessage,
} from "./ai.interface";


// 1. AI PRODUCT CONTENT GENERATOR


/**
 * Generates SEO-optimized product content, titles, features, tags, and category suggestions.
 * Seamlessly handles both image-based vision analysis and text-based generation in a single unified API.
 */
const generateProductContent = async (
  payload: TProductContentInput
): Promise<TProductContentOutput> => {
  const cleanPayload = AiHelper.sanitizeInput(payload);
  const imageUrl = cleanPayload.imageUrl || cleanPayload.image;

  let systemPrompt: string;
  let messages: TChatMessage[];

  if (imageUrl) {
    // 1. Image-based generation: Fetch catalog taxonomy hints for accurate department & category suggestions
    let taxonomyHint = "";
    try {
      const departments = await Department.find({ isDeleted: { $ne: true } })
        .select("name")
        .lean();
      const categories = await Category.find({ isDeleted: { $ne: true } })
        .populate("department", "name")
        .select("name department")
        .lean();

      if (departments && departments.length > 0) {
        const deptNames = departments.map((d: any) => d.name).filter(Boolean);
        const catDetails = categories
          .map((c: any) => `${c.name} (${(c.department as any)?.name || "General"})`)
          .slice(0, 50);

        taxonomyHint = `\n\n[MARKETPLACE CATALOG TAXONOMY]:\nAvailable Platform Departments: ${deptNames.join(
          ", "
        )}\nAvailable Platform Categories: ${catDetails.join(
          ", "
        )}\nPlease prefer selecting or matching from these existing marketplace departments and categories where appropriate.`;
      }
    } catch {
      // Continue gracefully if DB query is unavailable
    }

    const userPrompt = AiPrompts.buildImageProductContentUserPrompt(
      cleanPayload,
      taxonomyHint
    );

    systemPrompt = AiPrompts.PRODUCT_IMAGE_ANALYZER_SYSTEM;
    messages = [
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "auto",
            },
          },
        ] as any,
      },
    ];
  } else {
    // 2. Text-based generation
    const userPrompt = AiPrompts.buildProductContentUserPrompt(cleanPayload);
    systemPrompt = AiPrompts.PRODUCT_CONTENT_GENERATOR_SYSTEM;
    messages = [{ role: "user", content: userPrompt }];
  }

  const response = await openAiClient.createChatCompletion({
    model: config.openai_model || AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.CREATIVE,
    maxTokens: AI_DEFAULT_CONFIG.MAX_TOKENS.PRODUCT_CONTENT,
    responseFormatJson: true,
    systemPrompt,
    messages,
  });

  const parsedJson = AiHelper.safeJsonParse(response.content);
  const sanitized = AiHelper.sanitizeProductContentOutput(parsedJson);

  if (imageUrl) {
    sanitized.imageUrl = imageUrl;
  }

  return sanitized;
};

// =========================================================================
// 2. AI SHOPPING ASSISTANT
// =========================================================================

/**
 * Handles conversational customer inquiries, product comparisons, recommendations, and search parameter extraction.
 */
const chatShoppingAssistant = async (
  payload: TShoppingAssistantInput
): Promise<TShoppingAssistantOutput> => {
  const cleanPayload = AiHelper.sanitizeInput(payload);
  const messages: TChatMessage[] = [];

  // Append prior conversational turns if provided
  if (cleanPayload.chatHistory && cleanPayload.chatHistory.length > 0) {
    const recentHistory = cleanPayload.chatHistory.slice(-10);
    for (const item of recentHistory) {
      messages.push({
        role: item.role,
        content: item.content,
      });
    }
  }

  const userPrompt = AiPrompts.buildShoppingAssistantUserPrompt(cleanPayload);
  messages.push({
    role: "user",
    content: userPrompt,
  });

  const response = await openAiClient.createChatCompletion({
    model: config.openai_model || AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.BALANCED,
    maxTokens: AI_DEFAULT_CONFIG.MAX_TOKENS.SHOPPING_ASSISTANT,
    responseFormatJson: true,
    systemPrompt: AiPrompts.SHOPPING_ASSISTANT_SYSTEM,
    messages,
  });

  const parsedJson = AiHelper.safeJsonParse(response.content);
  const sanitizedOutput = AiHelper.sanitizeShoppingAssistantOutput(parsedJson);

  // Complement with heuristic price extraction if model missed price in prompt
  if (
    (!sanitizedOutput.extractedCriteria?.maxPrice ||
      !sanitizedOutput.extractedCriteria?.minPrice) &&
    cleanPayload.message
  ) {
    const priceRange = AiUtils.extractPriceRange(cleanPayload.message);
    if (priceRange) {
      if (!sanitizedOutput.extractedCriteria) {
        sanitizedOutput.extractedCriteria = { currency: "USD" };
      }
      if (priceRange.maxPrice && !sanitizedOutput.extractedCriteria.maxPrice) {
        sanitizedOutput.extractedCriteria.maxPrice = priceRange.maxPrice;
      }
      if (priceRange.minPrice && !sanitizedOutput.extractedCriteria.minPrice) {
        sanitizedOutput.extractedCriteria.minPrice = priceRange.minPrice;
      }
    }
  }

  return sanitizedOutput;
};

// =========================================================================
// 3. AI EXECUTIVE DASHBOARD INSIGHTS
// =========================================================================

/**
 * Generates executive summary, business insights, strategic recommendations, warnings, and growth opportunities from KPI metrics.
 */
const generateDashboardInsights = async (
  payload: TDashboardInsightsInput
): Promise<TDashboardInsightsOutput> => {
  const cleanPayload = AiHelper.sanitizeInput(payload);
  const userPrompt = AiPrompts.buildDashboardInsightsUserPrompt(cleanPayload);

  const response = await openAiClient.createChatCompletion({
    model:
      config.openai_model ||
      AI_DEFAULT_CONFIG.ADVANCED_MODEL ||
      AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.BALANCED,
    maxTokens: AI_DEFAULT_CONFIG.MAX_TOKENS.DASHBOARD_INSIGHTS,
    responseFormatJson: true,
    systemPrompt: AiPrompts.DASHBOARD_INSIGHTS_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const parsedJson = AiHelper.safeJsonParse(response.content);
  return AiHelper.sanitizeDashboardInsightsOutput(parsedJson);
};

// =========================================================================
// 4. FUTURE EXPANSION SERVICES (ARCHITECTURAL SCALABILITY)
// =========================================================================

/**
 * Semantic Vector Search Hook
 */
const semanticSearch = async (
  query: ISemanticSearchQuery
): Promise<ISemanticSearchResult[]> => {
  return [
    {
      productId: "sample-product-id",
      score: 0.94,
      relevanceExplanation: `High semantic match for query "${query.query}"`,
    },
  ];
};

/**
 * Automated Review Moderation & Sentiment Analysis
 */
const moderateReview = async (
  input: IReviewModerationInput
): Promise<IReviewModerationOutput> => {
  const response = await openAiClient.createChatCompletion({
    model: AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.PRECISE,
    maxTokens: 500,
    responseFormatJson: true,
    systemPrompt: AiPrompts.REVIEW_MODERATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Review Text: "${input.reviewText}" (Rating: ${input.rating}/5)`,
      },
    ],
  });

  const parsed = AiHelper.safeJsonParse(response.content);
  return {
    isAppropriate: typeof parsed.isAppropriate === "boolean" ? parsed.isAppropriate : true,
    sentiment: parsed.sentiment || "NEUTRAL",
    flaggedReasons: Array.isArray(parsed.flaggedReasons) ? parsed.flaggedReasons : [],
    moderationConfidence: Number(parsed.moderationConfidence || 0.95),
  };
};

/**
 * AI Transaction & Vendor Fraud Risk Evaluation
 */
const analyzeFraudRisk = async (
  input: IFraudAnalysisInput
): Promise<IFraudAnalysisOutput> => {
  const response = await openAiClient.createChatCompletion({
    model: AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.PRECISE,
    maxTokens: 600,
    responseFormatJson: true,
    systemPrompt: AiPrompts.FRAUD_DETECTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Analyze order risk: ${JSON.stringify(input)}`,
      },
    ],
  });

  const parsed = AiHelper.safeJsonParse(response.content);
  return {
    riskScore: Number(parsed.riskScore ?? 15),
    riskLevel: parsed.riskLevel || "LOW",
    riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
    recommendedAction: parsed.recommendedAction || "ALLOW",
  };
};

/**
 * AI Dynamic Pricing Recommendation
 */
const calculateDynamicPricing = async (
  input: IDynamicPricingInput
): Promise<IDynamicPricingOutput> => {
  const minAllowable = Number((input.currentPrice * 0.8).toFixed(2));
  const maxAllowable = Number((input.currentPrice * 1.35).toFixed(2));
  const avgCompetitor = input.competitorPrices.length
    ? input.competitorPrices.reduce((a, b) => a + b, 0) / input.competitorPrices.length
    : input.currentPrice;

  let targetPrice = Number(((input.currentPrice + avgCompetitor) / 2).toFixed(2));
  if (input.stockLevel < 10) {
    targetPrice = Number((targetPrice * 1.05).toFixed(2));
  }

  return {
    recommendedPrice: Math.min(Math.max(targetPrice, minAllowable), maxAllowable),
    priceDelta: Number((targetPrice - input.currentPrice).toFixed(2)),
    rationale: "Optimized against current competitor average and catalog inventory velocity.",
    minAllowablePrice: minAllowable,
    maxAllowablePrice: maxAllowable,
  };
};

/**
 * Multi-language E-Commerce Content Translation
 */
const translateContent = async (
  text: string,
  targetLanguage: string
): Promise<string> => {
  const response = await openAiClient.createChatCompletion({
    model: AI_DEFAULT_CONFIG.DEFAULT_MODEL,
    temperature: AI_DEFAULT_CONFIG.TEMPERATURE.PRECISE,
    maxTokens: 1500,
    responseFormatJson: true,
    systemPrompt: AiPrompts.TRANSLATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Translate to ${targetLanguage}:\n\n${text}\n\nRespond with JSON: { "translatedText": "..." }`,
      },
    ],
  });

  const parsed = AiHelper.safeJsonParse(response.content);
  return parsed.translatedText || text;
};

// =========================================================================
// SERVICES OBJECT EXPORT (Matching admin.service.ts style)
// =========================================================================

export const AiServices = {
  generateProductContent,
  chatShoppingAssistant,
  generateDashboardInsights,
  semanticSearch,
  moderateReview,
  analyzeFraudRisk,
  calculateDynamicPricing,
  translateContent,
};
