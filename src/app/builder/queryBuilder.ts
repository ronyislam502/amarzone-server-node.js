import { FilterQuery, Query } from "mongoose";

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  search(searchableFields: string[]) {
    const searchTerm = this?.query?.searchTerm;
    if (searchTerm && searchableFields.length > 0) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: { $regex: searchTerm, $options: "i" },
            }) as FilterQuery<T>
        ),
      });
    }

    return this;
  }

  filter() {
    const queryObj = { ...this.query }; // copy

    // Filtering
    const excludeFields = [
      "searchTerm",
      "sort",
      "limit",
      "page",
      "fields",
      "deptName",
      "categoryName",
      "all",
      "minPrice",
      "maxPrice",
      "minRating",
      "inStock",
      "brands",
    ];

    excludeFields.forEach((el) => delete queryObj[el]);

    // Handle minPrice and maxPrice range filtering
    if (
      (this.query.minPrice !== undefined && this.query.minPrice !== "") ||
      (this.query.maxPrice !== undefined && this.query.maxPrice !== "")
    ) {
      const priceFilter: Record<string, number> = {};
      if (this.query.minPrice !== undefined && this.query.minPrice !== "") {
        priceFilter.$gte = Number(this.query.minPrice);
      }
      if (this.query.maxPrice !== undefined && this.query.maxPrice !== "") {
        priceFilter.$lte = Number(this.query.maxPrice);
      }
      if (Object.keys(priceFilter).length > 0) {
        (queryObj as any).minPrice = priceFilter;
      }
    }

    // Handle customer rating filtering (e.g. 4★ & Up)
    if (this.query.minRating !== undefined && this.query.minRating !== "") {
      (queryObj as any).averageRating = { $gte: Number(this.query.minRating) };
    }

    // Handle in-stock filter
    if (this.query.inStock === "true" || this.query.inStock === true) {
      (queryObj as any).inStock = true;
    }

    // Handle brands filter (supports comma-separated list or array)
    if (this.query.brands) {
      const brandList = Array.isArray(this.query.brands)
        ? this.query.brands
        : (this.query.brands as string)
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean);
      if (brandList.length > 0) {
        (queryObj as any).brand = { $in: brandList };
      }
    }

    this.modelQuery = this.modelQuery.find(queryObj as FilterQuery<T>);

    return this;
  }

  sort() {
    const sort =
      (this?.query?.sort as string)?.split(",")?.join(" ") || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sort as string);

    return this;
  }

  paginate() {
    const limitParam = this?.query?.limit;
    if (
      limitParam === "all" ||
      limitParam === "0" ||
      limitParam === 0 ||
      this?.query?.all === "true" ||
      this?.query?.all === true
    ) {
      return this;
    }
    const page = Number(this?.query?.page) || 1;
    const limit = Number(limitParam) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    return this;
  }

  fields() {
    const fields =
      (this?.query?.fields as string)?.split(",")?.join(" ") || "-__v";

    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }
  async countTotal() {
    const totalQueries = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(totalQueries);
    const limitParam = this?.query?.limit;
    if (
      limitParam === "all" ||
      limitParam === "0" ||
      limitParam === 0 ||
      this?.query?.all === "true" ||
      this?.query?.all === true
    ) {
      return {
        page: 1,
        limit: total,
        total,
        totalPage: 1,
      };
    }
    const page = Number(this?.query?.page) || 1;
    const limit = Number(limitParam) || 100;
    const totalPage = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }
}

export default QueryBuilder;
