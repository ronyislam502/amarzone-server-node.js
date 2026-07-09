import { z } from "zod";

const variantValidationSchema = z.object({
    type: z.string({
        invalid_type_error: "Type must be string",
        required_error: "Type is required",
    }),
    value: z.string({
        invalid_type_error: "Value must be string",
        required_error: "Value is required",
    }),
});

const createProductValidationSchema = z.object({
    body: z.object({
        department: z.string({
            invalid_type_error: "department must be string",
            required_error: "department is required",
        }),
        category: z.string({
            invalid_type_error: "Category must be string",
            required_error: "Category is required",
        }),
        asin: z.string({
            invalid_type_error: "asin must be string",
            required_error: "asin is required",
        }).optional(),
        title: z.string({
            invalid_type_error: "title must be string",
            required_error: "title is required",
        }),
        description: z.string({
            invalid_type_error: "Description must be string",
            required_error: "Description is required",
        }),
        fetures: z.array(z.string()),
        brand: z.string({
            invalid_type_error: "brand must be string",
            required_error: "brand is required",
        }),
        variants: z.array(variantValidationSchema),
        tags: z.array(z.string()).optional(),
    }),
});

const updateVariantValidationSchema = z.object({
    type: z.string().optional(),
    value: z.string().optional(),
});

const updateProductValidationSchema = z.object({
    body: z.object({
        department: z.string().optional(),
        category: z.string().optional(),
        asin: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        fetures: z.array(z.string()).optional(),
        brand: z.string().optional(),
        variants: z.array(updateVariantValidationSchema).optional(),
        tags: z.array(z.string()).optional(),
    }),
});

export const ProductValidations = {
    createProductValidationSchema,
    updateProductValidationSchema,
};

