import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";
import catchAsync from "../utilities/catchAsync";

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateRequestCookies = (schema: AnyZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const parsedCookies = await schema.parseAsync({
      cookies: req.cookies,
    });

    req.cookies = parsedCookies.cookies;

    next();
  });
};
