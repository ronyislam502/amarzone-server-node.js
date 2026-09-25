/**
 * Artificial Intelligence Specific Middlewares
 *
 * Middleware layer for sanitization, telemetry, and rate limit guardrails.
 */

import { NextFunction, Request, Response } from "express";

/**
 * Middleware to sanitize incoming string payloads and remove control characters.
 */
export const sanitizeAiInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === "object") {
    const sanitizeValue = (value: any): any => {
      if (typeof value === "string") {
        // Strip null bytes and non-printable control characters (except common whitespace)
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
      }
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      if (value !== null && typeof value === "object") {
        const sanitizedObj: Record<string, any> = {};
        for (const [k, v] of Object.entries(value)) {
          sanitizedObj[k] = sanitizeValue(v);
        }
        return sanitizedObj;
      }
      return value;
    };

    req.body = sanitizeValue(req.body);
  }
  next();
};

/**
 * Middleware for AI request telemetry and performance tracking.
 */
export const trackAiTelemetry = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  (req as any).aiStartTime = start;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[AI Telemetry] ${req.method} ${req.originalUrl || req.baseUrl} - ${duration}ms (Status: ${res.statusCode})`
      );
    }
  });

  next();
};

