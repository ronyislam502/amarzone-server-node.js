
import {
  FilterQuery,
  Model,
  Query,
  Types,
} from "mongoose";

class QueryBuilder<T> {
  public modelQuery: any;
  public query: Record<string, unknown>;

  private model: Model<any>;
  private pipeline: any[] = [];
  private countPipeline: any[] = [];

  private searchableFields: string[] = [];

  private productModel: Model<any> | null = null;
  private departmentModel: Model<any> | null = null;
  private categoryModel: Model<any> | null = null;
  private inventoryModel: Model<any> | null = null;
  private reviewModel: Model<any> | null = null;

  private productLookupApplied = false;
  private inventoryLookupApplied = false;
  private reviewLookupApplied = false;

  private countPipelineCaptured = false;

  constructor(
    modelQuery: Query<T[], T>,
    query: Record<string, unknown>
  ) {
    this.model = modelQuery.model;
    this.query = query;

    const initialFilter = modelQuery.getFilter();

    if (Object.keys(initialFilter).length) {
      this.pipeline.push({
        $match: initialFilter,
      });
    }

    // Resolve registered models
    this.productModel = this.getRefModel(
      this.model,
      "product"
    );

    this.inventoryModel = this.getRegisteredModel(
      "Inventory"
    );

    this.reviewModel = this.getRegisteredModel(
      "ProductReview"
    );

    if (this.productModel) {
      this.departmentModel = this.getRefModel(
        this.productModel,
        "department"
      );

      this.categoryModel = this.getRefModel(
        this.productModel,
        "category"
      );

      this.ensureProductLookup();
    }

    this.refreshQuery();
  }

  // ==========================================
  // Model Helpers
  // ==========================================

  private getRegisteredModel(
    modelName: string
  ): Model<any> | null {
    try {
      return this.model.db.model(modelName);
    } catch {
      return null;
    }
  }

  private getRefModel(
    parentModel: Model<any>,
    path: string
  ): Model<any> | null {
    const schemaType: any = parentModel.schema.path(path);

    const ref =
      schemaType?.options?.ref ||
      schemaType?.caster?.options?.ref ||
      schemaType?.$embeddedSchemaType?.options?.ref;

    if (!ref) return null;

    const modelName =
      typeof ref === "string"
        ? ref
        : ref.modelName;

    if (!modelName) return null;

    try {
      return parentModel.db.model(modelName);
    } catch {
      return null;
    }
  }

  private refreshQuery() {
    this.modelQuery = this.model.aggregate([
      ...this.pipeline,
    ]);

    return this;
  }

  // ==========================================
  // Product Lookup
  // ==========================================

  private ensureProductLookup() {
    if (this.productLookupApplied) return;

    this.productLookupApplied = true;

    if (!this.productModel) {
      throw new Error(
        "Product model is not registered."
      );
    }

    this.pipeline.push({
      $lookup: {
        from: this.productModel.collection.name,
        localField: "product",
        foreignField: "_id",
        as: "product",
      },
    });

    this.pipeline.push({
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true,
      },
    });

    if (this.departmentModel) {
      this.pipeline.push({
        $lookup: {
          from: this.departmentModel.collection.name,
          localField: "product.department",
          foreignField: "_id",
          as: "__department",
        },
      });

      this.pipeline.push({
        $addFields: {
          "product.department": {
            $ifNull: [
              {
                $arrayElemAt: [
                  "$__department",
                  0,
                ],
              },
              "$product.department",
            ],
          },
        },
      });

      this.pipeline.push({
        $project: {
          __department: 0,
        },
      });
    }

