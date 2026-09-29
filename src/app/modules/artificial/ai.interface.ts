/**
 * Artificial Intelligence Module Interfaces
 *
 * Provides strongly typed contracts for all input payloads, structured outputs,
 * OpenAI adapters, and future capability extension points.
 */

import {
  TAiIntent,
  TAiModel,
  TChatMessage,
  TDashboardFocusArea,
  TInsightPriority,
  TTimeframe,
  TWarningSeverity,
} from "./ai.types";

export {
  TAiIntent,
  TAiModel,
  TChatMessage,
  TDashboardFocusArea,
  TInsightPriority,
  TTimeframe,
  TWarningSeverity,
};

// ==========================================
// 1. PRODUCT CONTENT GENERATOR INTERFACES
// ==========================================

export type TProductSpecification = {
  key: string;
  value: string;
};

export type TProductContentInput = {
  title?: string;
  category?: string;
  brand?: string;
  features?: string[] | string;
  imageUrl?: string;
  image?: string;
  specifications?: Record<string, any> | TProductSpecification[];
  targetAudience?: string;
  tone?: "professional" | "exciting" | "luxury" | "casual" | "technical" | string;
  keywords?: string[];
};

export type TProductContentOutput = {
  title: string;
  brand: string;
  features: string[];
  bulletFeatures?: string[];
  tags: string[];
  suggestedDepartment: string;
  suggestedCategory: string;
  shortDescription: string;
  longDescription: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  imageUrl?: string;
  department?: string;
  category?: string;
  description?: string;
};

// ==========================================
// 2. SHOPPING ASSISTANT INTERFACES
// ==========================================

export type TShoppingAssistantContext = {
  category?: string;
  budget?: number;
  currency?: string;
  preferredBrands?: string[];
  userPreferences?: Record<string, any>;
  currentProductId?: string;
};

export type TShoppingAssistantInput = {
  message: string;
  chatHistory?: TChatMessage[];
  context?: TShoppingAssistantContext;
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    category?: string;
    rating?: number;
  };
};

export type TShoppingCriteria = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  brand?: string;
  keywords?: string[];
  keyAttributes?: Record<string, string>;
};

export type TProductComparisonItem = {
  item: string;
  pros: string[];
  cons: string[];
  verdict: string;
};

export type TShoppingAssistantOutput = {
  reply: string;
  intent: TAiIntent;
  extractedCriteria?: TShoppingCriteria;
  suggestions: string[];
  comparisons?: TProductComparisonItem[];
  recommendedCategories?: string[];
};

// ==========================================
// 3. EXECUTIVE DASHBOARD INSIGHTS INTERFACES
// ==========================================

export type TDashboardStatsInput = {
  revenue?: {
    total?: number;
    growthPercentage?: number;
    averageOrderValue?: number;
    grossMargin?: number;
    [key: string]: any;
  };
  orders?: {
    total?: number;
    completed?: number;
    pending?: number;
    cancelled?: number;
    [key: string]: any;
  };
  refunds?: {
    totalCount?: number;
    totalAmount?: number;
    ratePercentage?: number;
    [key: string]: any;
  };
  customers?: {
    total?: number;
    newToday?: number;
    activeMonthly?: number;
    retentionRate?: number;
    [key: string]: any;
  };
  vendors?: {
    total?: number;
    active?: number;
    suspended?: number;
    atRisk?: number;
    [key: string]: any;
  };
  reviews?: {
    averageRating?: number;
    totalReviews?: number;
    positivePercentage?: number;
    negativeCount?: number;
    [key: string]: any;
  };
  topProducts?: Array<{
    name: string;
    salesCount?: number;
    revenue?: number;
    category?: string;
  }>;
  growth?: {
    monthOverMonth?: number;
    yearOverYear?: number;
    [key: string]: any;
  };
  slaViolations?: {
    total?: number;
    lateShipmentRate?: number;
    orderDefectRate?: number;
    cancellationRate?: number;
    [key: string]: any;
  };
  [key: string]: any;
};

export type TDashboardInsightsInput = {
  stats: TDashboardStatsInput;
  timeframe?: TTimeframe;
  focusArea?: TDashboardFocusArea;
  comparisonTimeframe?: string;
};

export type TBusinessInsightItem = {
  category: string;
  observation: string;
  impact: string;
};

export type TActionableRecommendation = {
  title: string;
  action: string;
  priority: TInsightPriority;
  expectedImpact: string;
};

export type TDashboardWarning = {
  alert: string;
  severity: TWarningSeverity;
  metricTrigger: string;
  suggestedRemediation: string;
};

export type TGrowthOpportunity = {
  opportunity: string;
  estimatedPotential: string;
  actionableNextStep: string;
};

export type TDashboardInsightsOutput = {
  executiveSummary: string;
  businessInsights: string[] | TBusinessInsightItem[];
  recommendations: TActionableRecommendation[];
  warnings: TDashboardWarning[];
  growthOpportunities: TGrowthOpportunity[];
  naturalLanguageReport: string;
};

// ==========================================
// 4. OPENAI ADAPTER & EXECUTION INTERFACES
// ==========================================

export type TOpenAiRequestOptions = {
  model?: TAiModel | string;
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
  systemPrompt?: string;
  messages: TChatMessage[];
  tools?: any[];
  toolChoice?: any;
};

export type TAiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type TAiExecutionMeta = {
  model: string;
  durationMs: number;
  usage?: TAiTokenUsage;
  cached?: boolean;
};

// ==========================================
// 5. FUTURE EXTENSION INTERFACES (SCALABILITY)
// ==========================================

export interface ISemanticSearchQuery {
  query: string;
  category?: string;
  topK?: number;
  minScore?: number;
}

export interface ISemanticSearchResult {
  productId: string;
  score: number;
  relevanceExplanation?: string;
}

export interface IReviewModerationInput {
  reviewText: string;
  rating: number;
  productTitle?: string;
}

export interface IReviewModerationOutput {
  isAppropriate: boolean;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  flaggedReasons?: string[];
  moderationConfidence: number;
}

export interface IFraudAnalysisInput {
  userId: string;
  orderAmount: number;
  paymentMethod: string;
  shippingAddress: Record<string, any>;
  billingAddress: Record<string, any>;
  recentAttemptsCount?: number;
}

export interface IFraudAnalysisOutput {
  riskScore: number; // 0 to 100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskFactors: string[];
  recommendedAction: "ALLOW" | "REVIEW" | "DECLINE" | "REQUIRE_2FA";
}

export interface IDynamicPricingInput {
  productId: string;
  currentPrice: number;
  competitorPrices: number[];
  stockLevel: number;
  historicalDemandIndex: number;
  seasonalityMultiplier?: number;
}

export interface IDynamicPricingOutput {
  recommendedPrice: number;
  priceDelta: number;
  rationale: string;
  minAllowablePrice: number;
  maxAllowablePrice: number;
}

export interface IRagRetriever {
  retrieveRelevantContext(query: string, limit?: number): Promise<string[]>;
}
