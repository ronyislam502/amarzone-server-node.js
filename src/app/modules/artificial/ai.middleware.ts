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

/**
 * Middleware to handle multipart form data, parse stringified JSON if present,
 * and extract uploaded file paths into req.body.imageUrl.
 */
export const parseAiMultipart = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // If multipart data key was passed (e.g. JSON string inside FormData)
  if (req.body?.data && typeof req.body.data === "string") {
    try {
      const parsed = JSON.parse(req.body.data);
      req.body = { ...parsed, ...req.body };
      delete req.body.data;
    } catch {
      // Continue with raw body if not valid JSON string
    }
  }

  // Handle stringified arrays or objects in multipart form data
  if (typeof req.body?.features === "string") {
    const trimmed = req.body.features.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        req.body.features = JSON.parse(trimmed);
      } catch {
        // keep raw
      }
    }
  }

  if (typeof req.body?.keywords === "string") {
    const trimmed = req.body.keywords.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        req.body.keywords = JSON.parse(trimmed);
      } catch {
        // fallback
      }
    } else if (trimmed.includes(",")) {
      req.body.keywords = trimmed.split(",").map((k: string) => k.trim()).filter(Boolean);
    } else if (trimmed) {
      req.body.keywords = [trimmed];
    }
  }

  if (typeof req.body?.specifications === "string") {
    const trimmed = req.body.specifications.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        req.body.specifications = JSON.parse(trimmed);
      } catch {
        // keep raw
      }
    }
  }

  // Handle uploaded file from multer (checks req.file or req.files)
  const file =
    req.file ||
    (req.files as any)?.images?.[0] ||
    (req.files as any)?.image?.[0] ||
    (req.files as any)?.file?.[0];

  if (file?.path) {
    req.body.imageUrl = file.path;
  }

  // Also support req.body.image if provided as a direct URL or Base64 string
  if (!req.body.imageUrl && typeof req.body.image === "string" && req.body.image.trim() !== "") {
    req.body.imageUrl = req.body.image.trim();
  }

  next();
};