    if (this.categoryModel) {
      this.pipeline.push({
        $lookup: {
          from: this.categoryModel.collection.name,
          localField: "product.category",
          foreignField: "_id",
          as: "__category",
        },
      });

      this.pipeline.push({
        $addFields: {
          "product.category": {
            $ifNull: [
              {
                $arrayElemAt: [
                  "$__category",
                  0,
                ],
              },
              "$product.category",
            ],
          },
        },
      });

      this.pipeline.push({
        $project: {
          __category: 0,
        },
      });
    }
  }

  // ==========================================
  // Inventory Lookup
  // ==========================================

  private ensureInventoryLookup() {
    if (this.inventoryLookupApplied) return;

    this.inventoryLookupApplied = true;

    if (!this.inventoryModel) {
      throw new Error(
        "Inventory model is not registered."
      );
    }

    this.pipeline.push({
      $lookup: {
        from: this.inventoryModel.collection.name,
        localField: "_id",
        foreignField: "variant",
        pipeline: [
          {
            $match: {
              isDeleted: {
                $ne: true,
              },
              "seller.isStock": {
                $ne: false,
              },
              "seller.price": {
                $gt: 0,
              },
            },
          },
          {
            $sort: {
              "seller.price": 1,
              _id: 1,
            },
          },
        ],
        as: "__inventoryListings",
      },
    });

    // Buy Box Winner
    this.pipeline.push({
      $addFields: {
        __buyBoxWinner: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$__inventoryListings",
                as: "listing",
                cond: {
                  $eq: [
                    "$$listing.seller.isBuyBoxWinner",
                    true,
                  ],
                },
              },
            },
            0,
          ],
        },
      },
    });

    // Eligibility
    this.pipeline.push({
      $addFields: {
        __isEligible: {
          $ifNull: [
            "$isBuyBoxEligible",
            {
              $ne: [
                "$__buyBoxWinner",
                null,
              ],
            },
          ],
        },
      },
    });

    // Selected Listing
    this.pipeline.push({
      $addFields: {
        __selectedListing: {
          $cond: [
            "$__isEligible",

            {
              $ifNull: [
                "$__buyBoxWinner",
                {
                  $arrayElemAt: [
                    "$__inventoryListings",
                    0,
                  ],
                },
              ],
            },

            {
              $arrayElemAt: [
                "$__inventoryListings",
                0,
              ],
            },
          ],
        },
      },
    });

    // Selected price and vendor
    this.pipeline.push({
      $addFields: {
        price: {
          $ifNull: [
            "$__selectedListing.seller.price",
            null,
          ],
        },

        vendorId: {
          $ifNull: [
            "$__selectedListing.seller.vendor",
            null,
          ],
        },

        isBuyBoxEligible: "$__isEligible",
      },
    });
  }

  // ==========================================
  // Review Lookup
  // ==========================================

  private ensureReviewLookup() {
    if (this.reviewLookupApplied) return;

    this.reviewLookupApplied = true;

    if (!this.reviewModel) {
      throw new Error(
        "ProductReview model is not registered."
      );
    }

    this.pipeline.push({
      $lookup: {
        from: this.reviewModel.collection.name,
        localField: "_id",
        foreignField: "variant",
        pipeline: [
          {
            $match: {
              isDeleted: {
                $ne: true,
              },
            },
          },
          {
            $group: {
              _id: null,
              averageRating: {
                $avg: "$rating",
              },
              totalReviews: {
                $sum: 1,
              },
            },
          },
        ],
        as: "__reviewStats",
      },
    });

    this.pipeline.push({
      $addFields: {
        rating: {
          $round: [
            {
              $ifNull: [
                {
                  $arrayElemAt: [
                    "$__reviewStats.averageRating",
                    0,
                  ],
                },
                0,
              ],
            },
            1,
          ],
        },

        totalReviews: {
          $ifNull: [
            {
              $arrayElemAt: [
                "$__reviewStats.totalReviews",
                0,
              ],
            },
            0,
          ],
        },
      },
    });
  }

  // ==========================================
  // Search
  // ==========================================

  search(searchableFields: string[]) {
    this.searchableFields = searchableFields;

    const searchTerm = String(
      this.query?.searchTerm || ""
    ).trim();

    if (!searchTerm || !searchableFields.length) {
      return this;
    }

    const escapedTerm = searchTerm.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const regex = new RegExp(
      escapedTerm,
      "i"
    );

    const productFields = [
      "title",
      "brand",
      "tags",
      "features",
      "category",
      "department",
      "author",
    ];

    const conditions: Record<string, unknown>[] = [];

    for (const field of searchableFields) {
      const firstSegment = field.split(".")[0];

      if (this.productModel && productFields.includes(firstSegment) && !field.startsWith("product.")) {
        this.ensureProductLookup();

        conditions.push({
          [`product.${field}`]: regex,
        });
      } else {
        conditions.push({
          [field]: regex,
        });
      }
    }

    this.pipeline.push({
      $match: {
        $or: conditions,
      },
    });

    this.refreshQuery();

    return this;
  }

  // ==========================================
  // Filter
  // ==========================================

  filter() {
    const queryObj = {
      ...this.query,
    };

    const excludedFields = [
      "searchTerm",
      "sort",
      "limit",
      "page",
      "fields",
      "minPrice",
      "maxPrice",
      "minRating",
      "maxRating",
      "rating",
    ];

    excludedFields.forEach((field) => {
      delete queryObj[field];
    });

    const minPrice = Number(this.query.minPrice);
    const maxPrice = Number(this.query.maxPrice);

    const minRating = Number(this.query.minRating ?? this.query.rating);
    const maxRating = Number(this.query.maxRating);

    const hasPriceFilter =
      this.query.minPrice !== undefined ||
      this.query.maxPrice !== undefined;

    const hasRatingFilter =
      this.query.minRating !== undefined ||
      this.query.maxRating !== undefined ||
      this.query.rating !== undefined;

    const productFields = [
      "title",
      "brand",
      "tags",
      "features",
      "category",
      "department",
    ];

    const rootFilters: Record<string, unknown> = {};
    const productFilters: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(queryObj)) {
      if (this.productModel && productFields.includes(key)) {
        if (key === "department") {
          productFilters["product.department._id"] = Types.ObjectId.isValid(String(value))
            ? new Types.ObjectId(String(value))
            : value;
        } else if (key === "category") {
          productFilters["product.category._id"] = Types.ObjectId.isValid(String(value))
            ? new Types.ObjectId(String(value))
            : value;
        } else if (key === "brand") {
          productFilters["product.brand"] = new RegExp(`^${String(value).trim()}$`, "i");
        } else {
          productFilters[`product.${key}`] = value;
        }
      } else {
        if ((key === "department" || key === "category") && Types.ObjectId.isValid(String(value))) {
          rootFilters[key] = new Types.ObjectId(String(value));
        } else if (key === "brand" && typeof value === "string") {
          rootFilters[key] = new RegExp(`^${value.trim()}$`, "i");
        } else {
          rootFilters[key] = value;
        }
      }
    }

    if (Object.keys(rootFilters).length) {
      this.pipeline.push({
        $match: rootFilters,
      });
    }

    if (Object.keys(productFilters).length) {
      this.ensureProductLookup();

      this.pipeline.push({
        $match: productFilters,
      });
    }

    // Price Filter
    if (hasPriceFilter) {
      this.ensureInventoryLookup();

      const priceCondition: Record<string, number> = {
        $gt: 0,
      };

      if (Number.isFinite(minPrice)) {
        priceCondition.$gte = minPrice;
      }

      if (Number.isFinite(maxPrice)) {
        priceCondition.$lte = maxPrice;
      }

      this.pipeline.push({
        $match: {
          price: priceCondition,
        },
      });
    }

    // Rating Filter
    if (hasRatingFilter) {
      this.ensureReviewLookup();

      const ratingCondition: Record<string, number> = {};

      if (Number.isFinite(minRating)) {
        ratingCondition.$gte = minRating;
      }

      if (Number.isFinite(maxRating)) {
        ratingCondition.$lte = maxRating;
      }

      this.pipeline.push({
        $match: {
          rating: ratingCondition,
        },
      });
    }

    this.refreshQuery();

    return this;
  }

  // ==========================================
  // Sort
  // ==========================================

  sort() {
    const sortValue = String(
      this.query?.sort || "-createdAt"
    ).trim();

    const sortFields = sortValue.split(",");

    const sortObject: Record<string, 1 | -1> = {};

    const productFields = [
      "title",
      "brand",
      "tags",
      "features",
    ];

    for (const field of sortFields) {
      const trimmedField = field.trim();

      if (!trimmedField) continue;

      const direction: 1 | -1 =
        trimmedField.startsWith("-") ? -1 : 1;

      const fieldName = trimmedField.replace(
        /^[-+]/,
        ""
      );

      let sortField = fieldName;

      // Price
      if (fieldName === "price") {
        this.ensureInventoryLookup();

        sortField = "price";
      }

      // Rating
      else if (
        fieldName === "rating" ||
        fieldName === "totalReviews"
      ) {
        this.ensureReviewLookup();

        sortField = fieldName;
      }

      // Product fields
      else if (this.productModel && productFields.includes(fieldName)) {
        this.ensureProductLookup();

        sortField = `product.${fieldName}`;
      }

      // Category
      else if (this.productModel && fieldName === "category") {
        this.ensureProductLookup();

        sortField = "product.category.name";
      }

      // Department
      else if (this.productModel && fieldName === "department") {
        this.ensureProductLookup();

        sortField = "product.department.name";
      }

      sortObject[sortField] = direction;
    }

    this.pipeline.push({
      $sort: {
        ...sortObject,
        _id: 1,
      },
    });

    this.refreshQuery();

    return this;
  }

  // ==========================================
  // Pagination
  // ==========================================

  paginate() {
    const page = Math.max(
      1,
      Number(this.query?.page) || 1
    );

    const limit = Math.max(
      1,
      Number(this.query?.limit) || 10
    );

    const skip = (page - 1) * limit;

    this.pipeline.push({
      $skip: skip,
    });

    this.pipeline.push({
      $limit: limit,
    });

    this.refreshQuery();

    return this;
  }

  // ==========================================
  // Fields
  // ==========================================

  fields() {
    const fields = String(
      this.query?.fields || "-__v"
    );

    const selectedFields = fields
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean);

    const hasInclusion = selectedFields.some(
      (field) => !field.startsWith("-")
    );

    const projection: Record<string, 0 | 1> = {};

    if (hasInclusion) {
      selectedFields.forEach((field) => {
        if (field.startsWith("-")) {
          projection[field.substring(1)] = 0;
        } else {
          projection[field] = 1;
        }
      });

      projection._id = 1;
    } else {
      selectedFields.forEach((field) => {
        projection[field.substring(1)] = 0;
      });
    }

    this.pipeline.push({
      $project: projection,
    });

    this.refreshQuery();

    return this;
  }

  // ==========================================
  // Count Total
  // ==========================================

  async countTotal() {
    const countStages = this.pipeline.filter(
      (stage) =>
        !stage.$skip &&
        !stage.$limit &&
        !stage.$sort &&
        !stage.$project
    );

    const result = await this.model.aggregate([
      ...countStages,
      {
        $count: "total",
      },
    ]);

    const total = result[0]?.total || 0;

    const page = Math.max(
      1,
      Number(this.query?.page) || 1
    );

    const limit = Math.max(
      1,
      Number(this.query?.limit) || 10
    );

    return {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    };
  }
}

export default QueryBuilder;
