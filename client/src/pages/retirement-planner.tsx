import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CalendarDays, Landmark } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type RetirementPlannerSettings } from "@shared/schema";

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
  const { data: savedSettings } = useQuery<RetirementPlannerSettings>({
    queryKey: ["/api/retirement/planner-settings"],
  });
  const saveMutation = useMutation({
    mutationFn: (settings: { retirementAge: number; lifeExpectancy: number }) =>
      apiRequest("PUT", "/api/retirement/planner-settings", settings).then((response) => response.json()),
    onSuccess: (settings: RetirementPlannerSettings) => {
      queryClient.setQueryData(["/api/retirement/planner-settings"], settings);
    },
  });

  useEffect(() => {
    if (currentAge === null) {
      setRetirementAge("");
      setLifeExpectancy("");
      return;
    }

    const savedRetirementAge = Number(savedSettings?.retirementAge);
    const savedLifeExpectancy = Number(savedSettings?.lifeExpectancy);
    const nextLifeExpectancy = isValidAge(String(savedLifeExpectancy), currentAge)
      ? savedLifeExpectancy
      : Number(getDefaultLifeExpectancy(currentAge));
    const nextRetirementAge = Math.min(
      isValidAge(String(savedRetirementAge), currentAge)
        ? savedRetirementAge
        : Number(getDefaultRetirementAge(currentAge)),
      nextLifeExpectancy,
    );
    setRetirementAge(String(nextRetirementAge));
    setLifeExpectancy(String(nextLifeExpectancy));
  }, [currentAge, savedSettings?.retirementAge, savedSettings?.lifeExpectancy]);

  const saveTimeline = (nextRetirementAge: number, nextLifeExpectancy: number) => {
    saveMutation.mutate({
      retirementAge: Math.min(nextRetirementAge, nextLifeExpectancy),
      lifeExpectancy: Math.max(nextLifeExpectancy, nextRetirementAge),
    });
  };

  const currentAgeFloor = currentAge === null ? 1 : currentAge + 1;
  const retirementAgeValue = Number(retirementAge) || currentAgeFloor;
  const lifeExpectancyValue = Number(lifeExpectancy) || currentAgeFloor;
  const timelineValues = [
    Math.min(retirementAgeValue, lifeExpectancyValue),
    Math.max(retirementAgeValue, lifeExpectancyValue),
  ];

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

              <div className="space-y-4 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="retirement-timeline">Retirement Age</Label>
                    <span className="text-lg font-semibold tabular-nums">{retirementAge}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="retirement-timeline">Life Expectancy</Label>
                    <span className="text-lg font-semibold tabular-nums">{lifeExpectancy}</span>
                  </div>
                </div>
                <Slider
                  id="retirement-timeline"
                  min={currentAge + 1}
                  max={MAX_AGE}
                  step={1}
                  minStepsBetweenThumbs={0}
                  value={timelineValues}
                  onValueChange={([nextRetirementAge, nextLifeExpectancy]) => {
                    setRetirementAge(String(nextRetirementAge));
                    setLifeExpectancy(String(nextLifeExpectancy));
                  }}
                  onValueCommit={([nextRetirementAge, nextLifeExpectancy]) =>
                    saveTimeline(Number(nextRetirementAge), Number(nextLifeExpectancy))
                  }
                  thumbLabels={["Retirement Age", "Life Expectancy"]}
                  aria-label="Retirement timeline"
                  data-testid="slider-retirement-timeline"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{currentAge + 1}</span>
                  <span>Left handle: Retirement Age · Right handle: Life Expectancy</span>
                  <span>{MAX_AGE}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
