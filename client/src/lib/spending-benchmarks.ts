export type BenchmarkSummary = {
  period: { startMonth: string | null; endMonth: string | null; months: number };
  averages: { expenses: number };
  categories: {
    type: string; categoryId?: number | null; subcategory: string;
    average: number; total: number; transactionCount: number;
  }[];
};

export const BENCHMARK_SOURCE = {
  name: "BLS Consumer Expenditure Survey",
  year: 2024,
  url: "https://www.bls.gov/news.release/archives/cesan_12192025.htm",
  population: "All U.S. consumer units (households and financially independent individuals)",
  methodology: "Survey annual averages are divided by 12. Your averages use the same completed-month period as Monthly Averages, up to 12 months. Only clearly mapped categories are compared. National averages are not personalized for income, household size or location, are not inflation-adjusted, and are not recommended budgets. Missing transactions do not establish zero spending.",
};

// BLS Table A, 2024 annual dollars, published December 19, 2025.
// Broad categories such as Insurance, Shopping and Housing are deliberately
// omitted: the application's buckets do not align cleanly with the survey.
const BENCHMARKS = [
  { key: "groceries", label: "Groceries", annual: 6224, category: "Groceries", surveyCategory: "Food at home" },
  { key: "dining", label: "Dining out", annual: 3945, category: "Dining Out", surveyCategory: "Food away from home" },
  { key: "entertainment", label: "Entertainment", annual: 3609, category: "Entertainment", surveyCategory: "Entertainment" },
  { key: "personal-care", label: "Personal care", annual: 978, category: "Personal Care", surveyCategory: "Personal care products and services" },
  { key: "education", label: "Education", annual: 1569, category: "Education", surveyCategory: "Education" },
] as const;

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildSpendingBenchmarks(summary: BenchmarkSummary) {
  const expenseCategories = summary.categories.filter((category) => category.type.toLowerCase() === "expense");
  const rows = BENCHMARKS.map((benchmark) => {
    const matches = expenseCategories.filter((category) => normalize(category.subcategory) === normalize(benchmark.category));
    const userMonthly = matches.reduce((sum, category) => sum + category.average, 0);
    const benchmarkMonthly = benchmark.annual / 12;
    return {
      key: benchmark.key, label: benchmark.label, surveyCategory: benchmark.surveyCategory,
      userMonthly, benchmarkMonthly, delta: userMonthly - benchmarkMonthly,
      hasActivity: matches.some((category) => category.transactionCount > 0),
    };
  });
  const totalMonthly = summary.averages.expenses;
  const matchedMonthly = rows.reduce((sum, row) => sum + row.userMonthly, 0);
  return {
    rows, matchedMonthly, totalMonthly,
    unmatchedMonthly: Math.max(0, totalMonthly - matchedMonthly),
    coveragePercent: totalMonthly > 0 ? Math.min(100, Math.max(0, matchedMonthly / totalMonthly * 100)) : 0,
  };
}
