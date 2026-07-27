export type TDateRangeFilter = "7_days" | "30_days" | "90_days" | "12_months" | "custom";

export interface TDashboardQuery extends Record<string, unknown> {
  range?: TDateRangeFilter;
  startDate?: string;
  endDate?: string;
}
