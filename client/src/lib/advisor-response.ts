export const SCENARIO_SECTIONS = [
  { value: "observations", label: "Key observations" },
  { value: "recommendations", label: "Recommendations" },
  { value: "impact", label: "Projected Impact" },
  { value: "risks", label: "Risks" },
] as const;

export type ScenarioSection = (typeof SCENARIO_SECTIONS)[number]["value"];

export function splitScenarioResponse(content: string): Record<ScenarioSection, string> {
  const sections: Record<ScenarioSection, string[]> = {
    observations: [],
    recommendations: [],
    impact: [],
    risks: [],
  };
  const sectionByHeading = new Map<string, ScenarioSection>([
    ["key observations", "observations"],
    ["recommendations", "recommendations"],
    ["projected impact", "impact"],
    ["risks", "risks"],
  ]);
  let currentSection: ScenarioSection = "observations";
  let fence: { marker: string; length: number } | null = null;

  for (const line of content.split("\n")) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) {
        fence = { marker, length: fenceMatch[1].length };
      } else if (marker === fence.marker && fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) {
        fence = null;
      }
      sections[currentSection].push(line);
      continue;
    }

    const heading = !fence ? line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) : null;
    const normalizedHeading = heading?.[1]
      .replace(/\*\*/g, "")
      .trim()
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
    const nextSection = normalizedHeading ? sectionByHeading.get(normalizedHeading) : undefined;

    if (nextSection) {
      currentSection = nextSection;
    } else {
      sections[currentSection].push(line);
    }
  }

  return {
    observations: sections.observations.join("\n"),
    recommendations: sections.recommendations.join("\n"),
    impact: sections.impact.join("\n"),
    risks: sections.risks.join("\n"),
  };
}