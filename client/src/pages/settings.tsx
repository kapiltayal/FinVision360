import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLastUpdated } from "@/hooks/use-last-updated";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth, useChangePassword } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_OPTIONS, US_STATE_OPTIONS } from "@shared/profile-options";
import {
  User, Lock, Save, PiggyBank, CreditCard, Shield,
  KeyRound, BadgeCheck, SlidersHorizontal, Clock, Camera, Upload, X,
} from "lucide-react";

// All preset avatars served from /public/Images/Avatars/
const AVATAR_PRESETS = [
  "avatar-default",
  ...Array.from({ length: 50 }, (_, i) => `avatar-${String(i + 1).padStart(2, "0")}`),
];

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

  // ── Avatar state ────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted avatar from localStorage on mount / user change
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`avatar-${user.id}`);
      setAvatarUrl(saved || null);
    }
  }, [user?.id]);

  const saveAvatar = (url: string) => {
    if (user?.id) localStorage.setItem(`avatar-${user.id}`, url);
    setAvatarUrl(url);
    window.dispatchEvent(new Event("avatar-updated"));
    setPickerOpen(false);
    toast({ title: "Avatar updated" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => saveAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    if (user?.id) localStorage.removeItem(`avatar-${user.id}`);
    setAvatarUrl(null);
    window.dispatchEvent(new Event("avatar-updated"));
    toast({ title: "Avatar removed" });
  };

  // ── Profile state ───────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    fullName: "",
    dateOfBirth: "",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    country: "USA",
  });
  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.fullName || "",
        dateOfBirth: (user as any).dateOfBirth || "",
        streetAddress: (user as any).streetAddress || "",
        city: (user as any).city || "",
        state: (user as any).state || "",
        postalCode: (user as any).postalCode || "",
        country: (user as any).country || "USA",
      });
    }
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
            {/* Clickable avatar */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="relative h-[70px] w-[70px] rounded-full shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Change avatar"
            >
              <img
                src={avatarUrl ?? "/Images/Avatars/avatar-default.png"}
                alt="Avatar"
                className="h-[70px] w-[70px] rounded-full object-cover shadow-md"
              />
              <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>
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

      {/* Avatar Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Choose Your Avatar</DialogTitle>
          </DialogHeader>

          {/* Upload section */}
          <div className="shrink-0 border rounded-lg p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Upload your own photo</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Camera className="h-4 w-4" /> Choose file
              </Button>
              {avatarUrl?.startsWith("data:") && (
                <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} className="gap-1 text-destructive hover:text-destructive">
                  <X className="h-3.5 w-3.5" /> Remove photo
                </Button>
              )}
              <span className="text-xs text-muted-foreground">PNG, JPG, GIF · max 5 MB</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileUpload}
            />
          </div>

          {/* Preset avatar grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <p className="text-sm font-medium mb-3 sticky top-0 bg-background pt-1 pb-2 z-10">Or pick a preset avatar</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 pb-2">
              {AVATAR_PRESETS.map((name) => {
                const url = `/Images/Avatars/${name}.png`;
                const isSelected = avatarUrl === url;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => saveAvatar(url)}
                    className={`relative rounded-full overflow-hidden aspect-square focus:outline-none transition-transform hover:scale-105 ${
                      isSelected ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-border hover:ring-primary/50"
                    }`}
                    title={name}
                  >
                    <img
                      src={url}
                      alt={name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <BadgeCheck className="h-5 w-5 text-primary drop-shadow" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Freepik credit */}
          <p className="shrink-0 text-center border-t pt-3 mt-1">
            <a
              href="http://www.freepik.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Designed by Kubanek / Freepik
            </a>
          </p>
        </DialogContent>
      </Dialog>

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
                  <CardDescription>Update your display name and personal details</CardDescription>
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
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    data-testid="input-settings-dob"
                    type="date"
                    value={profile.dateOfBirth}
                    onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                    max={new Date().toISOString().split("T")[0]}
                  />
                  {(() => {
                    if (!profile.dateOfBirth) return null;
                    const dob = new Date(profile.dateOfBirth);
                    const today = new Date();
                    let age = today.getUTCFullYear() - dob.getUTCFullYear();
                    const hadBirthday =
                      today.getUTCMonth() > dob.getUTCMonth() ||
                      (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() >= dob.getUTCDate());
                    if (!hadBirthday) age -= 1;
                    if (age < 0 || age > 130) return null;
                    return (
                      <p className="text-xs text-muted-foreground">Age: <span className="font-medium text-foreground">{age}</span></p>
                    );
                  })()}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="streetAddress" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Street Address</Label>
                  <Input
                    id="streetAddress"
                    data-testid="input-settings-street-address"
                    value={profile.streetAddress}
                    onChange={(e) => setProfile({ ...profile, streetAddress: e.target.value })}
                    placeholder="123 Main Street"
                    autoComplete="street-address"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="city" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</Label>
                    <Input
                      id="city"
                      data-testid="input-settings-city"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      placeholder="Chicago"
                      autoComplete="address-level2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">State</Label>
                    <Select
                      value={profile.state || "none"}
                      onValueChange={(value) => setProfile({ ...profile, state: value === "none" ? "" : value })}
                      disabled={profile.country !== "USA"}
                    >
                      <SelectTrigger id="state" data-testid="select-settings-state">
                        <SelectValue placeholder={profile.country === "USA" ? "Select state" : "Not applicable"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select state</SelectItem>
                        {US_STATE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label} ({option.value})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {profile.country === "USA" ? "ZIP Code" : "Postal Code"}
                    </Label>
                    <Input
                      id="postalCode"
                      data-testid="input-settings-postal-code"
                      value={profile.postalCode}
                      onChange={(e) => setProfile({ ...profile, postalCode: e.target.value })}
                      placeholder={profile.country === "USA" ? "60601" : "Postal code"}
                      maxLength={10}
                      inputMode={profile.country === "USA" ? "numeric" : "text"}
                      pattern={profile.country === "USA" ? "\\d{5}(-\\d{4})?" : undefined}
                      title={profile.country === "USA" ? "Enter a 5-digit ZIP code or ZIP+4 (#####-####)." : undefined}
                      autoComplete="postal-code"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</Label>
                  <Select
                    value={profile.country || "USA"}
                    onValueChange={(value) => setProfile({
                      ...profile,
                      country: value,
                      state: value === "USA" ? profile.state : "",
                    })}
                  >
                    <SelectTrigger id="country" data-testid="select-settings-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label} ({option.value})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Address details are optional and saved with your profile.
                </p>
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
