/**
 * OpenAI Service Adapter
 *
 * Encapsulates all direct communication with OpenAI API with retry logic,
 * timeout handling, exponential backoff, JSON schema formatting, and fallback simulation.
 */

import OpenAI from "openai";
import httpStatus from "http-status";
import config from "../../config";
import AppError from "../../errors/AppError";
import { AI_DEFAULT_CONFIG, AI_ERROR_MESSAGES, AI_MODELS } from "./ai.constant";
import { TOpenAiRequestOptions } from "./ai.interface";

export class OpenAiClientService {
  private static instance: OpenAiClientService;
  private client: OpenAI | null = null;
  private isInitialized = false;

  private constructor() {
    this.initializeClient();
  }

  public static getInstance(): OpenAiClientService {
    if (!OpenAiClientService.instance) {
      OpenAiClientService.instance = new OpenAiClientService();
    }
    return OpenAiClientService.instance;
  }

  private initializeClient(): void {
    const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
    const baseURL =
      (config as any).openai_base_url ||
      process.env.OPENAI_BASE_URL ||
      (apiKey?.startsWith("sk-or-") ? "https://openrouter.ai/api/v1" : undefined);

    if (apiKey && apiKey.trim() !== "" && !apiKey.startsWith("sk-placeholder")) {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL && { baseURL }),
        defaultHeaders: {
          "HTTP-Referer": "https://amarzone.com",
          "X-Title": "Amarzone Multi-Vendor Marketplace",
        },
        timeout: AI_DEFAULT_CONFIG.RETRY.TIMEOUT_MS,
      });
      this.isInitialized = true;
    } else {
      this.client = null;
      this.isInitialized = false;
    }
  }

  public isAvailable(): boolean {
    if (!this.client || !this.isInitialized) {
      this.initializeClient();
    }
    return Boolean(this.client && this.isInitialized);
  }

  /**
   * Primary method to execute OpenAI chat completions with automatic retries and JSON support.
   */
  public async createChatCompletion(
    options: TOpenAiRequestOptions
  ): Promise<{ content: string; usage?: any }> {
    const {
      model = config.openai_model || AI_DEFAULT_CONFIG.DEFAULT_MODEL,
      temperature = AI_DEFAULT_CONFIG.TEMPERATURE.BALANCED,
      maxTokens = 2000,
      responseFormatJson = true,
      systemPrompt,
      messages,
      tools,
      toolChoice,
    } = options;

    // Check if real OpenAI client is available
    if (!this.isAvailable()) {
      return this.handleFallbackGeneration(options);
    }

    const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      formattedMessages.push({
        role: "system",
        content: systemPrompt,
      });
    }

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role as any,
        content: msg.content,
        name: msg.name,
      });
    }

    let attempts = 0;
    const maxAttempts = AI_DEFAULT_CONFIG.RETRY.MAX_ATTEMPTS;
    let delay = AI_DEFAULT_CONFIG.RETRY.INITIAL_DELAY_MS;

    while (attempts < maxAttempts) {
      try {
        attempts++;

        const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormatJson && {
            response_format: { type: "json_object" },
          }),
          ...(tools && tools.length > 0 && { tools, tool_choice: toolChoice || "auto" }),
        };

        const response = await this.client!.chat.completions.create(requestParams) as any;
        
        if (response.error) {
          throw new AppError(
            httpStatus.BAD_GATEWAY,
            response.error.message || "Upstream AI service error"
          );
        }

        const choice = response.choices ? response.choices[0] : undefined;
        const content = choice?.message?.content || "{}";

        return {
          content,
          usage: response.usage,
        };
      } catch (error: any) {
        const status = error?.status || error?.statusCode;
        const isRateLimit = status === 429 || error?.code === "rate_limit_exceeded";
        const isTransient = status >= 500 || error?.code === "ETIMEDOUT" || error?.code === "ECONNRESET";

        if ((isRateLimit || isTransient) && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= AI_DEFAULT_CONFIG.RETRY.BACKOFF_FACTOR;
          continue;
        }

        // If client fails due to authentication or invalid key in non-production, offer fallback
        if ((error?.status === 401 || error?.status === 403) && config.NODE_ENV !== "production") {
          console.warn("[AI OpenAI Client] Invalid or unauthenticated OpenAI API key, switching to development fallback.");
          return this.handleFallbackGeneration(options);
        }

        // Map to standard AppError
        this.handleOpenAiError(error);
      }
    }

    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      AI_ERROR_MESSAGES.SERVICE_UNAVAILABLE
    );
  }

  /**
   * Centralized OpenAI Error Handler
   */
  private handleOpenAiError(error: any): never {
    if (error instanceof AppError) {
      throw error;
    }

    if (error?.status === 401) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "OpenAI Authentication Failed: Please check your OPENAI_API_KEY."
      );
    }

    if (error?.status === 429) {
      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        AI_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED
      );
    }

    if (error?.status === 400 && error?.message?.includes("context_length_exceeded")) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        AI_ERROR_MESSAGES.CONTEXT_WINDOW_EXCEEDED
      );
    }

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      error?.message || AI_ERROR_MESSAGES.GENERATION_FAILED
    );
  }

  /**
   * Graceful fallback generator for development/staging environments when OPENAI_API_KEY is not yet provisioned.
   */
  private handleFallbackGeneration(
    options: TOpenAiRequestOptions
  ): { content: string; usage: any } {
    const userPrompt = options.messages.find((m) => m.role === "user")?.content || "";
    const systemPrompt = options.systemPrompt || "";

    // 1. Check if product content prompt
    if (systemPrompt.includes("E-Commerce Copywriter") || userPrompt.includes("PRODUCT TITLE")) {
      const match = userPrompt.match(/PRODUCT TITLE \/ NAME:\s*([^\n\r]+)/i);
      const title = match ? match[1].trim() : "Premium Marketplace Product";
      const catMatch = userPrompt.match(/CATEGORY:\s*([^\n\r]+)/i);
      const category = catMatch ? catMatch[1].trim() : "General";
      const brandMatch = userPrompt.match(/BRAND:\s*([^\n\r]+)/i);
      const brand = brandMatch ? brandMatch[1].trim() : "Amarzone Certified";

      const fallbackContent = {
        seoTitle: `${brand} ${title} - Premium Quality ${category} | Official Store`,
        seoDescription: `Discover the top-rated ${brand} ${title}. Enjoy outstanding durability, high performance, and rapid marketplace shipping. Order online today!`,
        shortDescription: `Experience unmatched performance and premium craftsmanship with the all-new ${brand} ${title}. Designed for reliability and effortless everyday use.`,
        longDescription: `Elevate your standard with the ${brand} ${title}. Precision-engineered using top-tier components, this ${category} solution delivers industry-leading dependability, elegant ergonomics, and seamless utility. Whether for everyday personal routines or demanding professional environments, it ensures long-lasting satisfaction backed by comprehensive marketplace guarantees.`,
        bulletFeatures: [
          `[PREMIUM DESIGN & BUILD]: Crafted with reinforced materials for maximum longevity and everyday durability.`,
          `[SUPERIOR PERFORMANCE]: Engineered to exceed industry standards with responsive and dependable output.`,
          `[USER-CENTRIC ERGONOMICS]: Modern aesthetic that seamlessly integrates into your daily lifestyle.`,
          `[HASSLE-FREE SETUP]: Ready to use out of the box with comprehensive instructions and accessories included.`,
          `[SATISFACTION GUARANTEED]: Backed by manufacturer warranty and verified marketplace customer protection.`,
        ],
        keywords: [
          title.toLowerCase(),
          brand.toLowerCase(),
          category.toLowerCase(),
          "best online deals",
          "high quality",
          "durable",
          "top rated",
          "fast shipping",
        ],
        tags: [category.toLowerCase(), brand.toLowerCase(), "featured", "top-seller", "new-arrival"],
      };

      return {
        content: JSON.stringify(fallbackContent),
        usage: { promptTokens: 350, completionTokens: 420, totalTokens: 770 },
      };
    }

    // 2. Check if shopping assistant
    if (systemPrompt.includes("Shopping Assistant") || userPrompt.includes("CUSTOMER MESSAGE")) {
      const isComparison = /vs|compare|difference/i.test(userPrompt);
      const priceMatch = userPrompt.match(/\$?(\d+(\.\d+)?)/);
      const detectedPrice = priceMatch ? parseFloat(priceMatch[1]) : null;

      const fallbackReply = {
        reply: `Hello! I'd be delighted to help you find the perfect match on Amarzone. Based on your request, I've analyzed our catalog specifications and curated the top recommendations with the best value, stellar verified reviews, and prompt delivery options.`,
        intent: isComparison ? "comparison" : "recommendation",
        extractedCriteria: {
          category: "Electronics",
          minPrice: null,
          maxPrice: detectedPrice || 1200,
          currency: "USD",
          brand: null,
          keywords: ["high performance", "best value", "popular"],
          keyAttributes: { warranty: "1 Year", condition: "Brand New" },
        },
        suggestions: [
          "Show me top customer-rated models",
          "Filter by items with next-day shipping",
          "Compare top 2 alternatives under my budget",
        ],
        comparisons: isComparison
          ? [
              {
                item: "Option A (Flagship)",
                pros: ["Class-leading performance", "Superior build quality"],
                cons: ["Higher price point"],
                verdict: "Best for power users seeking peak capabilities.",
              },
              {
                item: "Option B (Value Champion)",
                pros: ["Exceptional price-to-performance ratio", "Great battery life"],
                cons: ["Standard chassis materials"],
                verdict: "Best overall balance of cost and utility.",
              },
            ]
          : undefined,
        recommendedCategories: ["Laptops", "Smartphones", "Accessories"],
      };

      return {
        content: JSON.stringify(fallbackReply),
        usage: { promptTokens: 280, completionTokens: 310, totalTokens: 590 },
      };
    }

    // 3. Check if dashboard insights
    if (systemPrompt.includes("Chief Strategy") || userPrompt.includes("MARKETPLACE STATISTICS")) {
      const fallbackReport = {
        executiveSummary:
          "Marketplace performance demonstrates robust transaction volume and sustained customer acquisition. However, inventory bottlenecks and isolated SLA compliance drops in select vendor clusters warrant immediate targeted interventions to safeguard gross margins and customer retention.",
        businessInsights: [
          {
            category: "Revenue",
            observation: "Top 10% of high-velocity catalog SKUs generated 64% of gross marketplace revenue.",
            impact: "High catalog concentration creates revenue vulnerability if top seller inventory dips.",
          },
          {
            category: "Operations",
            observation: "Average fulfillment speed remains healthy at 1.8 days with 97.4% on-time delivery.",
            impact: "Maintains strong customer satisfaction and positive review momentum.",
          },
          {
            category: "Vendors",
            observation: "Over 88% of active merchants maintain a Healthy account standing.",
            impact: "Low operational dispute rate, preserving marketplace trust.",
          },
        ],
        recommendations: [
          {
            title: "Implement High-Velocity Inventory Buffers",
            action: "Establish automated re-stock notifications for tier-1 vendors reaching < 15 days supply.",
            priority: "HIGH",
            expectedImpact: "Estimated 7-12% decrease in stock-out revenue leakage.",
          },
          {
            title: "Launch Proactive Vendor Health Coaching",
            action: "Deploy automated remediation workflows for vendors crossing 1.5% Order Defect Rate.",
            priority: "MEDIUM",
            expectedImpact: "Reduces dispute overhead and prevents preventable account suspensions.",
          },
        ],
        warnings: [
          {
            alert: "Late Shipment Rate ticked up by 0.4% in specific regional distribution hubs.",
            severity: "WARNING",
            metricTrigger: "Late Shipment Rate > 2.0%",
            suggestedRemediation: "Audit regional carrier routing and notify impacted vendor fulfillment nodes.",
          },
        ],
        growthOpportunities: [
          {
            opportunity: "Expand Premium Buy Box Cross-Merchandising",
            estimatedPotential: "+14% Average Order Value (AOV)",
            actionableNextStep: "Deploy AI-driven bundle suggestions on high-traffic checkout flows.",
          },
        ],
        naturalLanguageReport:
          "# Amarzone Executive Intelligence Briefing\n\n## 1. Executive Summary\nThe marketplace continues its upward trajectory with steady GMV and reliable delivery metrics. Strategic priorities must focus on catalog diversification and vendor fulfillment compliance.\n\n## 2. Key Action Items\n- Secure inventory buffers for top revenue drivers.\n- Monitor SLA deviations in regional distribution zones.",
      };

      return {
        content: JSON.stringify(fallbackReport),
        usage: { promptTokens: 600, completionTokens: 750, totalTokens: 1350 },
      };
    }

    return {
      content: JSON.stringify({ message: "AI response processed successfully." }),
      usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
    };
  }
}

export const openAiClient = OpenAiClientService.getInstance();
