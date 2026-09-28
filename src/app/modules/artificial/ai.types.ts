/**
 * Artificial Intelligence Module Domain Types
 */

import {
  AI_MODELS,
  AI_INTENTS,
  DASHBOARD_FOCUS_AREAS,
  INSIGHT_PRIORITIES,
  WARNING_SEVERITIES,
} from "./ai.constant";

export type TAiModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export type TAiIntent = (typeof AI_INTENTS)[keyof typeof AI_INTENTS];

export type TDashboardFocusArea =
  (typeof DASHBOARD_FOCUS_AREAS)[keyof typeof DASHBOARD_FOCUS_AREAS];

export type TInsightPriority =
  (typeof INSIGHT_PRIORITIES)[keyof typeof INSIGHT_PRIORITIES];

export type TWarningSeverity =
  (typeof WARNING_SEVERITIES)[keyof typeof WARNING_SEVERITIES];

export type TChatRole = "system" | "user" | "assistant" | "function" | "tool";

export type TChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export type TChatMessage = {
  role: TChatRole;
  content: string | TChatContentPart[] | any;
  name?: string;
};

export type TTimeframe = "daily" | "weekly" | "monthly" | "yearly" | "custom";
