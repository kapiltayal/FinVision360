import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import logoPath from "@assets/FinVision360_Logo_H_(transparent)_1776714495394.png";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    getSupabase().then((sb) => {
      sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
        }
      });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please check and try again.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logoPath} alt="FinVision360" className="h-14 w-auto" />
          <p className="text-sm text-muted-foreground">Personal Finance Tracker</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardContent className="pt-6">
            {done ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Password updated!</h2>
                  <p className="text-sm text-muted-foreground mt-1">Your password has been changed successfully.</p>
                </div>
                <Button className="w-full" onClick={() => setLocation("/")}>
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-1 mb-6">
                  <h2 className="text-lg font-semibold">Set new password</h2>
                  <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        data-testid="input-new-password"
                        type={showPassword ? "text" : "password"}
                        className="pl-9 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        data-testid="input-confirm-password"
                        type="password"
                        className="pl-9"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading} data-testid="button-set-password">
                    {loading ? "Updating..." : "Set New Password"}
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
