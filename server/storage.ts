import { eq, and, desc, asc } from "drizzle-orm";
import { db, pool } from "./db";
import {
  type User, type InsertUser,
  type Asset, type InsertAsset,
  type Liability, type InsertLiability,
  type Retirement401kGoal, type InsertRetirement401kGoal,
  type RetirementPension, type InsertRetirementPension,
  type InsurancePolicy, type InsertInsurancePolicy,
  type RecommendationSettings, type InsertRecommendationSettings,
  type BankConfig, type InsertBankConfig,
  type BankRate, type InsertBankRate,
  type PlaidItem, type InsertPlaidItem,
  type PlaidAccount, type InsertPlaidAccount,
  type EstateBeneficiaryWithEntries,
  type EstateDocument, type InsertEstateDocument,
  type EstateContact, type InsertEstateContact,
  type Feedback, type InsertFeedback,
  users, assets, liabilities, assetTypeList, liabilitiesTypeList, retirement401kGoals, retirementPensions, insurancePolicies, recommendationSettings,
  bankConfigs, bankRates, plaidItems, plaidAccounts,
  estateBeneficiaries, estateDocuments, estateContacts, feedback, contactus, socialSecuritySettings,
  userGoals,
  type InsertContactus, type Contactus,
  type SocialSecuritySettings, type InsertSocialSecuritySettings,
  type UserGoal, type InsertUserGoal,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserBySupabaseId(supabaseId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserFromSupabase(supabaseId: string, email: string, fullName?: string): Promise<User>;
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
  getAssetCategories(): Promise<Array<{ parentCategory: string; category: string; description: string }>>;
  getLiabilityCategories(): Promise<Array<{ parentCategory: string; category: string; description: string }>>;

  getRetirement401kGoal(userId: string): Promise<Retirement401kGoal | undefined>;
  upsertRetirement401kGoal(goal: InsertRetirement401kGoal): Promise<Retirement401kGoal>;
  getRetirementPensions(userId: string): Promise<RetirementPension[]>;
  createRetirementPension(pension: InsertRetirementPension): Promise<RetirementPension>;
  updateRetirementPension(id: number, userId: string, data: Partial<InsertRetirementPension>): Promise<RetirementPension | undefined>;
  deleteRetirementPension(id: number, userId: string): Promise<void>;

  getInsurancePolicies(userId: string): Promise<InsurancePolicy[]>;
  getInsurancePolicy(id: number, userId: string): Promise<InsurancePolicy | undefined>;
  createInsurancePolicy(policy: InsertInsurancePolicy): Promise<InsurancePolicy>;
  updateInsurancePolicy(id: number, userId: string, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy | undefined>;
  deleteInsurancePolicy(id: number, userId: string): Promise<void>;

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
  updatePlaidAccount(id: number, data: Partial<PlaidAccount>): Promise<PlaidAccount | undefined>;
  deletePlaidAccountsByItem(plaidItemId: number): Promise<void>;
  updatePlaidItem(id: number, data: Partial<PlaidItem>): Promise<PlaidItem | undefined>;

  getEstateBeneficiaries(userId: string): Promise<EstateBeneficiaryWithEntries[]>;
  saveEstateBeneficiary(data: {
    userId: string;
    assetId: number;
    hasBeneficiary: boolean;
    beneficiaries: Array<{ name: string; percentage: number; notes: string | null }>;
  }): Promise<EstateBeneficiaryWithEntries>;

  getEstateDocuments(userId: string): Promise<EstateDocument[]>;
  upsertEstateDocument(data: InsertEstateDocument): Promise<EstateDocument>;

  getEstateContacts(userId: string): Promise<EstateContact[]>;
  createEstateContact(data: InsertEstateContact): Promise<EstateContact>;
  updateEstateContact(id: number, userId: string, data: Partial<InsertEstateContact>): Promise<EstateContact | undefined>;
  deleteEstateContact(id: number, userId: string): Promise<void>;

  getFeedback(): Promise<(Feedback & { email: string })[]>;
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  createContactSubmission(data: InsertContactus): Promise<Contactus>;
  getContactSubmissions(): Promise<Contactus[]>;

  getSocialSecuritySettings(userId: string): Promise<SocialSecuritySettings | undefined>;
  upsertSocialSecuritySettings(data: InsertSocialSecuritySettings): Promise<SocialSecuritySettings>;

  getUserGoals(userId: string): Promise<UserGoal[]>;
  createUserGoal(data: InsertUserGoal): Promise<UserGoal>;
  updateUserGoal(id: number, userId: string, data: Partial<InsertUserGoal>): Promise<UserGoal | undefined>;
  deleteUserGoal(id: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserBySupabaseId(supabaseId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.supabaseId, supabaseId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createUserFromSupabase(supabaseId: string, email: string, fullName?: string): Promise<User> {
    const [user] = await db.insert(users).values({
      supabaseId,
      email,
      fullName: fullName || null,
    }).returning();
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

  async getAssetCategories(): Promise<Array<{ parentCategory: string; category: string; description: string }>> {
    return db.select({
      parentCategory: assetTypeList.parentCategory,
      category: assetTypeList.subCategory,
      description: assetTypeList.description,
    }).from(assetTypeList).orderBy(asc(assetTypeList.parentCategory), asc(assetTypeList.subCategory));
  }

  async getLiabilityCategories(): Promise<Array<{ parentCategory: string; category: string; description: string }>> {
    return db.select({
      parentCategory: liabilitiesTypeList.parentCategory,
      category: liabilitiesTypeList.subCategory,
      description: liabilitiesTypeList.description,
    }).from(liabilitiesTypeList).orderBy(asc(liabilitiesTypeList.parentCategory), asc(liabilitiesTypeList.subCategory));
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

  async getRetirementPensions(userId: string): Promise<RetirementPension[]> {
    return db.select().from(retirementPensions).where(eq(retirementPensions.userId, userId)).orderBy(desc(retirementPensions.id));
  }

  async createRetirementPension(pension: InsertRetirementPension): Promise<RetirementPension> {
    const [created] = await db.insert(retirementPensions).values(pension).returning();
    return created;
  }

  async updateRetirementPension(id: number, userId: string, data: Partial<InsertRetirementPension>): Promise<RetirementPension | undefined> {
    const [updated] = await db
      .update(retirementPensions)
      .set(data)
      .where(and(eq(retirementPensions.id, id), eq(retirementPensions.userId, userId)))
      .returning();
    return updated;
  }

  async deleteRetirementPension(id: number, userId: string): Promise<void> {
    await db.delete(retirementPensions).where(and(eq(retirementPensions.id, id), eq(retirementPensions.userId, userId)));
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

  async updatePlaidAccount(id: number, data: Partial<PlaidAccount>): Promise<PlaidAccount | undefined> {
    const [updated] = await db.update(plaidAccounts).set(data).where(eq(plaidAccounts.id, id)).returning();
    return updated;
  }

  async deletePlaidAccountsByItem(plaidItemId: number): Promise<void> {
    await db.delete(plaidAccounts).where(eq(plaidAccounts.plaidItemId, plaidItemId));
  }

  async getEstateBeneficiaries(userId: string): Promise<EstateBeneficiaryWithEntries[]> {
    const res = await pool.query(
      `SELECT
         d.id,
         d.user_id AS "userId",
         d.asset_id AS "assetId",
         d.has_beneficiary AS "hasBeneficiary",
         d.beneficiary_name AS "beneficiaryName",
         d.notes,
         COALESCE(
           json_agg(
             json_build_object(
               'id', e.id,
               'designationId', e.designation_id,
               'userId', e.user_id,
               'assetId', e.asset_id,
               'beneficiaryName', e.beneficiary_name,
               'allocationPercentage', e.allocation_percentage,
               'notes', e.notes
             ) ORDER BY e.id
           ) FILTER (WHERE e.id IS NOT NULL),
           CASE
             WHEN NULLIF(BTRIM(d.beneficiary_name), '') IS NOT NULL THEN
               json_build_array(json_build_object(
                 'id', -d.id,
                 'designationId', d.id,
                 'userId', d.user_id,
                 'assetId', d.asset_id,
                 'beneficiaryName', d.beneficiary_name,
                 'allocationPercentage', '100.00',
                 'notes', d.notes
               ))
             ELSE '[]'::json
           END
         ) AS beneficiaries
       FROM estate_beneficiaries d
       LEFT JOIN estate_beneficiary_entries e ON e.designation_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.asset_id`,
      [userId]
    );
    return res.rows;
  }

  async saveEstateBeneficiary(data: {
    userId: string;
    assetId: number;
    hasBeneficiary: boolean;
    beneficiaries: Array<{ name: string; percentage: number; notes: string | null }>;
  }): Promise<EstateBeneficiaryWithEntries> {
    const client = await pool.connect();
    let committed = false;
    try {
      await client.query("BEGIN");

      const asset = await client.query(
        "SELECT id FROM assets WHERE id = $1 AND user_id = $2",
        [data.assetId, data.userId],
      );
      if (asset.rowCount === 0) {
        throw Object.assign(new Error("Asset not found"), { statusCode: 404 });
      }

      const designation = await client.query(
        `INSERT INTO estate_beneficiaries (user_id, asset_id, has_beneficiary, beneficiary_name, notes)
         VALUES ($1, $2, $3, NULL, NULL)
         ON CONFLICT (user_id, asset_id) DO UPDATE
           SET has_beneficiary = EXCLUDED.has_beneficiary
         RETURNING id, user_id AS "userId", asset_id AS "assetId",
           has_beneficiary AS "hasBeneficiary", beneficiary_name AS "beneficiaryName", notes`,
        [data.userId, data.assetId, data.hasBeneficiary],
      );
      const designationRecord = designation.rows[0];

      if (data.hasBeneficiary) {
        await client.query("DELETE FROM estate_beneficiary_entries WHERE designation_id = $1", [designationRecord.id]);
        for (const beneficiary of data.beneficiaries) {
          await client.query(
            `INSERT INTO estate_beneficiary_entries
              (designation_id, user_id, asset_id, beneficiary_name, allocation_percentage, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              designationRecord.id,
              data.userId,
              data.assetId,
              beneficiary.name,
              beneficiary.percentage.toFixed(2),
              beneficiary.notes,
            ],
          );
        }
        await client.query(
          "UPDATE estate_beneficiaries SET beneficiary_name = NULL, notes = NULL WHERE id = $1",
          [designationRecord.id],
        );
      }

      await client.query("COMMIT");
      committed = true;
      const result = await this.getEstateBeneficiaries(data.userId);
      const saved = result.find((record) => record.assetId === data.assetId);
      if (!saved) throw new Error("Saved beneficiary designation could not be loaded");
      return saved;
    } catch (error) {
      if (!committed) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getEstateDocuments(userId: string): Promise<EstateDocument[]> {
    const res = await pool.query(
      `SELECT id, user_id AS "userId", document_type AS "documentType", is_complete AS "isComplete", notes, updated_at AS "updatedAt"
       FROM estate_documents WHERE user_id = $1`,
      [userId]
    );
    return res.rows;
  }

  async upsertEstateDocument(data: InsertEstateDocument): Promise<EstateDocument> {
    const res = await pool.query(
      `INSERT INTO estate_documents (user_id, document_type, is_complete, notes, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, document_type) DO UPDATE
         SET is_complete = EXCLUDED.is_complete,
             notes = EXCLUDED.notes,
             updated_at = NOW()
       RETURNING id, user_id AS "userId", document_type AS "documentType", is_complete AS "isComplete", notes, updated_at AS "updatedAt"`,
      [data.userId, data.documentType, data.isComplete, data.notes ?? null]
    );
    return res.rows[0];
  }

  async getEstateContacts(userId: string): Promise<EstateContact[]> {
    const res = await pool.query(
      `SELECT id, user_id AS "userId", name, role, phone, email, firm, notes
       FROM estate_contacts WHERE user_id = $1 ORDER BY id`,
      [userId]
    );
    return res.rows;
  }

  async createEstateContact(data: InsertEstateContact): Promise<EstateContact> {
    const res = await pool.query(
      `INSERT INTO estate_contacts (user_id, name, role, phone, email, firm, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id AS "userId", name, role, phone, email, firm, notes`,
      [data.userId, data.name, data.role, data.phone ?? null, data.email ?? null, data.firm ?? null, data.notes ?? null]
    );
    return res.rows[0];
  }

  async updateEstateContact(id: number, userId: string, data: Partial<InsertEstateContact>): Promise<EstateContact | undefined> {
    const res = await pool.query(
      `UPDATE estate_contacts
       SET name = COALESCE($3, name), role = COALESCE($4, role), phone = $5, email = $6, firm = $7, notes = $8
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id AS "userId", name, role, phone, email, firm, notes`,
      [id, userId, data.name ?? null, data.role ?? null, data.phone ?? null, data.email ?? null, data.firm ?? null, data.notes ?? null]
    );
    return res.rows[0];
  }

  async deleteEstateContact(id: number, userId: string): Promise<void> {
    await pool.query(`DELETE FROM estate_contacts WHERE id = $1 AND user_id = $2`, [id, userId]);
  }

  async getFeedback(): Promise<(Feedback & { email: string })[]> {
    const res = await pool.query(
      `SELECT f.id, f.user_id AS "userId", f.message, f.created_at AS "createdAt", u.email
       FROM feedback f JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC`
    );
    return res.rows;
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [created] = await db.insert(feedback).values(data).returning();
    return created;
  }

  async createContactSubmission(data: InsertContactus): Promise<Contactus> {
    const [created] = await db.insert(contactus).values(data).returning();
    return created;
  }

  async getContactSubmissions(): Promise<Contactus[]> {
    return db.select().from(contactus).orderBy(contactus.createdAt);
  }

  async getSocialSecuritySettings(userId: string): Promise<SocialSecuritySettings | undefined> {
    const result = await pool.query(
      `SELECT * FROM social_security_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0] ? {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      fraMonthlyBenefit: result.rows[0].fra_monthly_benefit,
      expectedLifeAge: result.rows[0].expected_life_age,
      updatedAt: result.rows[0].updated_at,
    } as SocialSecuritySettings : undefined;
  }

  async upsertSocialSecuritySettings(data: InsertSocialSecuritySettings): Promise<SocialSecuritySettings> {
    const result = await pool.query(
      `INSERT INTO social_security_settings (user_id, fra_monthly_benefit, expected_life_age)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET fra_monthly_benefit = EXCLUDED.fra_monthly_benefit,
             expected_life_age   = EXCLUDED.expected_life_age,
             updated_at          = NOW()
       RETURNING *`,
      [data.userId, data.fraMonthlyBenefit ?? null, data.expectedLifeAge ?? null]
    );
    const r = result.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      fraMonthlyBenefit: r.fra_monthly_benefit,
      expectedLifeAge: r.expected_life_age,
      updatedAt: r.updated_at,
    } as SocialSecuritySettings;
  }

  // ── User Goals ──────────────────────────────────────────────────────────────

  async getUserGoals(userId: string): Promise<UserGoal[]> {
    const result = await pool.query(
      `SELECT * FROM user_goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, title: r.title, category: r.category,
      targetAmount: r.target_amount, currentAmount: r.current_amount,
      targetDate: r.target_date, notes: r.notes,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) as UserGoal[];
  }

  async createUserGoal(data: InsertUserGoal): Promise<UserGoal> {
    const result = await pool.query(
      `INSERT INTO user_goals (user_id, title, category, target_amount, current_amount, target_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.userId, data.title, data.category ?? 'custom',
       data.targetAmount, data.currentAmount ?? '0',
       data.targetDate ?? null, data.notes ?? null]
    );
    const r = result.rows[0];
    return {
      id: r.id, userId: r.user_id, title: r.title, category: r.category,
      targetAmount: r.target_amount, currentAmount: r.current_amount,
      targetDate: r.target_date, notes: r.notes,
      createdAt: r.created_at, updatedAt: r.updated_at,
    } as UserGoal;
  }

  async updateUserGoal(id: number, userId: string, data: Partial<InsertUserGoal>): Promise<UserGoal | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.title !== undefined)         { fields.push(`title = $${idx++}`);          values.push(data.title); }
    if (data.category !== undefined)      { fields.push(`category = $${idx++}`);       values.push(data.category); }
    if (data.targetAmount !== undefined)  { fields.push(`target_amount = $${idx++}`);  values.push(data.targetAmount); }
    if (data.currentAmount !== undefined) { fields.push(`current_amount = $${idx++}`); values.push(data.currentAmount); }
    if (data.targetDate !== undefined)    { fields.push(`target_date = $${idx++}`);    values.push(data.targetDate ?? null); }
    if (data.notes !== undefined)         { fields.push(`notes = $${idx++}`);          values.push(data.notes ?? null); }
    if (fields.length === 0) return undefined;
    fields.push(`updated_at = NOW()`);
    values.push(id, userId);
    const result = await pool.query(
      `UPDATE user_goals SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++} RETURNING *`,
      values
    );
    if (!result.rows[0]) return undefined;
    const r = result.rows[0];
    return {
      id: r.id, userId: r.user_id, title: r.title, category: r.category,
      targetAmount: r.target_amount, currentAmount: r.current_amount,
      targetDate: r.target_date, notes: r.notes,
      createdAt: r.created_at, updatedAt: r.updated_at,
    } as UserGoal;
  }

  async deleteUserGoal(id: number, userId: string): Promise<void> {
    await pool.query(`DELETE FROM user_goals WHERE id = $1 AND user_id = $2`, [id, userId]);
  }
}

export const storage = new DatabaseStorage();
