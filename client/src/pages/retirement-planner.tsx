import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Info, Landmark } from "lucide-react";
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

  const clampAge = (value: string): string => {
    if (currentAge === null || currentAge >= MAX_AGE) return "";
    const parsedAge = Number(value);
    if (!Number.isFinite(parsedAge)) return getDefaultRetirementAge(currentAge);
    return String(Math.min(MAX_AGE, Math.max(currentAge + 1, Math.trunc(parsedAge))));
  };

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
        <CardHeader className="border-b bg-violet-500/5 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
              <CalendarDays className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base">Retirement Timeline</CardTitle>
              <CardDescription className="mt-1">
                Set the ages used to build your retirement projection.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {currentAge === null ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Add your date of birth to calculate your current age.</p>
                <p className="text-muted-foreground">
                  Your current age is read from your profile and cannot be entered manually.
                </p>
                <Link href="/settings" className="inline-block font-medium text-primary hover:underline">
                  Open Account Settings
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="retirement-current-age">Current Age</Label>
                  <Input
                    id="retirement-current-age"
                    type="number"
                    value={currentAge}
                    readOnly
                    aria-describedby="retirement-current-age-help"
                    className="bg-muted/50 font-semibold"
                    data-testid="input-retirement-current-age"
                  />
                  <p id="retirement-current-age-help" className="text-xs text-muted-foreground">
                    Calculated from your date of birth.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retirement-age">Retirement Age</Label>
                  <Input
                    id="retirement-age"
                    type="number"
                    min={currentAge + 1}
                    max={MAX_AGE}
                    step="1"
                    value={retirementAge}
                    onChange={(event) => setRetirementAge(event.target.value)}
                    onBlur={() => setRetirementAge(clampAge(retirementAge))}
                    aria-describedby="retirement-age-help"
                    data-testid="input-retirement-age"
                  />
                  <p id="retirement-age-help" className="text-xs text-muted-foreground">
                    Choose an age from {currentAge + 1} to {MAX_AGE}.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="life-expectancy">Life Expectancy</Label>
                  <Input
                    id="life-expectancy"
                    type="number"
                    min={currentAge + 1}
                    max={MAX_AGE}
                    step="1"
                    value={lifeExpectancy}
                    onChange={(event) => setLifeExpectancy(event.target.value)}
                    onBlur={() => {
                      const parsedAge = Number(lifeExpectancy);
                      if (!Number.isFinite(parsedAge)) {
                        setLifeExpectancy(getDefaultLifeExpectancy(currentAge));
                      } else {
                        setLifeExpectancy(
                          String(Math.min(MAX_AGE, Math.max(currentAge + 1, Math.trunc(parsedAge)))),
                        );
                      }
                    }}
                    aria-describedby="life-expectancy-help"
                    data-testid="input-life-expectancy"
                  />
                  <p id="life-expectancy-help" className="text-xs text-muted-foreground">
                    Choose an age from {currentAge + 1} to {MAX_AGE}.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Current age is calculated from your profile. Retirement age and life expectancy must be
                  greater than your current age and cannot exceed {MAX_AGE}.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
