import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CalendarDays, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const MAX_AGE = 125;

function getCurrentAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const hadBirthday =
    today.getUTCMonth() > dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());

  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function isValidAge(value: string, currentAge: number): boolean {
  const age = Number(value);
  return Number.isInteger(age) && age > currentAge && age <= MAX_AGE;
}

function getDefaultRetirementAge(currentAge: number): string {
  return String(Math.min(MAX_AGE, Math.max(currentAge + 1, 65)));
}

function getDefaultLifeExpectancy(currentAge: number): string {
  return String(Math.min(MAX_AGE, Math.max(currentAge + 1, 85)));
}

export default function RetirementPlannerPage() {
  const { user } = useAuth();
  const currentAge = getCurrentAge((user as any)?.dateOfBirth);
  const [retirementAge, setRetirementAge] = useState("");
  const [lifeExpectancy, setLifeExpectancy] = useState("");

  useEffect(() => {
    if (currentAge === null) {
      setRetirementAge("");
      setLifeExpectancy("");
      return;
    }

    setRetirementAge((value) =>
      isValidAge(value, currentAge) ? value : getDefaultRetirementAge(currentAge),
    );
    setLifeExpectancy((value) =>
      isValidAge(value, currentAge) ? value : getDefaultLifeExpectancy(currentAge),
    );
  }, [currentAge]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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

      <Card className="overflow-hidden border-violet-500/20 shadow-sm">
        <CardHeader className="border-b bg-violet-500/5 px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
              <CalendarDays className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base">Retirement Timeline</CardTitle>
              <CardDescription className="mt-0.5 text-xs">Set the ages used for your retirement projection.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {currentAge === null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Add your date of birth to calculate your current age.</span>
              <Link href="/settings" className="shrink-0 font-medium text-primary hover:underline">
                Update profile
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-3">
                <div className="flex min-h-5 items-center gap-2">
                  <Label>Current Age</Label>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold leading-none" data-testid="text-retirement-current-age">
                    {currentAge}
                  </p>
                  <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
                    Update
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <Label htmlFor="retirement-age">Retirement Age</Label>
                  <span className="text-lg font-semibold tabular-nums">{retirementAge}</span>
                </div>
                <Slider
                  id="retirement-age"
                  min={currentAge + 1}
                  max={MAX_AGE}
                  step={1}
                  value={[Number(retirementAge) || currentAge + 1]}
                  onValueChange={([value]) => setRetirementAge(String(value))}
                  aria-label="Retirement Age"
                  data-testid="slider-retirement-age"
                />
                <p className="text-xs text-muted-foreground">{currentAge + 1}–{MAX_AGE}</p>
              </div>

              <div className="space-y-3">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <Label htmlFor="life-expectancy">Life Expectancy</Label>
                  <span className="text-lg font-semibold tabular-nums">{lifeExpectancy}</span>
                </div>
                <Slider
                  id="life-expectancy"
                  min={currentAge + 1}
                  max={MAX_AGE}
                  step={1}
                  value={[Number(lifeExpectancy) || currentAge + 1]}
                  onValueChange={([value]) => setLifeExpectancy(String(value))}
                  aria-label="Life Expectancy"
                  data-testid="slider-life-expectancy"
                />
                <p className="text-xs text-muted-foreground">{currentAge + 1}–{MAX_AGE}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
