import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name"),
  email: text("email"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  supabaseId: text("supabase_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dateOfBirth: date("date_of_birth"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  supabaseId: true,
}).partial({ supabaseId: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  institution: text("institution"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

export const liabilities = pgTable("liabilities", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  minimumPayment: numeric("minimum_payment", { precision: 10, scale: 2 }).default("0"),
  institution: text("institution"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertLiabilitySchema = createInsertSchema(liabilities).omit({
  id: true,
  createdAt: true,
});

export type InsertLiability = z.infer<typeof insertLiabilitySchema>;
export type Liability = typeof liabilities.$inferSelect;

export const insurancePolicies = pgTable("insurance_policies", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'auto' | 'home' | 'life' | 'annuity'
  name: text("name").notNull(),
  provider: text("provider"),
  policyNumber: text("policy_number"),
  premium: numeric("premium", { precision: 10, scale: 2 }),
  premiumFrequency: text("premium_frequency").default("monthly"), // monthly | quarterly | semi-annual | annual
  coverageAmount: numeric("coverage_amount", { precision: 15, scale: 2 }),
  deductible: numeric("deductible", { precision: 10, scale: 2 }),
  renewalDate: text("renewal_date"),
  // Auto specific
  vehicleYear: integer("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  // Home specific
  propertyAddress: text("property_address"),
  // Life specific
  lifeType: text("life_type"), // term | whole | universal | variable
  deathBenefit: numeric("death_benefit", { precision: 15, scale: 2 }),
  cashValue: numeric("cash_value", { precision: 15, scale: 2 }),
  beneficiary: text("beneficiary"),
  // Annuity specific
  annuityType: text("annuity_type"), // fixed | variable | indexed | immediate
  currentValue: numeric("current_value", { precision: 15, scale: 2 }),
  monthlyPayout: numeric("monthly_payout", { precision: 10, scale: 2 }),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
  surrenderPeriod: integer("surrender_period"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertInsurancePolicySchema = createInsertSchema(insurancePolicies).omit({
  id: true,
  createdAt: true,
});

export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;

export const incomeEntries = pgTable("income_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertIncomeEntrySchema = createInsertSchema(incomeEntries).omit({ id: true, createdAt: true });
export type InsertIncomeEntry = z.infer<typeof insertIncomeEntrySchema>;
export type IncomeEntry = typeof incomeEntries.$inferSelect;

export const expenseEntries = pgTable("expense_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("other"),
  type: text("type").notNull().default("need"), // 'need' | 'want'
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertExpenseEntrySchema = createInsertSchema(expenseEntries).omit({ id: true, createdAt: true });
export type InsertExpenseEntry = z.infer<typeof insertExpenseEntrySchema>;
export type ExpenseEntry = typeof expenseEntries.$inferSelect;

export const recommendationSettings = pgTable("recommendation_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // Savings thresholds
  checkingThreshold: numeric("checking_threshold", { precision: 15, scale: 2 }),
  savingsThreshold: numeric("savings_threshold", { precision: 15, scale: 2 }),
  cdsThreshold: numeric("cds_threshold", { precision: 15, scale: 2 }),
  // Borrowing thresholds
  studentLoanThreshold: numeric("student_loan_threshold", { precision: 15, scale: 2 }),
  creditCardThreshold: numeric("credit_card_threshold", { precision: 15, scale: 2 }),
  autoLoanThreshold: numeric("auto_loan_threshold", { precision: 15, scale: 2 }),
  personalLoanThreshold: numeric("personal_loan_threshold", { precision: 15, scale: 2 }),
  mortgageThreshold: numeric("mortgage_threshold", { precision: 15, scale: 2 }),
  // Insurance thresholds
  autoInsuranceThreshold: numeric("auto_insurance_threshold", { precision: 15, scale: 2 }),
  homeInsuranceThreshold: numeric("home_insurance_threshold", { precision: 15, scale: 2 }),
  lifeInsuranceThreshold: numeric("life_insurance_threshold", { precision: 15, scale: 2 }),
  otherInsuranceThreshold: numeric("other_insurance_threshold", { precision: 15, scale: 2 }),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertRecommendationSettingsSchema = createInsertSchema(recommendationSettings).omit({ id: true, updatedAt: true });
export type InsertRecommendationSettings = z.infer<typeof insertRecommendationSettingsSchema>;
export type RecommendationSettings = typeof recommendationSettings.$inferSelect;

export const INCOME_CATEGORIES = [
  { value: "salary", label: "Salary / Wages" },
  { value: "freelance", label: "Freelance / Contract" },
  { value: "business", label: "Business Income" },
  { value: "investment", label: "Investment Returns" },
  { value: "rental", label: "Rental Income" },
  { value: "pension", label: "Pension / Retirement" },
  { value: "social_security", label: "Social Security" },
  { value: "other", label: "Other" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "housing", label: "Housing / Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "groceries", label: "Groceries" },
  { value: "transport", label: "Transportation" },
  { value: "healthcare", label: "Healthcare" },
  { value: "insurance", label: "Insurance" },
  { value: "education", label: "Education" },
  { value: "childcare", label: "Childcare" },
  { value: "dining", label: "Dining Out" },
  { value: "entertainment", label: "Entertainment" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "shopping", label: "Shopping" },
  { value: "travel", label: "Travel" },
  { value: "personal_care", label: "Personal Care" },
  { value: "hobbies", label: "Hobbies" },
  { value: "other", label: "Other" },
] as const;

export const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;

export const ASSET_CATEGORIES = [
  { value: "bank_account", label: "Checking Account" },
  { value: "savings_account", label: "Savings Account" },
  { value: "investment", label: "Investment" },
  { value: "property", label: "Property" },
  { value: "cash", label: "Cash" },
  { value: "crypto", label: "Crypto" },
  { value: "retirement_fund", label: "Retirement Fund" },
  { value: "other", label: "Other" },
] as const;

export const retirement401kGoals = pgTable("retirement_401k_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currentAge: integer("current_age").notNull().default(35),
  retirementAge: integer("retirement_age").notNull().default(65),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).notNull().default("25000"),
  annualSalary: numeric("annual_salary", { precision: 15, scale: 2 }).notNull().default("80000"),
  contributionPct: numeric("contribution_pct", { precision: 5, scale: 2 }).notNull().default("10"),
  employerMatchPct: numeric("employer_match_pct", { precision: 5, scale: 2 }).notNull().default("4"),
  employerMatchLimit: numeric("employer_match_limit", { precision: 5, scale: 2 }).notNull().default("50"),
  expectedReturn: numeric("expected_return", { precision: 5, scale: 2 }).notNull().default("7"),
  taxBracket: numeric("tax_bracket", { precision: 5, scale: 2 }).notNull().default("22"),
  rothTaxRate: numeric("roth_tax_rate", { precision: 5, scale: 2 }).notNull().default("20"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertRetirement401kGoalSchema = createInsertSchema(retirement401kGoals).omit({
  id: true,
  createdAt: true,
});

export type InsertRetirement401kGoal = z.infer<typeof insertRetirement401kGoalSchema>;
export type Retirement401kGoal = typeof retirement401kGoals.$inferSelect;

export const bankConfigs = pgTable("bank_configs", {
  id: serial("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  bankUrl: text("bank_url").notNull(),
  selectorsJson: text("selectors_json").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBankConfigSchema = createInsertSchema(bankConfigs).omit({ id: true, createdAt: true });
export type InsertBankConfig = z.infer<typeof insertBankConfigSchema>;
export type BankConfig = typeof bankConfigs.$inferSelect;

export const bankRates = pgTable("bank_rates", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull().references(() => bankConfigs.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  rateType: text("rate_type").notNull(),
  rateName: text("rate_name").notNull(),
  rateValue: text("rate_value").notNull(),
  scrapedAt: timestamp("scraped_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertBankRateSchema = createInsertSchema(bankRates).omit({ id: true, scrapedAt: true });
export type InsertBankRate = z.infer<typeof insertBankRateSchema>;
export type BankRate = typeof bankRates.$inferSelect;

export const plaidItems = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  itemId: text("item_id").notNull().unique(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastSynced: timestamp("last_synced"),
});

export const insertPlaidItemSchema = createInsertSchema(plaidItems).omit({ id: true, createdAt: true });
export type InsertPlaidItem = z.infer<typeof insertPlaidItemSchema>;
export type PlaidItem = typeof plaidItems.$inferSelect;

export const plaidAccounts = pgTable("plaid_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plaidItemId: integer("plaid_item_id").notNull().references(() => plaidItems.id, { onDelete: "cascade" }),
  plaidAccountId: text("plaid_account_id").notNull().unique(),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 15, scale: 2 }),
  linkedAssetId: integer("linked_asset_id"),
  linkedLiabilityId: integer("linked_liability_id"),
  lastUpdated: timestamp("last_updated").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPlaidAccountSchema = createInsertSchema(plaidAccounts).omit({ id: true, lastUpdated: true });
export type InsertPlaidAccount = z.infer<typeof insertPlaidAccountSchema>;
export type PlaidAccount = typeof plaidAccounts.$inferSelect;

export const LIABILITY_CATEGORIES = [
  { value: "credit_card", label: "Credit Card" },
  { value: "mortgage", label: "Mortgage" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "other", label: "Other" },
] as const;

// ── Estate & Legacy Planning ─────────────────────────────────────────────────

export const estateBeneficiaries = pgTable("estate_beneficiaries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  hasBeneficiary: boolean("has_beneficiary").default(false).notNull(),
  beneficiaryName: text("beneficiary_name"),
  notes: text("notes"),
});

export const insertEstateBeneficiarySchema = createInsertSchema(estateBeneficiaries).omit({ id: true });
export type InsertEstateBeneficiary = z.infer<typeof insertEstateBeneficiarySchema>;
export type EstateBeneficiary = typeof estateBeneficiaries.$inferSelect;

export const estateDocuments = pgTable("estate_documents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  isComplete: boolean("is_complete").default(false).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertEstateDocumentSchema = createInsertSchema(estateDocuments).omit({ id: true, updatedAt: true });
export type InsertEstateDocument = z.infer<typeof insertEstateDocumentSchema>;
export type EstateDocument = typeof estateDocuments.$inferSelect;

export const estateContacts = pgTable("estate_contacts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  email: text("email"),
  firm: text("firm"),
  notes: text("notes"),
});

export const insertEstateContactSchema = createInsertSchema(estateContacts).omit({ id: true });
export type InsertEstateContact = z.infer<typeof insertEstateContactSchema>;
export type EstateContact = typeof estateContacts.$inferSelect;

export const ESTATE_DOCUMENT_TYPES = [
  { key: "will", label: "Last Will & Testament" },
  { key: "trust", label: "Revocable Living Trust" },
  { key: "poa_financial", label: "Durable Power of Attorney (Financial)" },
  { key: "poa_healthcare", label: "Healthcare Power of Attorney" },
  { key: "living_will", label: "Living Will / Advance Directive" },
  { key: "hipaa", label: "HIPAA Authorization" },
  { key: "beneficiary_designations", label: "Beneficiary Designations Updated" },
  { key: "letter_of_intent", label: "Letter of Intent / Final Instructions" },
] as const;

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export const contactus = pgTable("contactus", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertContactusSchema = createInsertSchema(contactus).omit({
  id: true,
  createdAt: true,
});
export type InsertContactus = z.infer<typeof insertContactusSchema>;
export type Contactus = typeof contactus.$inferSelect;

// ── Net Worth History ────────────────────────────────────────────────────────

export const assetHistory = pgTable("asset_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  institution: text("institution"),
  notes: text("notes"),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});

export type AssetHistory = typeof assetHistory.$inferSelect;

export const liabilityHistory = pgTable("liability_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  liabilityId: integer("liability_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).default("0"),
  minimumPayment: numeric("minimum_payment", { precision: 10, scale: 2 }).default("0"),
  institution: text("institution"),
  notes: text("notes"),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
});

export type LiabilityHistory = typeof liabilityHistory.$inferSelect;

// ── Social Security Settings ──────────────────────────────────────────────────

export const socialSecuritySettings = pgTable("social_security_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fraMonthlyBenefit: numeric("fra_monthly_benefit", { precision: 10, scale: 2 }).default("2000"),
  expectedLifeAge: integer("expected_life_age").default(85),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SocialSecuritySettings = typeof socialSecuritySettings.$inferSelect;
export type InsertSocialSecuritySettings = typeof socialSecuritySettings.$inferInsert;

// ── User Goals ────────────────────────────────────────────────────────────────

export const userGoals = pgTable("user_goals", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("custom"),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  targetDate: date("target_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserGoal = typeof userGoals.$inferSelect;
export type InsertUserGoal = typeof userGoals.$inferInsert;

// ── Estate Contact Roles ─────────────────────────────────────────────────────

export const ESTATE_CONTACT_ROLES = [
  { value: "attorney", label: "Estate Attorney" },
  { value: "executor", label: "Executor / Personal Representative" },
  { value: "trustee", label: "Trustee" },
  { value: "financial_advisor", label: "Financial Advisor" },
  { value: "accountant", label: "Accountant / CPA" },
  { value: "guardian", label: "Guardian (for minors)" },
  { value: "other", label: "Other" },
] as const;
