import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import {
  deterministicClassify,
  hasRecognizableStructure,
  isEmptySample,
  parseUpload,
} from "./asset-liability-ingestion";

function upload(name: string, buffer: Buffer) {
  return { originalname: name, buffer } as Express.Multer.File;
}

function spreadsheet(bookType: "xlsx" | "xls", rows: string[][]): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Accounts");
  return XLSX.write(workbook, { type: "buffer", bookType });
}

const categories = [{ parentCategory: "Other", category: "Other", description: "Miscellaneous" }];

const formats = [
  ["csv", Buffer.from("Value,Account Name\n2500,Savings\n")],
  ["tsv", Buffer.from("Balance\tDescription\n2500\tSavings\n")],
  ["txt", Buffer.from("Savings account balance $2,500\n")],
  ["xls", spreadsheet("xls", [["Balance", "Name"], ["2500", "Savings"]])],
  ["xlsx", spreadsheet("xlsx", [["Current Value", "Account Name"], ["2500", "Savings"]])],
] as const;

for (const [extension, buffer] of formats) {
  test(`${extension.toUpperCase()} file yields a recognizable asset and liability entry`, () => {
    const rows = parseUpload(upload(`accounts.${extension}`, buffer));
    assert.ok(rows && !isEmptySample(rows));
    assert.equal(hasRecognizableStructure("asset", rows), true);
    assert.equal(hasRecognizableStructure("liability", rows), true);
    const entries = deterministicClassify(rows, categories);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].category, "Other");
    assert.equal(entries[0].value, "2500");
    assert.match(String(entries[0].name), /Savings/i);
  });
}

test("readable bank product rates are not treated as asset or liability balances", () => {
  const buffer = spreadsheet("xlsx", [
    ["Bank", "Type", "Product", "Rate"],
    ["Example Bank", "CD", "1 year", "3.90%"],
  ]);
  const rows = parseUpload(upload("rates.xlsx", buffer));
  assert.ok(rows && !isEmptySample(rows));
  assert.equal(hasRecognizableStructure("asset", rows), false);
  assert.equal(hasRecognizableStructure("liability", rows), false);
});

test("unreadable Excel content fails parsing", () => {
  assert.equal(parseUpload(upload("accounts.xlsx", Buffer.from("not an Excel file"))), null);
});