export type PlanId = "free" | "plus" | "pro" | "custom";
export type FeatureValue = boolean | string;

export interface PricingPlan {
  id: PlanId;
  name: string;
  price: string;
  cadence?: string;
  description: string;
  badge?: string;
  cta: string;
  features: Record<string, FeatureValue>;
  highlights: string[];
}

export interface PricingFeature {
  id: string;
  label: string;
  description?: string;
  /** Hide a comparison row without removing its label from plan highlights. */
  compare?: boolean;
}

export interface PricingFeatureGroup {
  title: string;
  features: PricingFeature[];
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "/ month",
    description: "A clear starting point for your whole financial picture.",
    cta: "Get Started",
    features: {
      netWorth: true,
      budgeting: true,
      retirement: true,
      protection: true,
      estate: true,
      copilot: true,
      recommendations: true,
      manualEntry: true,
      fileUploads: true,
      plaidAccounts: false,
      insuranceAccounts: false,
    },
    highlights: ["netWorth", "budgeting", "retirement", "copilot"],
  },
  {
    id: "plus",
    name: "Plus",
    price: "$TBD",
    cadence: "/ month",
    description: "Less manual work. The same complete view.",
    badge: "Most popular",
    cta: "Get Started",
    features: {
      netWorth: true,
      budgeting: true,
      retirement: true,
      protection: true,
      estate: true,
      copilot: true,
      recommendations: true,
      manualEntry: true,
      fileUploads: true,
      plaidAccounts: "Up to 4 accounts",
      insuranceAccounts: false,
    },
    highlights: ["netWorth", "budgeting", "plaidAccounts", "copilot"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$TBD",
    cadence: "/ month",
    description: "More connected accounts for a more connected plan.",
    cta: "Get Started",
    features: {
      netWorth: true,
      budgeting: true,
      retirement: true,
      protection: true,
      estate: true,
      copilot: true,
      recommendations: true,
      manualEntry: true,
      fileUploads: true,
      plaidAccounts: "Up to 10 accounts",
      insuranceAccounts: "Up to 1 account",
    },
    highlights: ["netWorth", "plaidAccounts", "insuranceAccounts", "copilot"],
  },
  {
    id: "custom",
    name: "Custom",
    price: "Custom",
    cadence: "pricing",
    description: "A financial workspace shaped around your needs.",
    cta: "Get Started",
    features: {
      netWorth: "Tailored to your needs",
      budgeting: "Tailored to your needs",
      retirement: "Tailored to your needs",
      protection: "Tailored to your needs",
      estate: "Tailored to your needs",
      copilot: "Tailored to your needs",
      recommendations: "Tailored to your needs",
      manualEntry: "Tailored to your needs",
      fileUploads: "Tailored to your needs",
      plaidAccounts: "Tailored to your needs",
      insuranceAccounts: "Tailored to your needs",
    },
    highlights: ["plaidAccounts", "insuranceAccounts", "copilot"],
  },
];

export const pricingFeatureGroups: PricingFeatureGroup[] = [
  {
    title: "See the whole picture",
    features: [
      { id: "netWorth", label: "Real-time net worth" },
      { id: "budgeting", label: "Budget planning" },
      { id: "retirement", label: "Retirement projections" },
      { id: "protection", label: "Wealth protection" },
      { id: "estate", label: "Estate tracker" },
    ],
  },
  {
    title: "Plan with perspective",
    features: [
      { id: "copilot", label: "AI Copilot" },
      { id: "recommendations", label: "Automated recommendations" },
    ],
  },
  {
    title: "Bring your accounts together",
    features: [
      { id: "manualEntry", label: "Manual entry" },
      { id: "fileUploads", label: "File uploads" },
      { id: "plaidAccounts", label: "Plaid account connections" },
      { id: "insuranceAccounts", label: "Insurance account integration" },
    ],
  },
];

export const pricingFeatureLabels = Object.fromEntries(
  pricingFeatureGroups.flatMap((group) => group.features.map(({ id, label }) => [id, label])),
) as Record<string, string>;
