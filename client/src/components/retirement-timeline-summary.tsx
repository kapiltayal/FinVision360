import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { type RetirementPlannerSettings } from "@shared/schema";

type RetirementTimelineSummaryProps = {
  settings?: RetirementPlannerSettings;
};

export function RetirementTimelineSummary({ settings }: RetirementTimelineSummaryProps) {
  return (
    <Card className="border-violet-500/20 bg-violet-500/5">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Retirement Timeline</p>
          <p className="mt-1 text-xs text-muted-foreground">
            These shared planning ages are set in Retirement Planner.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Retirement Age</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="text-retirement-timeline-age">
              {settings?.retirementAge ?? 65}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Life Expectancy</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="text-retirement-timeline-life-expectancy">
              {settings?.lifeExpectancy ?? 85}
            </p>
          </div>
          <Link href="/retirement" className="text-sm font-medium text-primary underline underline-offset-2">
            Update
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}