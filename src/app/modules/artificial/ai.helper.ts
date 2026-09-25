/**
 * Artificial Intelligence Helper Functions
 *
 * Provides data transformation, output parsing, markdown extraction,
 * JSON recovery, and sanitization utilities.
 */

import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { AI_ERROR_MESSAGES } from "./ai.constant";
import {
  TProductContentOutput,
  TShoppingAssistantOutput,
  TDashboardInsightsOutput,
} from "./ai.interface";

export class AiHelper {
  /**
   * Recursively sanitizes input payloads, stripping null bytes and non-printable control characters.
   */
  public static sanitizeInput<T = any>(input: T): T {
    if (typeof input === "string") {
      return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() as any;
    }
    if (Array.isArray(input)) {
      return input.map((item) => AiHelper.sanitizeInput(item)) as any;
    }
    if (input !== null && typeof input === "object") {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = AiHelper.sanitizeInput(value);
      }
      return sanitized as T;
    }
    return input;
  }

  /**
   * Safely parse JSON strings from LLM responses, stripping code fences and fixing minor syntax issues.
   */
  public static safeJsonParse<T = any>(rawText: string): T {
    if (!rawText || rawText.trim() === "") {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        AI_ERROR_MESSAGES.PARSING_FAILED
      );
    }

    let cleaned = rawText.trim();

    // 1. Strip <think>...</think> or <thought>...</thought> blocks from reasoning models
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

    // 2. Extract markdown ```json ... ``` code blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1].trim();
    }

    // 3. Try standard parsing
    try {
      return JSON.parse(cleaned) as T;
    } catch (firstError) {
      // 4. Try greedy curly braces extraction
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = cleaned.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(potentialJson) as T;
        } catch {
          // Attempt trailing comma / newline fixes
          try {
            const sanitized = potentialJson
              .replace(/,\s*}/g, "}")
              .replace(/,\s*]/g, "]");
            return JSON.parse(sanitized) as T;
          } catch {
            // continue
          }
        }
      }

      // 5. Try repair truncated JSON (closing unclosed quotes, brackets, and braces)
      if (firstBrace !== -1) {
        let partial = cleaned.substring(firstBrace);
        // If it ended abruptly in a string, close quote
        const quoteCount = (partial.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          partial += '"';
        }
        // Remove trailing commas or dangling keys
        partial = partial.replace(/,\s*("[^"]*"\s*:\s*)?$/, "");
        // Count unclosed braces and brackets
        let openBrackets = 0;
        let openBraces = 0;
        let inString = false;
        for (let i = 0; i < partial.length; i++) {
          const char = partial[i];
          if (char === '"' && (i === 0 || partial[i - 1] !== '\\')) {
            inString = !inString;
          }
          if (!inString) {
            if (char === '[') openBrackets++;
            else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
            else if (char === '{') openBraces++;
            else if (char === '}') openBraces = Math.max(0, openBraces - 1);
          }
        }
        while (openBrackets > 0) {
          partial += ']';
          openBrackets--;
        }
        while (openBraces > 0) {
          partial += '}';
          openBraces--;
        }

        try {
          return JSON.parse(partial) as T;
        } catch {
          // fallback
        }
      }

      console.error("[AiHelper.safeJsonParse] JSON Parsing Error on text:", rawText);
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `${AI_ERROR_MESSAGES.PARSING_FAILED}: Invalid JSON structure received from model.`
      );
    }
  }

  /**
   * Validate and sanitize Product Content Generator Output
   */
  public static sanitizeProductContentOutput(raw: any): TProductContentOutput {
    return {
      seoTitle: typeof raw?.seoTitle === "string" ? raw.seoTitle.trim() : "",
      seoDescription: typeof raw?.seoDescription === "string" ? raw.seoDescription.trim() : "",
      shortDescription: typeof raw?.shortDescription === "string" ? raw.shortDescription.trim() : "",
      longDescription: typeof raw?.longDescription === "string" ? raw.longDescription.trim() : "",
      bulletFeatures: Array.isArray(raw?.bulletFeatures)
        ? raw.bulletFeatures.map((f: any) => String(f).trim())
        : [],
      keywords: Array.isArray(raw?.keywords)
        ? raw.keywords.map((k: any) => String(k).trim())
        : [],
      tags: Array.isArray(raw?.tags)
        ? raw.tags.map((t: any) => String(t).trim())
        : [],
    };
  }

  /**
   * Validate and sanitize Shopping Assistant Output
   */
  public static sanitizeShoppingAssistantOutput(raw: any): TShoppingAssistantOutput {
    return {
      reply: typeof raw?.reply === "string" ? raw.reply.trim() : "How may I assist your shopping today?",
      intent: raw?.intent || "general_inquiry",
      extractedCriteria: raw?.extractedCriteria
        ? {
            category: raw.extractedCriteria.category || undefined,
            minPrice: typeof raw.extractedCriteria.minPrice === "number" ? raw.extractedCriteria.minPrice : undefined,
            maxPrice: typeof raw.extractedCriteria.maxPrice === "number" ? raw.extractedCriteria.maxPrice : undefined,
            currency: raw.extractedCriteria.currency || "USD",
            brand: raw.extractedCriteria.brand || undefined,
            keywords: Array.isArray(raw.extractedCriteria.keywords) ? raw.extractedCriteria.keywords : [],
            keyAttributes: raw.extractedCriteria.keyAttributes || {},
          }
        : undefined,
      suggestions: Array.isArray(raw?.suggestions)
        ? raw.suggestions.map((s: any) => String(s).trim())
        : [
            "Show me top customer-rated products",
            "Filter by best deals and discounts",
            "Compare top alternatives",
          ],
      comparisons: Array.isArray(raw?.comparisons)
        ? raw.comparisons.map((c: any) => ({
            item: String(c.item || ""),
            pros: Array.isArray(c.pros) ? c.pros.map(String) : [],
            cons: Array.isArray(c.cons) ? c.cons.map(String) : [],
            verdict: String(c.verdict || ""),
          }))
        : undefined,
      recommendedCategories: Array.isArray(raw?.recommendedCategories)
        ? raw.recommendedCategories.map(String)
        : undefined,
    };
  }

  /**
   * Validate and sanitize Executive Dashboard Insights Output
   */
  public static sanitizeDashboardInsightsOutput(raw: any): TDashboardInsightsOutput {
    const executiveSummary =
      typeof raw?.executiveSummary === "string" && raw.executiveSummary.trim()
        ? raw.executiveSummary.trim()
        : "Marketplace performance metrics analyzed.";

    const businessInsights = Array.isArray(raw?.businessInsights)
      ? raw.businessInsights.map((item: any) => {
          if (typeof item === "string") return item;
          return {
            category: String(item.category || "General"),
            observation: String(item.observation || ""),
            impact: String(item.impact || ""),
          };
        })
      : [];

    const recommendations = Array.isArray(raw?.recommendations)
      ? raw.recommendations.map((r: any) => ({
          title: String(r.title || "Optimization Step"),
          action: String(r.action || ""),
          priority: ["HIGH", "MEDIUM", "LOW"].includes(r.priority) ? r.priority : "MEDIUM",
          expectedImpact: String(r.expectedImpact || ""),
        }))
      : [];

    const warnings = Array.isArray(raw?.warnings)
      ? raw.warnings.map((w: any) => ({
          alert: String(w.alert || ""),
          severity: ["CRITICAL", "WARNING", "INFO"].includes(w.severity) ? w.severity : "WARNING",
          metricTrigger: String(w.metricTrigger || ""),
          suggestedRemediation: String(w.suggestedRemediation || ""),
        }))
      : [];

    const growthOpportunities = Array.isArray(raw?.growthOpportunities)
      ? raw.growthOpportunities.map((g: any) => ({
          opportunity: String(g.opportunity || ""),
          estimatedPotential: String(g.estimatedPotential || ""),
          actionableNextStep: String(g.actionableNextStep || ""),
        }))
      : [];

    // Auto-compose formatted Markdown report if raw string is missing or truncated
    let naturalLanguageReport =
      typeof raw?.naturalLanguageReport === "string" && raw.naturalLanguageReport.trim()
        ? raw.naturalLanguageReport.trim()
        : "";

    if (!naturalLanguageReport) {
      naturalLanguageReport = `# Amarzone Executive Intelligence Report\n\n## 1. Executive Summary\n${executiveSummary}\n\n## 2. Business Insights\n${businessInsights
        .map((b: any) => `- **[${typeof b === "object" ? b.category : "General"}]**: ${typeof b === "object" ? b.observation : b}`)
        .join("\n")}\n\n## 3. Strategic Recommendations\n${recommendations
        .map((r: any) => `- **[${r.priority}] ${r.title}**: ${r.action} *(Expected Impact: ${r.expectedImpact})*`)
        .join("\n")}\n\n## 4. Operational Warnings\n${warnings
        .map((w: any) => `- **[${w.severity}] ${w.alert}**: ${w.suggestedRemediation}`)
        .join("\n")}\n\n## 5. Growth Opportunities\n${growthOpportunities
        .map((g: any) => `- **${g.opportunity}**: ${g.actionableNextStep} *(Potential: ${g.estimatedPotential})*`)
        .join("\n")}`;
    }

    return {
      executiveSummary,
      businessInsights,
      recommendations,
      warnings,
      growthOpportunities,
      naturalLanguageReport,
    };
  }
}
