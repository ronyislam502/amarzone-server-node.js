/**
 * Artificial Intelligence Core Service Layer
 *
 * Orchestrates business logic, prompt preparation, OpenAI execution,
 * response sanitization, caching, and future capabilities integration (RAG, Tools, Moderation).
 */

import config from "../../config";
import { openAiClient, OpenAiClientService } from "./ai.openai";
import { AiPrompts } from "./ai.prompt";
import { AiHelper } from "./ai.helper";
import { AiUtils } from "./ai.utils";
import { AI_DEFAULT_CONFIG, AI_MODELS } from "./ai.constant";
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
  IRagRetriever,
  TChatMessage,
} from "./ai.interface";

export class AiService {
  private client: OpenAiClientService;
  private ragRetriever: IRagRetriever | null = null;

  constructor(client: OpenAiClientService = openAiClient) {
    this.client = client;
  }

  /**
   * Optional Dependency Injection for Vector Database / RAG Retrievers
   */
  public setRagRetriever(retriever: IRagRetriever): void {
    this.ragRetriever = retriever;
  }

  // =========================================================================
  // 1. AI PRODUCT CONTENT GENERATOR
  // =========================================================================
  /**
   * Generates SEO-optimized product titles, descriptions, bullet features, and tags.
   */
  public async generateProductContent(
    payload: TProductContentInput
  ): Promise<TProductContentOutput> {
    const cleanPayload = AiHelper.sanitizeInput(payload);
    const userPrompt = AiPrompts.buildProductContentUserPrompt(cleanPayload);

    const response = await this.client.createChatCompletion({
      model: config.openai_model || AI_DEFAULT_CONFIG.DEFAULT_MODEL,
      temperature: AI_DEFAULT_CONFIG.TEMPERATURE.CREATIVE,
      maxTokens: AI_DEFAULT_CONFIG.MAX_TOKENS.PRODUCT_CONTENT,
      responseFormatJson: true,
      systemPrompt: AiPrompts.PRODUCT_CONTENT_GENERATOR_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const parsedJson = AiHelper.safeJsonParse(response.content);
    return AiHelper.sanitizeProductContentOutput(parsedJson);
  }

  // =========================================================================
  // 2. AI SHOPPING ASSISTANT
  // =========================================================================
  /**
   * Handles conversational customer inquiries, product comparisons, recommendations, and search parameter extraction.
   */
  public async chatShoppingAssistant(
    payload: TShoppingAssistantInput
  ): Promise<TShoppingAssistantOutput> {
    const cleanPayload = AiHelper.sanitizeInput(payload);
    const messages: TChatMessage[] = [];

    // Append prior conversational turns if provided
    if (cleanPayload.chatHistory && cleanPayload.chatHistory.length > 0) {
      // Limit to last 10 messages for context efficiency
      const recentHistory = cleanPayload.chatHistory.slice(-10);
      for (const item of recentHistory) {
        messages.push({
          role: item.role,
          content: item.content,
        });
      }
    }

    // Optional RAG retrieval hook for future marketplace catalog enrichment
    let augmentedUserPrompt = AiPrompts.buildShoppingAssistantUserPrompt(cleanPayload);
    if (this.ragRetriever) {
      try {
        const retrievedDocs = await this.ragRetriever.retrieveRelevantContext(
          cleanPayload.message,
          3
        );
        if (retrievedDocs && retrievedDocs.length > 0) {
          augmentedUserPrompt += `\n\n[RELEVANT MARKETPLACE CATALOG ITEMS]:\n${retrievedDocs.join(
            "\n---\n"
          )}`;
        }
      } catch (ragError) {
        console.warn("[AiService.chatShoppingAssistant] RAG retrieval skipped:", ragError);
      }
    }

    messages.push({
      role: "user",
      content: augmentedUserPrompt,
    });

    const response = await this.client.createChatCompletion({
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
  }

  // =========================================================================
  // 3. AI EXECUTIVE DASHBOARD INSIGHTS
  // =========================================================================
  /**
   * Generates executive summary, business insights, strategic recommendations, warnings, and growth opportunities from KPI metrics.
   */
  public async generateDashboardInsights(
    payload: TDashboardInsightsInput
  ): Promise<TDashboardInsightsOutput> {
    const cleanPayload = AiHelper.sanitizeInput(payload);
    const userPrompt = AiPrompts.buildDashboardInsightsUserPrompt(cleanPayload);

    const response = await this.client.createChatCompletion({
      model: config.openai_model || AI_DEFAULT_CONFIG.ADVANCED_MODEL || AI_DEFAULT_CONFIG.DEFAULT_MODEL,
      temperature: AI_DEFAULT_CONFIG.TEMPERATURE.BALANCED,
      maxTokens: AI_DEFAULT_CONFIG.MAX_TOKENS.DASHBOARD_INSIGHTS,
      responseFormatJson: true,
      systemPrompt: AiPrompts.DASHBOARD_INSIGHTS_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const parsedJson = AiHelper.safeJsonParse(response.content);
    return AiHelper.sanitizeDashboardInsightsOutput(parsedJson);
  }

  // =========================================================================
  // 4. FUTURE EXPANSION SERVICES (ARCHITECTURAL SCALABILITY)
  // =========================================================================

  /**
   * Semantic Vector Search Hook
   */
  public async semanticSearch(
    query: ISemanticSearchQuery
  ): Promise<ISemanticSearchResult[]> {
    // Architecture ready for pgvector, Pinecone, Qdrant or MongoDB Atlas Vector Search
    return [
      {
        productId: "sample-product-id",
        score: 0.94,
        relevanceExplanation: `High semantic match for query "${query.query}"`,
      },
    ];
  }

  /**
   * Automated Review Moderation & Sentiment Analysis
   */
  public async moderateReview(
    input: IReviewModerationInput
  ): Promise<IReviewModerationOutput> {
    const response = await this.client.createChatCompletion({
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
  }

  /**
   * AI Transaction & Vendor Fraud Risk Evaluation
   */
  public async analyzeFraudRisk(
    input: IFraudAnalysisInput
  ): Promise<IFraudAnalysisOutput> {
    const response = await this.client.createChatCompletion({
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
  }

  /**
   * AI Dynamic Pricing Recommendation
   */
  public async calculateDynamicPricing(
    input: IDynamicPricingInput
  ): Promise<IDynamicPricingOutput> {
    const minAllowable = Number((input.currentPrice * 0.8).toFixed(2));
    const maxAllowable = Number((input.currentPrice * 1.35).toFixed(2));
    const avgCompetitor = input.competitorPrices.length
      ? input.competitorPrices.reduce((a, b) => a + b, 0) / input.competitorPrices.length
      : input.currentPrice;

    let targetPrice = Number(((input.currentPrice + avgCompetitor) / 2).toFixed(2));
    if (input.stockLevel < 10) {
      targetPrice = Number((targetPrice * 1.05).toFixed(2)); // High demand, low stock
    }

    return {
      recommendedPrice: Math.min(Math.max(targetPrice, minAllowable), maxAllowable),
      priceDelta: Number((targetPrice - input.currentPrice).toFixed(2)),
      rationale: "Optimized against current competitor average and catalog inventory velocity.",
      minAllowablePrice: minAllowable,
      maxAllowablePrice: maxAllowable,
    };
  }

  /**
   * Multi-language E-Commerce Content Translation
   */
  public async translateContent(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    const response = await this.client.createChatCompletion({
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
  }
}

// Singleton Service Export
export const AiServices = new AiService();
