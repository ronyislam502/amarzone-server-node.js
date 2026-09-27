/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodArray, ZodEffects, ZodRecord } from "zod";
import catchAsync from "../utilities/catchAsync";

const validateImageFileRequest = (
  schema: AnyZodObject | ZodEffects<any> | ZodArray<any> | ZodRecord<any>
) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (req.file) {
      const parsedFile = await schema.parseAsync({
        file: req.file,
      });

      req.file = parsedFile.file;
    }

    // array() / fields()
    if (req.files) {
      const parsedFiles = await schema.parseAsync({
        files: req.files,
      });

      req.files = parsedFiles.files;
    }

    next();
  });
};

export default validateImageFileRequest;
