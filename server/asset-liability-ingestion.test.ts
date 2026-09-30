import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import {
  deterministicClassify,
  hasPreviewableStructure,
  hasRecognizableStructure,
  isEmptySample,
  parseUpload,
  previewClassifiedRows,
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
  assert.equal(hasPreviewableStructure(rows), false);
});

test("preview keeps partial rows, in order, so users can fill missing fields", () => {
  const rows = parseUpload(upload("partial.csv", Buffer.from("Name,Value\nSavings,\n,1200\n")));
  assert.ok(rows);
  assert.equal(hasPreviewableStructure(rows), true);
  assert.equal(hasRecognizableStructure("asset", rows), true);
  const preview = previewClassifiedRows(rows, categories);
  assert.equal(preview.length, 2);
  assert.equal(preview[0].name, "Savings");
  assert.equal(preview[0].value, "");
  assert.equal(preview[0].interestRate, "");
  assert.equal(preview[0].institution, "");
  assert.equal(preview[1].name, "");
  assert.equal(preview[1].value, "1200");
});

test("name-only file is previewable even without a balance column", () => {
  const rows = parseUpload(upload("names.csv", Buffer.from("Name,Institution\nSavings,Example Bank\n")));
  assert.ok(rows);
  assert.equal(hasPreviewableStructure(rows), true);
  assert.equal(hasRecognizableStructure("asset", rows), false);
  const preview = previewClassifiedRows(rows, categories);
  assert.equal(preview[0].value, "");
  assert.equal(preview[0].institution, "Example Bank");
});

test("preview suggestions use source row indices and preserve explicit categories", () => {
  const choices = [
    { parentCategory: "Debt", category: "Auto Loans", description: "Vehicle debt" },
    { parentCategory: "Debt", category: "Credit Cards", description: "Card debt" },
  ];
  const rows = [
    { name: "Loan", balance: "500", category: "Auto Loans", minimumPayment: "40" },
    { name: "Card", balance: "100", interestRate: "5.5%" },
  ];
  const preview = previewClassifiedRows(rows, choices, [
    { sourceIndex: 0, category: "Credit Cards" },
    { sourceIndex: 1, category: "Credit Cards" },
  ]);
  assert.equal(preview[0].category, "Auto Loans");
  assert.equal(preview[0].minimumPayment, "40");
  assert.equal(preview[1].category, "Credit Cards");
  assert.equal(preview[1].interestRate, "5.5");
});

test("conflicting value and balance columns keep their distinct source amounts", () => {
  const preview = previewClassifiedRows([
    { name: "Loan", value: "200", balance: "1000", category: "From old spreadsheet" },
  ], categories, [{ sourceIndex: 0, category: "Other" }]);
  assert.equal(preview[0].value, "200");
  assert.equal(preview[0].balance, "1000");
  assert.equal(preview[0].sourceCategory, "From old spreadsheet");
  assert.equal(preview[0].category, "Other");
});

test("blank lines do not reject a file; completely blank records can be excluded in preview", () => {
  const rows = parseUpload(upload("blank.csv", Buffer.from("Name,Value\n\n,\nSavings,100\n")));
  assert.ok(rows);
  assert.equal(rows.length, 2);
  const nonblank = rows.filter((row) => !isEmptySample([row]));
  assert.equal(nonblank.length, 1);
  assert.equal(previewClassifiedRows(nonblank, categories)[0].name, "Savings");
  const textRows = parseUpload(upload("accounts.txt", Buffer.from("Savings balance $100\n\nHome value $200\n")));
  assert.equal(textRows?.length, 2);
});

test("unreadable Excel content fails parsing", () => {
  assert.equal(parseUpload(upload("accounts.xlsx", Buffer.from("not an Excel file"))), null);
});