/**
 * Artificial Intelligence Module Constants
 * 
 * Centralized constant definitions for models, fallback configurations,
 * prompt keys, intent classifiers, and default parameters.
 */

export const AI_MODELS = {
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  GPT_3_5_TURBO: "gpt-3.5-turbo",
  TEXT_EMBEDDING_3_SMALL: "text-embedding-3-small",
  TEXT_EMBEDDING_3_LARGE: "text-embedding-3-large",
} as const;

export const AI_DEFAULT_CONFIG = {
  DEFAULT_MODEL: AI_MODELS.GPT_4O_MINI,
  ADVANCED_MODEL: AI_MODELS.GPT_4O,
  TEMPERATURE: {
    CREATIVE: 0.7,
    BALANCED: 0.4,
    PRECISE: 0.1,
  },
  MAX_TOKENS: {
    PRODUCT_CONTENT: 4000,
    SHOPPING_ASSISTANT: 4000,
    DASHBOARD_INSIGHTS: 4000,
    EMBEDDINGS: 8191,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    BACKOFF_FACTOR: 2,
    TIMEOUT_MS: 30000,
  },
} as const;

export const AI_INTENTS = {
  SEARCH: "search",
  COMPARISON: "comparison",
  RECOMMENDATION: "recommendation",
  GENERAL_INQUIRY: "general_inquiry",
  SUPPORT: "support",
} as const;

export const DASHBOARD_FOCUS_AREAS = {
  ALL: "all",
  REVENUE: "revenue",
  OPERATIONS: "operations",
  VENDOR_PERFORMANCE: "vendor_performance",
  CUSTOMER_SATISFACTION: "customer_satisfaction",
} as const;

export const INSIGHT_PRIORITIES = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export const WARNING_SEVERITIES = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;

export const AI_ERROR_MESSAGES = {
  API_KEY_MISSING: "OpenAI API key is missing or not configured.",
  RATE_LIMIT_EXCEEDED: "AI service rate limit exceeded. Please try again later.",
  SERVICE_UNAVAILABLE: "AI service is currently unavailable. Please try again in a few moments.",
  INVALID_PAYLOAD: "Invalid payload provided for AI processing.",
  GENERATION_FAILED: "Failed to generate AI content.",
  PARSING_FAILED: "Failed to parse structured AI output.",
  CONTEXT_WINDOW_EXCEEDED: "Input context exceeds the maximum allowed token length.",
} as const;

export const AI_CACHE_KEYS = {
  PRODUCT_CONTENT_PREFIX: "ai:product_content:",
  SHOPPING_ASSISTANT_PREFIX: "ai:shopping_assistant:",
  DASHBOARD_INSIGHTS_PREFIX: "ai:dashboard_insights:",
  TTL_SECONDS: {
    PRODUCT_CONTENT: 86400, // 24 hours
    DASHBOARD_INSIGHTS: 3600, // 1 hour
  },
} as const;
