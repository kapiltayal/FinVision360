import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIO_SECTIONS, splitScenarioResponse } from "./advisor-response";

test("splits the four response sections and retains introductory text", () => {
  const sections = splitScenarioResponse(
    "Overview\n## Key observations\nObservation\n## Recommendations\nAction\n## Projected Impact\nOutcome\n## Risks\nCaution",
  );
  assert.deepEqual(SCENARIO_SECTIONS.map(section => section.label), [
    "Key observations", "Recommendations", "Projected Impact", "Risks",
  ]);
  assert.deepEqual(sections, {
    observations: "Overview\nObservation",
    recommendations: "Action",
    impact: "Outcome",
    risks: "Caution",
  });
});

test("recognizes case, heading levels, bold titles, and trailing colons", () => {
  const sections = splitScenarioResponse("### **KEY OBSERVATIONS:**\nFact\n# Recommendations:\nAction\n#### Projected Impact\nImpact\n## RISKS ##\nRisk");
  assert.equal(sections.observations, "Fact");
  assert.equal(sections.recommendations, "Action");
  assert.equal(sections.impact, "Impact");
  assert.equal(sections.risks, "Risk");
});

test("retains unstructured answers, unknown headings, and partial streaming text", () => {
  for (const content of ["Plain answer", "## Key observ", "## constructor\nContent", "## Unrecognized\nContent"]) {
    const sections = splitScenarioResponse(content);
    assert.equal(sections.observations, content);
    assert.equal(sections.recommendations, "");
    assert.equal(sections.impact, "");
    assert.equal(sections.risks, "");
  }
  const partial = splitScenarioResponse("## Key observations\nFact\n## Recom");
  assert.equal(partial.observations, "Fact\n## Recom");
  const completed = splitScenarioResponse("## Key observations\nFact\n## Recommendations\nAction");
  assert.equal(completed.observations, "Fact");
  assert.equal(completed.recommendations, "Action");
});

test("keeps nested headings and repeated section content", () => {
  const sections = splitScenarioResponse("## Recommendations\nFirst\n### Next steps\nSecond\n## Recommendations\nThird");
  assert.equal(sections.recommendations, "First\n### Next steps\nSecond\nThird");
});

test("does not interpret headings inside fenced content as sections", () => {
  const sections = splitScenarioResponse("## Key observations\n```text\n## Risks\nExample\n```\n## Recommendations\nAction");
  assert.equal(sections.observations, "```text\n## Risks\nExample\n```");
  assert.equal(sections.risks, "");
  assert.equal(sections.recommendations, "Action");
});