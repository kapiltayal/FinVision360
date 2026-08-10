import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth, useChangePassword } from "@/hooks/use-auth";
import {
  User, Lock, Save, PiggyBank, CreditCard, Shield,
  KeyRound, BadgeCheck, SlidersHorizontal, Clock,
} from "lucide-react";

function DollarInput({
  id,
  label,
  value,
  onChange,
  placeholder = "e.g. 5000",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
        <Input
          id={id}
          type="number"
          min="0"
          step="1"
          className="pl-7"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

type RecommendationFields = {
  checkingThreshold: string;
  savingsThreshold: string;
  cdsThreshold: string;
  studentLoanThreshold: string;
  creditCardThreshold: string;
  autoLoanThreshold: string;
  personalLoanThreshold: string;
  mortgageThreshold: string;
  autoInsuranceThreshold: string;
  homeInsuranceThreshold: string;
  lifeInsuranceThreshold: string;
  otherInsuranceThreshold: string;
};

const DEFAULT_REC: RecommendationFields = {
  checkingThreshold: "200",
  savingsThreshold: "200",
  cdsThreshold: "200",
  studentLoanThreshold: "200",
  creditCardThreshold: "200",
  autoLoanThreshold: "200",
  personalLoanThreshold: "200",
  mortgageThreshold: "200",
  autoInsuranceThreshold: "100",
  homeInsuranceThreshold: "100",
  lifeInsuranceThreshold: "100",
  otherInsuranceThreshold: "100",
};

function numericToStr(v: string | null | undefined, fallback = ""): string {
  return v != null && v !== "" ? String(v) : fallback;
}

function getInitials(name: string | undefined | null, email: string | undefined | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email || "U").slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState({ fullName: "" });
  useEffect(() => {
    if (user) setProfile({ fullName: user.fullName || "" });
  }, [user]);

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const { formattedDate, markUpdated } = useLastUpdated("settings");

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/auth/user", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      markUpdated();
      toast({ title: "Profile updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const changePasswordMutation = useChangePassword();

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profile);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ newPassword: passwords.newPassword }, {
      onSuccess: () => {
        markUpdated();
        toast({ title: "Password changed" });
        setPasswords({ newPassword: "", confirmPassword: "" });
      },
      onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    });
  };

  const [rec, setRec] = useState<RecommendationFields>(DEFAULT_REC);

  const { data: recData } = useQuery({
    queryKey: ["/api/recommendation-settings"],
    queryFn: () => apiRequest("GET", "/api/recommendation-settings").then((r) => r.json()),
  });

  useEffect(() => {
    if (recData) {
      setRec({
        checkingThreshold: numericToStr(recData.checkingThreshold, DEFAULT_REC.checkingThreshold),
        savingsThreshold: numericToStr(recData.savingsThreshold, DEFAULT_REC.savingsThreshold),
        cdsThreshold: numericToStr(recData.cdsThreshold, DEFAULT_REC.cdsThreshold),
        studentLoanThreshold: numericToStr(recData.studentLoanThreshold, DEFAULT_REC.studentLoanThreshold),
        creditCardThreshold: numericToStr(recData.creditCardThreshold, DEFAULT_REC.creditCardThreshold),
        autoLoanThreshold: numericToStr(recData.autoLoanThreshold, DEFAULT_REC.autoLoanThreshold),
        personalLoanThreshold: numericToStr(recData.personalLoanThreshold, DEFAULT_REC.personalLoanThreshold),
        mortgageThreshold: numericToStr(recData.mortgageThreshold, DEFAULT_REC.mortgageThreshold),
        autoInsuranceThreshold: numericToStr(recData.autoInsuranceThreshold, DEFAULT_REC.autoInsuranceThreshold),
        homeInsuranceThreshold: numericToStr(recData.homeInsuranceThreshold, DEFAULT_REC.homeInsuranceThreshold),
        lifeInsuranceThreshold: numericToStr(recData.lifeInsuranceThreshold, DEFAULT_REC.lifeInsuranceThreshold),
        otherInsuranceThreshold: numericToStr(recData.otherInsuranceThreshold, DEFAULT_REC.otherInsuranceThreshold),
      });
    }
  }, [recData]);

  const saveRecMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/recommendation-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendation-settings"] });
      markUpdated();
      toast({ title: "Recommendation settings saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const handleRecSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(rec)) {
      payload[k] = v === "" ? null : v;
    }
    saveRecMutation.mutate(payload);
  };

  const setRecField = (field: keyof RecommendationFields) => (v: string) =>
    setRec((prev) => ({ ...prev, [field]: v }));

  const initials = getInitials(user?.fullName, user?.username);

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">Manage your account and recommendation preferences</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1" data-testid="text-settings-last-updated">
          <Clock className="h-3 w-3" /> Last updated: {formattedDate}
        </p>
      </div>

      {/* User Identity Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground font-bold text-lg shadow-md">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{user?.fullName || user?.username}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email || "No email set"}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  {(user as any)?.isAdmin ? "Admin" : "Member"}
                </Badge>
                <span className="text-xs text-muted-foreground">@{user?.username}</span>
              </div>
              {user?.createdAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Member since{" "}
                  {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="profile" className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            Profile & Security
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings Tab */}
        <TabsContent value="profile" className="space-y-5">

          {/* Profile Information */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-[#1C91D4]/10">
                  <User className="h-4 w-4 text-[#1475A8] dark:text-[#49AEE3]" />
                </div>
                <div>
                  <CardTitle className="text-base">Profile Information</CardTitle>
                  <CardDescription>Update your display name</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-5">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</Label>
                  <Input
                    id="fullName"
                    data-testid="input-settings-fullname"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</Label>
                  <Input
                    data-testid="input-settings-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Email is your login ID and cannot be changed here</p>
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-amber-500/10">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Change Password</CardTitle>
                  <CardDescription>Update your account password to keep it secure</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-5">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="newPwd" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</Label>
                    <Input
                      id="newPwd"
                      data-testid="input-new-password"
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                      placeholder="Min. 6 characters"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPwd" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm Password</Label>
                    <Input
                      id="confirmPwd"
                      data-testid="input-confirm-password"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-change-password">
                    <Lock className="h-4 w-4 mr-2" />
                    {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendation Settings Tab */}
        <TabsContent value="recommendations">
          <form onSubmit={handleRecSubmit} className="space-y-5">
            <Card className="border-[#1C91D4]/30 dark:border-[#1C91D4]/30 bg-[#1C91D4]/5 dark:bg-[#1C91D4]/5">
              <CardContent className="p-4 flex items-start gap-3">
                <SlidersHorizontal className="h-4 w-4 text-[#1475A8] dark:text-[#49AEE3] mt-0.5 shrink-0" />
                <p className="text-sm text-[#1475A8] dark:text-[#7EC8ED]">
                  Set dollar thresholds for each category. When <strong>FinVision360</strong> finds potential savings above your threshold, it will surface a personalized recommendation.
                </p>
              </CardContent>
            </Card>

            {/* Savings */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-emerald-500/10">
                    <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Savings Accounts</CardTitle>
                    <CardDescription>Trigger thresholds for savings-related accounts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5 grid gap-4 sm:grid-cols-3">
                <DollarInput id="checkingThreshold" label="Checking" value={rec.checkingThreshold} onChange={setRecField("checkingThreshold")} />
                <DollarInput id="savingsThreshold" label="Savings" value={rec.savingsThreshold} onChange={setRecField("savingsThreshold")} />
                <DollarInput id="cdsThreshold" label="CDs" value={rec.cdsThreshold} onChange={setRecField("cdsThreshold")} />
              </CardContent>
            </Card>

            {/* Borrowing */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-red-500/10">
                    <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Borrowing & Debt</CardTitle>
                    <CardDescription>Trigger thresholds for debt and loan balances</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5 grid gap-4 sm:grid-cols-2">
                <DollarInput id="studentLoanThreshold" label="Student Loan" value={rec.studentLoanThreshold} onChange={setRecField("studentLoanThreshold")} />
                <DollarInput id="creditCardThreshold" label="Credit Card" value={rec.creditCardThreshold} onChange={setRecField("creditCardThreshold")} />
                <DollarInput id="autoLoanThreshold" label="Auto Loan" value={rec.autoLoanThreshold} onChange={setRecField("autoLoanThreshold")} />
                <DollarInput id="personalLoanThreshold" label="Personal Loan" value={rec.personalLoanThreshold} onChange={setRecField("personalLoanThreshold")} />
                <DollarInput id="mortgageThreshold" label="Mortgage" value={rec.mortgageThreshold} onChange={setRecField("mortgageThreshold")} />
              </CardContent>
            </Card>

            {/* Insurance */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-500/10">
                    <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Insurance Coverage</CardTitle>
                    <CardDescription>Trigger thresholds for insurance coverage amounts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5 grid gap-4 sm:grid-cols-2">
                <DollarInput id="autoInsuranceThreshold" label="Auto Insurance" value={rec.autoInsuranceThreshold} onChange={setRecField("autoInsuranceThreshold")} />
                <DollarInput id="homeInsuranceThreshold" label="Home Insurance" value={rec.homeInsuranceThreshold} onChange={setRecField("homeInsuranceThreshold")} />
                <DollarInput id="lifeInsuranceThreshold" label="Life Insurance" value={rec.lifeInsuranceThreshold} onChange={setRecField("lifeInsuranceThreshold")} />
                <DollarInput id="otherInsuranceThreshold" label="Other Insurance" value={rec.otherInsuranceThreshold} onChange={setRecField("otherInsuranceThreshold")} />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveRecMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {saveRecMutation.isPending ? "Saving..." : "Save Recommendation Settings"}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
