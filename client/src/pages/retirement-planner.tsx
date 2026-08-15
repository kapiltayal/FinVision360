import { Landmark } from "lucide-react";

export default function RetirementPlannerPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="page-header-gradient">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-violet-500/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Retirement Planner</h1>
            <p className="text-muted-foreground">Project your savings, wealth and income. Plan your path to financial freedom</p>
          </div>
        </div>
      </div>
    </div>
  );
}
