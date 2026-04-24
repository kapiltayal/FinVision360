import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Landmark,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  PenLine,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect } from "react";

interface BankConfig {
  id: number;
  bankName: string;
  bankUrl: string;
  selectorsJson: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface BankRate {
  id: number;
  configId: number;
  bankName: string;
  rateType: string;
  rateName: string;
  rateValue: string;
  scrapedAt: string;
}

interface ScrapeResult {
  configId: number;
  bankName: string;
  success: boolean;
  ratesFound: number;
  error?: string;
}

const RATE_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  cd: "CD",
};

const RATE_TYPE_COLORS: Record<string, string> = {
  checking: "bg-[#1C91D4]/15 text-[#1475A8] dark:bg-[#1C91D4]/20 dark:text-[#7EC8ED]",
  savings: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cd: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const HTML_TEMPLATE = JSON.stringify(
  {
    mode: "html",
    savings: [{ selector: "", label: "Savings APY", regex: "(\\d+\\.?\\d*)\\s*%\\s*APY" }],
    checking: [{ selector: "", label: "Checking APY", regex: "(\\d+\\.?\\d*)\\s*%\\s*APY" }],
    cd: [{ selector: "", label: "CD APY", regex: "(\\d+\\.?\\d*)\\s*%\\s*APY" }],
  },
  null,
  2
);

const JSON_TEMPLATE = JSON.stringify(
  {
    mode: "json",
    savings: [{ selector: "data[0].rate", label: "Savings Rate" }],
  },
  null,
  2
);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getConfigMode(selectorsJson: string): "json" | "html" {
  try {
    const parsed = JSON.parse(selectorsJson);
    return parsed.mode === "json" ? "json" : "html";
  } catch {
    return "html";
  }
}

function scrapeErrorHint(error: string): string {
  if (error.includes("404")) return "URL not found — the bank may have changed their page. Try updating the URL.";
  if (error.includes("403")) return "Access blocked — this bank prevents automated access. Use Manual Entry instead.";
  if (error.includes("timed out")) return "Request timed out — the site took too long to respond.";
  if (error.includes("not valid JSON")) return "URL did not return JSON — check the URL or switch to HTML mode.";
  return error;
}

export default function BankRatesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BankConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteRateId, setDeleteRateId] = useState<number | null>(null);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualConfigId, setManualConfigId] = useState<string>("");
  const [manualForm, setManualForm] = useState({
    rateType: "savings",
    rateName: "",
    rateValue: "",
  });

  const [formData, setFormData] = useState({
    bankName: "",
    bankUrl: "",
    selectorsJson: HTML_TEMPLATE,
    notes: "",
    isActive: true,
  });

  const isAdmin = !!(user as any)?.isAdmin;

  useEffect(() => {
    if (user && !isAdmin) navigate("/");
  }, [user, isAdmin, navigate]);

  const { data: configs = [], isLoading: configsLoading } = useQuery<BankConfig[]>({
    queryKey: ["/api/bank-configs"],
    enabled: isAdmin,
  });

  const { data: rates = [], isLoading: ratesLoading } = useQuery<BankRate[]>({
    queryKey: ["/api/bank-rates"],
    enabled: isAdmin,
  });

  const createConfig = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/bank-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-configs"] });
      setConfigDialogOpen(false);
      toast({ title: "Bank configuration added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/bank-configs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-configs"] });
      setConfigDialogOpen(false);
      setEditingConfig(null);
      toast({ title: "Configuration updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bank-configs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      setDeleteConfirmId(null);
      toast({ title: "Bank configuration deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRate = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/bank-rates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      setDeleteRateId(null);
      toast({ title: "Rate record deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addManualRate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bank-rates/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: manualConfigId, ...manualForm }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
      setManualDialogOpen(false);
      setManualForm({ rateType: "savings", rateName: "", rateValue: "" });
      toast({ title: "Rate added manually" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!user || !isAdmin) return null;

  const scrapeOne = async (configId: number) => {
    setScrapingId(configId);
    try {
      const res = await fetch(`/api/bank-rates/scrape/${configId}`, { method: "POST" });
      const result: ScrapeResult = await res.json();
      if (result.success && result.ratesFound > 0) {
        toast({ title: `Scraped ${result.bankName}`, description: `Found ${result.ratesFound} rate(s)` });
      } else if (result.success && result.ratesFound === 0) {
        toast({
          title: `No rates found for ${result.bankName}`,
          description: "The page loaded but no rate values were detected. Try updating the selectors or use Manual Entry.",
          variant: "destructive",
        });
      } else {
        toast({
          title: `Scrape failed for ${result.bankName}`,
          description: scrapeErrorHint(result.error || "Unknown error"),
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setScrapingId(null);
    }
  };

  const scrapeAll = async () => {
    setScrapingAll(true);
    try {
      const res = await fetch("/api/bank-rates/scrape-all", { method: "POST" });
      const results: ScrapeResult[] = await res.json();
      const succeeded = results.filter((r) => r.success && r.ratesFound > 0).length;
      const noRates = results.filter((r) => r.success && r.ratesFound === 0).length;
      const failed = results.filter((r) => !r.success).length;
      const parts = [];
      if (succeeded > 0) parts.push(`${succeeded} fetched rates`);
      if (noRates > 0) parts.push(`${noRates} found no rates`);
      if (failed > 0) parts.push(`${failed} failed`);
      toast({ title: "Scrape complete", description: parts.join(", ") });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-rates"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setScrapingAll(false);
    }
  };

  const openAddDialog = () => {
    setEditingConfig(null);
    setFormData({ bankName: "", bankUrl: "", selectorsJson: HTML_TEMPLATE, notes: "", isActive: true });
    setConfigDialogOpen(true);
  };

  const openEditDialog = (config: BankConfig) => {
    setEditingConfig(config);
    setFormData({
      bankName: config.bankName,
      bankUrl: config.bankUrl,
      selectorsJson: config.selectorsJson,
      notes: config.notes || "",
      isActive: config.isActive,
    });
    setConfigDialogOpen(true);
  };

  const openManualDialog = (configId?: number) => {
    setManualConfigId(configId ? String(configId) : (configs[0]?.id ? String(configs[0].id) : ""));
    setManualForm({ rateType: "savings", rateName: "", rateValue: "" });
    setManualDialogOpen(true);
  };

  const handleSave = () => {
    try {
      JSON.parse(formData.selectorsJson);
    } catch {
      toast({ title: "Invalid JSON", description: "Selectors config must be valid JSON", variant: "destructive" });
      return;
    }
    if (editingConfig) {
      updateConfig.mutate({ id: editingConfig.id, data: formData });
    } else {
      createConfig.mutate(formData);
    }
  };

  const latestRates = rates.reduce<BankRate[]>((acc, rate) => {
    const key = `${rate.configId}-${rate.rateType}-${rate.rateName}`;
    if (!acc.find((r) => `${r.configId}-${r.rateType}-${r.rateName}` === key)) {
      acc.push(rate);
    }
    return acc;
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bank Rate Monitor</h1>
            <p className="text-sm text-muted-foreground">Track interest rates from banks and public APIs</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openManualDialog()} className="gap-2">
            <PenLine className="h-4 w-4" />
            Add Rate Manually
          </Button>
          <Button onClick={scrapeAll} disabled={scrapingAll || configs.filter((c) => c.isActive).length === 0} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${scrapingAll ? "animate-spin" : ""}`} />
            {scrapingAll ? "Fetching..." : "Fetch All"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="rates">
        <TabsList className="mb-4">
          <TabsTrigger value="rates">Current Rates</TabsTrigger>
          <TabsTrigger value="history">Rate History</TabsTrigger>
          <TabsTrigger value="configs">Bank Configurations</TabsTrigger>
        </TabsList>

        <TabsContent value="rates">
          {ratesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading rates...</div>
          ) : latestRates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No rates recorded yet.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click <strong>Fetch All</strong> to pull rates from configured sources, or <strong>Add Rate Manually</strong> to enter a rate directly.
                </p>
                <Button variant="outline" onClick={() => openManualDialog()} className="gap-2">
                  <PenLine className="h-4 w-4" />
                  Add Rate Manually
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank / Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestRates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.bankName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RATE_TYPE_COLORS[rate.rateType] || ""}`}>
                            {RATE_TYPE_LABELS[rate.rateType] || rate.rateType}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{rate.rateName}</TableCell>
                        <TableCell className="font-bold text-primary">{rate.rateValue}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(rate.scrapedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => setDeleteRateId(rate.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          {ratesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading history...</div>
          ) : rates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No rate history yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Rate Records</CardTitle>
                <CardDescription>Full history of fetched and manually entered rates ({rates.length} records)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank / Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Recorded At</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{rate.bankName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${RATE_TYPE_COLORS[rate.rateType] || ""}`}>
                            {RATE_TYPE_LABELS[rate.rateType] || rate.rateType}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{rate.rateName}</TableCell>
                        <TableCell className="font-bold text-primary">{rate.rateValue}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(rate.scrapedAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => setDeleteRateId(rate.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="configs">
          <div className="flex justify-end mb-4">
            <Button onClick={openAddDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
          </div>

          {configsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No bank configurations yet.</p>
                <Button onClick={openAddDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Source
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => {
                const configRates = latestRates.filter((r) => r.configId === config.id);
                const lastScraped = configRates.length > 0
                  ? configRates.reduce((a, b) => new Date(a.scrapedAt) > new Date(b.scrapedAt) ? a : b).scrapedAt
                  : null;
                const mode = getConfigMode(config.selectorsJson);

                return (
                  <Card key={config.id} className={!config.isActive ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold">{config.bankName}</h3>
                            <Badge variant={config.isActive ? "default" : "secondary"} className="text-xs">
                              {config.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {mode === "json" ? "JSON API" : "HTML Scrape"}
                            </Badge>
                          </div>
                          <a
                            href={config.bankUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary truncate block mb-2 max-w-xl"
                          >
                            {config.bankUrl}
                          </a>
                          {config.notes && (
                            <p className="text-xs text-muted-foreground mb-2">{config.notes}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {lastScraped ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                Last fetched {formatDate(lastScraped)} · {configRates.length} rate(s)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Never fetched
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openManualDialog(config.id)}
                            className="gap-1"
                          >
                            <PenLine className="h-3 w-3" />
                            Manual
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => scrapeOne(config.id)}
                            disabled={scrapingId === config.id || !config.isActive}
                            className="gap-1"
                          >
                            <Play className={`h-3 w-3 ${scrapingId === config.id ? "animate-pulse" : ""}`} />
                            {scrapingId === config.id ? "Fetching..." : "Fetch Now"}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(config)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setDeleteConfirmId(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConfig ? "Edit Source Configuration" : "Add Rate Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="e.g. Ally Bank – Savings"
                />
              </div>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input
                  value={formData.bankUrl}
                  onChange={(e) => setFormData({ ...formData, bankUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label>Selector Config (JSON)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm text-xs">
                    <p className="mb-1"><strong>HTML mode:</strong> use CSS selectors to find rate elements on the page.</p>
                    <p className="mb-1"><strong>JSON mode:</strong> use dot-notation paths to extract values from a JSON API response (e.g. <code>data[0].rate</code>).</p>
                    <p>Set <code>"mode": "json"</code> or <code>"mode": "html"</code> at the top level.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFormData({ ...formData, selectorsJson: HTML_TEMPLATE })}
                >
                  Use HTML template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFormData({ ...formData, selectorsJson: JSON_TEMPLATE })}
                >
                  Use JSON API template
                </Button>
              </div>
              <Textarea
                value={formData.selectorsJson}
                onChange={(e) => setFormData({ ...formData, selectorsJson: e.target.value })}
                rows={14}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Fed Funds rate — updated daily by NY Fed"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
              />
              <Label>Active (include in bulk fetch)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!formData.bankName || !formData.bankUrl || createConfig.isPending || updateConfig.isPending}
            >
              {createConfig.isPending || updateConfig.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Rate Entry Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rate Manually</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Use this to record a rate you found on a bank's website that can't be scraped automatically.
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Bank / Source</Label>
              <Select value={manualConfigId} onValueChange={setManualConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bank configuration" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rate Type</Label>
              <Select
                value={manualForm.rateType}
                onValueChange={(v) => setManualForm({ ...manualForm, rateType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="cd">CD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Product Name</Label>
              <Input
                value={manualForm.rateName}
                onChange={(e) => setManualForm({ ...manualForm, rateName: e.target.value })}
                placeholder="e.g. High-Yield Savings APY"
              />
            </div>
            <div className="space-y-1">
              <Label>Rate Value</Label>
              <Input
                value={manualForm.rateValue}
                onChange={(e) => setManualForm({ ...manualForm, rateValue: e.target.value })}
                placeholder="e.g. 4.50% or 4.50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addManualRate.mutate()}
              disabled={!manualConfigId || !manualForm.rateName || !manualForm.rateValue || addManualRate.isPending}
            >
              {addManualRate.isPending ? "Saving..." : "Save Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Config Confirm */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank Configuration</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the bank configuration and all its rate history. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId !== null && deleteConfig.mutate(deleteConfirmId)}
              disabled={deleteConfig.isPending}
            >
              {deleteConfig.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rate Confirm */}
      <Dialog open={deleteRateId !== null} onOpenChange={() => setDeleteRateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rate Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove this rate record from history. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRateId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteRateId !== null && deleteRate.mutate(deleteRateId)}
              disabled={deleteRate.isPending}
            >
              {deleteRate.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
