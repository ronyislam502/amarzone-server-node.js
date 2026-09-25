/**
 * Artificial Intelligence Utility Functions
 *
 * Mathematical helpers, token estimation, text formatting, and caching key generators.
 */

import crypto from "crypto";

export class AiUtils {
  /**
   * Estimate token count roughly for text without loading heavy tokenizers (approx 4 chars per token for English).
   */
  public static estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to stay comfortably within LLM context bounds.
   */
  public static truncateText(text: string, maxCharacters: number = 8000): string {
    if (!text || text.length <= maxCharacters) {
      return text;
    }
    return text.substring(0, maxCharacters) + "\n...[TRUNCATED FOR LENGTH]...";
  }

  /**
   * Generate MD5 hash of input payloads for deterministic Redis caching.
   */
  public static generateCacheKey(prefix: string, payload: any): string {
    const serialized = JSON.stringify(payload);
    const hash = crypto.createHash("md5").update(serialized).digest("hex");
    return `${prefix}${hash}`;
  }

  /**
   * Parse price constraints from user queries like "$500", "under 1200", "below $80.50".
   */
  public static extractPriceRange(query: string): { minPrice?: number; maxPrice?: number } | null {
    if (!query) return null;

    const underMatch = query.match(/(?:under|below|less than|max(?:imum)?)\s*\$?(\d+(?:\.\d+)?)/i);
    const overMatch = query.match(/(?:above|over|more than|min(?:imum)?)\s*\$?(\d+(?:\.\d+)?)/i);
    const betweenMatch = query.match(/(?:between|from)\s*\$?(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*\$?(\d+(?:\.\d+)?)/i);

    if (betweenMatch) {
      return {
        minPrice: parseFloat(betweenMatch[1]),
        maxPrice: parseFloat(betweenMatch[2]),
      };
    }

    const result: { minPrice?: number; maxPrice?: number } = {};
    if (underMatch) {
      result.maxPrice = parseFloat(underMatch[1]);
    }
    if (overMatch) {
      result.minPrice = parseFloat(overMatch[1]);
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Format numbers to clean currency/percentage strings.
   */
  public static formatCurrency(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  }

  public static formatPercent(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
  }
}
