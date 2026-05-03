import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  type User, type InsertUser,
  type Asset, type InsertAsset,
  type Liability, type InsertLiability,
  type RetirementGoal, type InsertRetirementGoal,
  type Retirement401kGoal, type InsertRetirement401kGoal,
  type InsurancePolicy, type InsertInsurancePolicy,
  type IncomeEntry, type InsertIncomeEntry,
  type ExpenseEntry, type InsertExpenseEntry,
  type RecommendationSettings, type InsertRecommendationSettings,
  type BankConfig, type InsertBankConfig,
  type BankRate, type InsertBankRate,
  type PlaidItem, type InsertPlaidItem,
  type PlaidAccount, type InsertPlaidAccount,
  users, assets, liabilities, retirementGoals, retirement401kGoals, insurancePolicies, incomeEntries, expenseEntries, recommendationSettings,
  bankConfigs, bankRates, plaidItems, plaidAccounts,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getAssets(userId: string): Promise<Asset[]>;
  getAsset(id: number, userId: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, userId: string, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number, userId: string): Promise<void>;

  getLiabilities(userId: string): Promise<Liability[]>;
  getLiability(id: number, userId: string): Promise<Liability | undefined>;
  createLiability(liability: InsertLiability): Promise<Liability>;
  updateLiability(id: number, userId: string, data: Partial<InsertLiability>): Promise<Liability | undefined>;
  deleteLiability(id: number, userId: string): Promise<void>;

  getRetirementGoal(userId: string): Promise<RetirementGoal | undefined>;
  upsertRetirementGoal(goal: InsertRetirementGoal): Promise<RetirementGoal>;

  getRetirement401kGoal(userId: string): Promise<Retirement401kGoal | undefined>;
  upsertRetirement401kGoal(goal: InsertRetirement401kGoal): Promise<Retirement401kGoal>;

  getInsurancePolicies(userId: string): Promise<InsurancePolicy[]>;
  getInsurancePolicy(id: number, userId: string): Promise<InsurancePolicy | undefined>;
  createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy>;
  updateInsurancePolicy(id: number, userId: string, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy | undefined>;
  deleteInsurancePolicy(id: number, userId: string): Promise<void>;

  getIncomeEntries(userId: string): Promise<IncomeEntry[]>;
  createIncomeEntry(entry: InsertIncomeEntry): Promise<IncomeEntry>;
  updateIncomeEntry(id: number, userId: string, data: Partial<InsertIncomeEntry>): Promise<IncomeEntry | undefined>;
  deleteIncomeEntry(id: number, userId: string): Promise<void>;

  getExpenseEntries(userId: string): Promise<ExpenseEntry[]>;
  createExpenseEntry(entry: InsertExpenseEntry): Promise<ExpenseEntry>;
  updateExpenseEntry(id: number, userId: string, data: Partial<InsertExpenseEntry>): Promise<ExpenseEntry | undefined>;
  deleteExpenseEntry(id: number, userId: string): Promise<void>;

  getRecommendationSettings(userId: string): Promise<RecommendationSettings | undefined>;
  upsertRecommendationSettings(data: InsertRecommendationSettings): Promise<RecommendationSettings>;

  getBankConfigs(): Promise<BankConfig[]>;
  getBankConfig(id: number): Promise<BankConfig | undefined>;
  createBankConfig(data: InsertBankConfig): Promise<BankConfig>;
  updateBankConfig(id: number, data: Partial<InsertBankConfig>): Promise<BankConfig | undefined>;
  deleteBankConfig(id: number): Promise<void>;

  getBankRates(configId?: number, rateType?: string, limit?: number): Promise<BankRate[]>;
  createBankRate(data: InsertBankRate): Promise<BankRate>;
  deleteBankRate(id: number): Promise<void>;
  deleteBankRatesByConfig(configId: number): Promise<void>;

  getPlaidItems(userId: string): Promise<PlaidItem[]>;
  getPlaidItemByItemId(itemId: string): Promise<PlaidItem | undefined>;
  createPlaidItem(data: InsertPlaidItem): Promise<PlaidItem>;
  deletePlaidItem(id: number, userId: string): Promise<void>;

  getPlaidAccounts(userId: string): Promise<PlaidAccount[]>;
  getPlaidAccountsByItem(plaidItemId: number): Promise<PlaidAccount[]>;
  upsertPlaidAccount(data: InsertPlaidAccount): Promise<PlaidAccount>;
  deletePlaidAccountsByItem(plaidItemId: number): Promise<void>;
  updatePlaidItem(id: number, data: Partial<PlaidItem>): Promise<PlaidItem | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async getAssets(userId: string): Promise<Asset[]> {
    return db.select().from(assets).where(eq(assets.userId, userId));
  }

  async getAsset(id: number, userId: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(and(eq(assets.id, id), eq(assets.userId, userId)));
    return asset;
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [created] = await db.insert(assets).values(asset).returning();
    return created;
  }

  async updateAsset(id: number, userId: string, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [updated] = await db.update(assets).set(data).where(and(eq(assets.id, id), eq(assets.userId, userId))).returning();
    return updated;
  }

  async deleteAsset(id: number, userId: string): Promise<void> {
    await db.delete(assets).where(and(eq(assets.id, id), eq(assets.userId, userId)));
  }

  async getLiabilities(userId: string): Promise<Liability[]> {
    return db.select().from(liabilities).where(eq(liabilities.userId, userId));
  }

  async getLiability(id: number, userId: string): Promise<Liability | undefined> {
    const [liability] = await db.select().from(liabilities).where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)));
    return liability;
  }

  async createLiability(liability: InsertLiability): Promise<Liability> {
    const [created] = await db.insert(liabilities).values(liability).returning();
    return created;
  }

  async updateLiability(id: number, userId: string, data: Partial<InsertLiability>): Promise<Liability | undefined> {
    const [updated] = await db.update(liabilities).set(data).where(and(eq(liabilities.id, id), eq(liabilities.userId, userId))).returning();
    return updated;
  }

  async deleteLiability(id: number, userId: string): Promise<void> {
    await db.delete(liabilities).where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)));
  }

  async getRetirementGoal(userId: string): Promise<RetirementGoal | undefined> {
    const [goal] = await db.select().from(retirementGoals).where(eq(retirementGoals.userId, userId));
    return goal;
  }

  async upsertRetirementGoal(goal: InsertRetirementGoal): Promise<RetirementGoal> {
    const existing = await this.getRetirementGoal(goal.userId);
    if (existing) {
      const [updated] = await db.update(retirementGoals).set(goal).where(eq(retirementGoals.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(retirementGoals).values(goal).returning();
    return created;
  }

  async getRetirement401kGoal(userId: string): Promise<Retirement401kGoal | undefined> {
    const [goal] = await db.select().from(retirement401kGoals).where(eq(retirement401kGoals.userId, userId));
    return goal;
  }

  async upsertRetirement401kGoal(goal: InsertRetirement401kGoal): Promise<Retirement401kGoal> {
    const existing = await this.getRetirement401kGoal(goal.userId);
    if (existing) {
      const [updated] = await db.update(retirement401kGoals).set(goal).where(eq(retirement401kGoals.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(retirement401kGoals).values(goal).returning();
    return created;
  }

  async getInsurancePolicies(userId: string): Promise<InsurancePolicy[]> {
    return db.select().from(insurancePolicies).where(eq(insurancePolicies.userId, userId));
  }

  async getInsurancePolicy(id: number, userId: string): Promise<InsurancePolicy | undefined> {
    const [policy] = await db.select().from(insurancePolicies).where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, userId)));
    return policy;
  }

  async createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy> {
    const [created] = await db.insert(insurancePolicies).values(policy).returning();
    return created;
  }

  async updateInsurancePolicy(id: number, userId: string, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy | undefined> {
    const [updated] = await db.update(insurancePolicies).set(data).where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, userId))).returning();
    return updated;
  }

  async deleteInsurancePolicy(id: number, userId: string): Promise<void> {
    await db.delete(insurancePolicies).where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, userId)));
  }

  async getIncomeEntries(userId: string): Promise<IncomeEntry[]> {
    return db.select().from(incomeEntries).where(eq(incomeEntries.userId, userId));
  }
  async createIncomeEntry(entry: InsertIncomeEntry): Promise<IncomeEntry> {
    const [created] = await db.insert(incomeEntries).values(entry).returning();
    return created;
  }
  async updateIncomeEntry(id: number, userId: string, data: Partial<InsertIncomeEntry>): Promise<IncomeEntry | undefined> {
    const [updated] = await db.update(incomeEntries).set(data).where(and(eq(incomeEntries.id, id), eq(incomeEntries.userId, userId))).returning();
    return updated;
  }
  async deleteIncomeEntry(id: number, userId: string): Promise<void> {
    await db.delete(incomeEntries).where(and(eq(incomeEntries.id, id), eq(incomeEntries.userId, userId)));
  }

  async getExpenseEntries(userId: string): Promise<ExpenseEntry[]> {
    return db.select().from(expenseEntries).where(eq(expenseEntries.userId, userId));
  }
  async createExpenseEntry(entry: InsertExpenseEntry): Promise<ExpenseEntry> {
    const [created] = await db.insert(expenseEntries).values(entry).returning();
    return created;
  }
  async updateExpenseEntry(id: number, userId: string, data: Partial<InsertExpenseEntry>): Promise<ExpenseEntry | undefined> {
    const [updated] = await db.update(expenseEntries).set(data).where(and(eq(expenseEntries.id, id), eq(expenseEntries.userId, userId))).returning();
    return updated;
  }
  async deleteExpenseEntry(id: number, userId: string): Promise<void> {
    await db.delete(expenseEntries).where(and(eq(expenseEntries.id, id), eq(expenseEntries.userId, userId)));
  }

  async getRecommendationSettings(userId: string): Promise<RecommendationSettings | undefined> {
    const [settings] = await db.select().from(recommendationSettings).where(eq(recommendationSettings.userId, userId));
    return settings;
  }

  async upsertRecommendationSettings(data: InsertRecommendationSettings): Promise<RecommendationSettings> {
    const [settings] = await db
      .insert(recommendationSettings)
      .values({ ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: recommendationSettings.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return settings;
  }

  async getBankConfigs(): Promise<BankConfig[]> {
    return db.select().from(bankConfigs).orderBy(bankConfigs.bankName);
  }

  async getBankConfig(id: number): Promise<BankConfig | undefined> {
    const [config] = await db.select().from(bankConfigs).where(eq(bankConfigs.id, id));
    return config;
  }

  async createBankConfig(data: InsertBankConfig): Promise<BankConfig> {
    const [created] = await db.insert(bankConfigs).values(data).returning();
    return created;
  }

  async updateBankConfig(id: number, data: Partial<InsertBankConfig>): Promise<BankConfig | undefined> {
    const [updated] = await db.update(bankConfigs).set(data).where(eq(bankConfigs.id, id)).returning();
    return updated;
  }

  async deleteBankConfig(id: number): Promise<void> {
    await db.delete(bankConfigs).where(eq(bankConfigs.id, id));
  }

  async getBankRates(configId?: number, rateType?: string, limit = 200): Promise<BankRate[]> {
    let query = db.select().from(bankRates).orderBy(desc(bankRates.scrapedAt)).$dynamic();
    if (configId !== undefined) {
      query = query.where(eq(bankRates.configId, configId));
    }
    return query.limit(limit);
  }

  async createBankRate(data: InsertBankRate): Promise<BankRate> {
    const [created] = await db.insert(bankRates).values(data).returning();
    return created;
  }

  async deleteBankRate(id: number): Promise<void> {
    await db.delete(bankRates).where(eq(bankRates.id, id));
  }

  async deleteBankRatesByConfig(configId: number): Promise<void> {
    await db.delete(bankRates).where(eq(bankRates.configId, configId));
  }

  async getPlaidItems(userId: string): Promise<PlaidItem[]> {
    return db.select().from(plaidItems).where(eq(plaidItems.userId, userId));
  }

  async getPlaidItemByItemId(itemId: string): Promise<PlaidItem | undefined> {
    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.itemId, itemId));
    return item;
  }

  async createPlaidItem(data: InsertPlaidItem): Promise<PlaidItem> {
    const [created] = await db.insert(plaidItems).values(data).returning();
    return created;
  }

  async deletePlaidItem(id: number, userId: string): Promise<void> {
    await db.delete(plaidItems).where(and(eq(plaidItems.id, id), eq(plaidItems.userId, userId)));
  }

  async updatePlaidItem(id: number, data: Partial<PlaidItem>): Promise<PlaidItem | undefined> {
    const [updated] = await db.update(plaidItems).set(data).where(eq(plaidItems.id, id)).returning();
    return updated;
  }

  async getPlaidAccounts(userId: string): Promise<PlaidAccount[]> {
    return db.select().from(plaidAccounts).where(eq(plaidAccounts.userId, userId));
  }

  async getPlaidAccountsByItem(plaidItemId: number): Promise<PlaidAccount[]> {
    return db.select().from(plaidAccounts).where(eq(plaidAccounts.plaidItemId, plaidItemId));
  }

  async upsertPlaidAccount(data: InsertPlaidAccount): Promise<PlaidAccount> {
    const [result] = await db
      .insert(plaidAccounts)
      .values({ ...data, lastUpdated: new Date() })
      .onConflictDoUpdate({
        target: plaidAccounts.plaidAccountId,
        set: {
          name: data.name,
          officialName: data.officialName,
          currentBalance: data.currentBalance,
          availableBalance: data.availableBalance,
          lastUpdated: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deletePlaidAccountsByItem(plaidItemId: number): Promise<void> {
    await db.delete(plaidAccounts).where(eq(plaidAccounts.plaidItemId, plaidItemId));
  }
}

export const storage = new DatabaseStorage();
