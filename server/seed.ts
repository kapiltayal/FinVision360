import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  const existing = await storage.getUserByUsername("demo");
  if (existing) return;

  const hashedPassword = await hashPassword("demo123");
  const user = await storage.createUser({
    username: "demo",
    password: hashedPassword,
    fullName: "Alex Morgan",
    email: "alex@example.com",
  });

  await Promise.all([
    storage.createAsset({ userId: user.id, name: "Chase Checking", category: "bank_account", value: "12500", interestRate: "0.01", institution: "Chase Bank", notes: "Primary checking account" }),
    storage.createAsset({ userId: user.id, name: "Ally Savings", category: "savings_account", value: "35000", interestRate: "4.25", institution: "Ally Bank", notes: "Emergency fund" }),
    storage.createAsset({ userId: user.id, name: "Vanguard 401k", category: "retirement_fund", value: "145000", interestRate: "8.5", institution: "Vanguard", notes: "Employer match 4%" }),
    storage.createAsset({ userId: user.id, name: "Fidelity Brokerage", category: "investment", value: "67800", interestRate: "10.2", institution: "Fidelity", notes: "Index fund portfolio" }),
    storage.createAsset({ userId: user.id, name: "Primary Residence", category: "property", value: "425000", interestRate: "5", institution: null, notes: "3BR townhouse" }),
    storage.createAsset({ userId: user.id, name: "Cash Reserves", category: "cash", value: "5000", interestRate: "0", institution: null, notes: "At home" }),
    storage.createAsset({ userId: user.id, name: "Roth IRA", category: "retirement_fund", value: "42000", interestRate: "9", institution: "Charles Schwab", notes: "Growth stocks" }),
  ]);

  await Promise.all([
    storage.createLiability({ userId: user.id, name: "Home Mortgage", category: "mortgage", balance: "310000", interestRate: "6.5", minimumPayment: "2100", institution: "Wells Fargo", notes: "30-year fixed" }),
    storage.createLiability({ userId: user.id, name: "Chase Sapphire", category: "credit_card", balance: "4200", interestRate: "21.99", minimumPayment: "120", institution: "Chase", notes: "Travel rewards card" }),
    storage.createLiability({ userId: user.id, name: "Student Loan", category: "student_loan", balance: "28500", interestRate: "5.5", minimumPayment: "350", institution: "Navient", notes: "Federal loans" }),
    storage.createLiability({ userId: user.id, name: "Auto Loan", category: "auto_loan", balance: "18900", interestRate: "4.9", minimumPayment: "420", institution: "Capital One", notes: "2023 Honda Accord" }),
    storage.createLiability({ userId: user.id, name: "Amex Gold", category: "credit_card", balance: "1800", interestRate: "24.99", minimumPayment: "50", institution: "American Express", notes: "Dining rewards" }),
  ]);

  await storage.upsertRetirementGoal({
    userId: user.id,
    currentAge: 32,
    retirementAge: 62,
    monthlyContribution: "1200",
    expectedReturn: "7.5",
    inflationRate: "3",
    currentSavings: "187000",
    targetAmount: "2000000",
  });

  console.log("Seed data created: demo/demo123");
}
