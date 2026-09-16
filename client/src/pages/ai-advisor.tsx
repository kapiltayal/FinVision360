import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, History, CreditCard, Loader2, Sparkles, Send, Trash2, RotateCcw,
} from "lucide-react";
import { type Asset, type Liability } from "@shared/schema";
import { getAccessToken } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdvisorHistoryEntry = {
  id: number;
  queryType: "scenario" | "debt_strategy" | "forecast";
  queryText: string;
  responseText: string;
  createdAt: string;
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function MarkdownRenderer({ content }: { content: string }) {
  const escaped = escapeHtml(content);
  const html = escaped
    .replace(/### (.*)/g, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/## (.*)/g, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/# (.*)/g, '<h1 class="text-xl font-bold mt-5 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
    .replace(/^\d+\. (.*)/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function StreamingResponse({
  endpoint,
  body,
  onStart,
  onComplete,
}: {
  endpoint: string;
  body: any;
  onStart?: () => void;
  onComplete?: () => void;
}) {
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    async function stream() {
      setIsStreaming(true);
      setResponse("");
      setError("");
      onStart?.();

      try {
        const accessToken = await getAccessToken();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(body),
          credentials: "include",
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.message || "Unable to generate advice right now.");
        }

        reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setResponse((prev) => prev + data.content);
              }
              if (data.done) {
                setIsStreaming(false);
                 onComplete?.();
              }
              if (data.error) {
                setError(data.error);
                setIsStreaming(false);
              }
            } catch {}
          }
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        setError(err.message || "Something went wrong");
      } finally {
        if (!abortController.signal.aborted) setIsStreaming(false);
      }
    }

    stream();
    return () => {
      cancelled = true;
      abortController.abort();
      void reader?.cancel().catch(() => {});
    };
  }, [endpoint, JSON.stringify(body)]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [response]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div
          ref={containerRef}
          className={response && !isStreaming ? "max-h-[500px] overflow-y-auto" : "max-h-[500px] overflow-hidden"}
        >
          {response ? (
            <MarkdownRenderer content={response} />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Analyzing your finances...</span>
            </div>
          )}
        </div>
        {isStreaming && (
          <div className="mt-3 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Still generating...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AIAdvisorPage() {
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ["/api/liabilities"] });
  const { data: advisorSettings } = useQuery<{ aiAdvisorName?: string }>({
    queryKey: ["/api/recommendation-settings"],
    queryFn: () => apiRequest("GET", "/api/recommendation-settings").then((r) => r.json()),
  });
  const savedAdvisorName = advisorSettings?.aiAdvisorName?.trim();
  const advisorName = savedAdvisorName || "Whizzy";
  const [scenarioQuery, setScenarioQuery] = useState("");
  const [scenarioSubmitted, setScenarioSubmitted] = useState<any>(null);
  const scenarioRequestId = useRef(0);

  const [debtBudget, setDebtBudget] = useState("500");
  const [debtSubmitted, setDebtSubmitted] = useState<any>(null);
  const debtRequestId = useRef(0);
  const {
    data: historyRaw,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery<AdvisorHistoryEntry[]>({ queryKey: ["/api/ai/history"] });
  const history = Array.isArray(historyRaw) ? historyRaw : [];
  const [deleteTarget, setDeleteTarget] = useState<AdvisorHistoryEntry | null>(null);
  const [clearArchiveOpen, setClearArchiveOpen] = useState(false);
  const archiveListRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const collapseArchives = () => {
    archiveListRef.current?.querySelectorAll<HTMLDetailsElement>("details").forEach((archive) => {
      archive.open = false;
    });
  };

  const handleScenarioSubmit = () => {
    if (!scenarioQuery.trim()) return;
    scenarioRequestId.current += 1;
    setScenarioSubmitted({ scenario: scenarioQuery.trim(), requestId: scenarioRequestId.current });
  };

  const handleDebtSubmit = () => {
    debtRequestId.current += 1;
    setDebtSubmitted({ monthlyBudget: debtBudget, requestId: debtRequestId.current });
  };

  const clearScenario = () => {
    setScenarioQuery("");
    setScenarioSubmitted(null);
  };

  const resetDebtStrategy = () => {
    setDebtBudget("500");
    setDebtSubmitted(null);
  };

  const refreshHistory = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/ai/history"] });
  };
  const deleteHistoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai/history/${id}`);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      refreshHistory();
    },
    onError: (error: Error) => {
      toast({ title: "Could not delete archive entry", description: error.message, variant: "destructive" });
    },
  });
  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/ai/history");
    },
    onSuccess: () => {
      setClearArchiveOpen(false);
      refreshHistory();
    },
    onError: (error: Error) => {
      toast({ title: `Could not clear ${advisorName} Archives`, description: error.message, variant: "destructive" });
    },
  });

  const scenarioSuggestions = [
    "What if I increase my monthly savings by $500?",
    "Should I pay off my highest-interest debt or invest?",
    "What if I sell my property and invest the proceeds?",
    "How would refinancing my mortgage at 5% impact me?",
    "Can I retire 5 years earlier with aggressive saving?",
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold" data-testid="text-ai-title">Your Intelligence Lab</h1>
        <p className="text-muted-foreground">Clear, personalized guidance for your financial future</p>
      </div>

      <Tabs
        defaultValue="scenario"
        onValueChange={(value) => {
          if (value === "history") collapseArchives();
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3">
          <TabsTrigger
            value="scenario"
            data-testid="tab-scenario"
            className="h-10 rounded-xl border border-border/70 bg-muted/70 px-4 text-muted-foreground shadow-sm hover:border-primary/40 hover:bg-muted data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
          >
            <Brain className="h-4 w-4 mr-2" /> Ask {advisorName}
          </TabsTrigger>
          <TabsTrigger
            value="debt"
            data-testid="tab-debt"
            className="h-10 rounded-xl border border-border/70 bg-muted/70 px-4 text-muted-foreground shadow-sm hover:border-primary/40 hover:bg-muted data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
          >
            <CreditCard className="h-4 w-4 mr-2" /> Debt Strategy
          </TabsTrigger>
          <TabsTrigger
            value="history"
            data-testid="tab-history"
            onClick={collapseArchives}
            className="h-10 rounded-xl border border-border/70 bg-muted/70 px-4 text-muted-foreground shadow-sm hover:border-primary/40 hover:bg-muted data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
          >
            <History className="h-4 w-4 mr-2" /> {advisorName} Archives ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenario" forceMount className="space-y-4 mt-4 data-[state=inactive]:hidden">
          <Card className="border-2 border-primary/30 shadow-md shadow-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Ask About Your Finances
              </CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                AI-generated guidance may be inaccurate or incomplete. Review it carefully, verify important details,
                and consult a qualified financial advisor before making financial decisions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {scenarioSuggestions.map((s, i) => (
                  <Button
                    key={i}
                    variant="secondary"
                    size="sm"
                    onClick={() => setScenarioQuery(s)}
                    data-testid={`button-suggestion-${i}`}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={scenarioQuery}
                  onChange={(e) => setScenarioQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleScenarioSubmit();
                    }
                  }}
                  placeholder="Describe a financial scenario or ask a question..."
                  rows={2}
                  className="flex-1"
                  data-testid="input-scenario-query"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearScenario}
                  disabled={!scenarioQuery && !scenarioSubmitted}
                  className="self-end"
                  data-testid="button-clear-scenario"
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Clear
                </Button>
                <Button type="button" onClick={handleScenarioSubmit} className="self-end" data-testid="button-analyze-scenario">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          {scenarioSubmitted && (
            <StreamingResponse
              key={JSON.stringify(scenarioSubmitted)}
              endpoint="/api/ai/scenario"
              body={scenarioSubmitted}
              onComplete={refreshHistory}
            />
          )}
        </TabsContent>

        <TabsContent value="debt" forceMount className="space-y-4 mt-4 data-[state=inactive]:hidden">
          <Card className="border-2 border-primary/30 shadow-md shadow-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Debt Reduction Strategy
              </CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                AI-generated guidance may be inaccurate or incomplete. Review it carefully, verify important details,
                and consult a qualified financial advisor before making financial decisions.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {liabilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add some liabilities first to get debt reduction recommendations.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Monthly Budget for Extra Debt Payments ($)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={debtBudget}
                        onChange={(e) => setDebtBudget(e.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleDebtSubmit();
                          }
                        }}
                        data-testid="input-debt-budget"
                        className="max-w-xs"
                      />
                      <Button type="button" variant="outline" onClick={resetDebtStrategy} data-testid="button-reset-debt">
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset
                      </Button>
                      <Button type="button" onClick={handleDebtSubmit} data-testid="button-analyze-debt">
                        <Brain className="h-4 w-4 mr-2" /> Analyze
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Your debts ({liabilities.length}):</p>
                    {liabilities.map((l) => (
                      <p key={l.id}>
                        {l.name}: ${parseFloat(l.balance || "0").toLocaleString()} at {l.interestRate}%
                      </p>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          {debtSubmitted && (
            <StreamingResponse
              key={JSON.stringify(debtSubmitted)}
              endpoint="/api/ai/debt-strategy"
              body={debtSubmitted}
              onComplete={refreshHistory}
            />
          )}
        </TabsContent>

        <TabsContent value="history" forceMount className="space-y-4 mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 border-b-2 border-primary/20 bg-muted/50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <History className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide">{advisorName} Archives</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Saved AI questions and responses</p>
                </div>
              </div>
              {history.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setClearArchiveOpen(true)}
                  disabled={clearHistoryMutation.isPending}
                  data-testid="button-clear-whizzy-archives"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear archive
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : historyError ? (
                <p className="p-5 text-sm text-destructive">{advisorName} archives could not be loaded.</p>
              ) : history.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium">No saved queries yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Completed Ask {advisorName} and Debt Strategy responses will appear here.
                  </p>
                </div>
              ) : (
                <div ref={archiveListRef} className="divide-y">
                    {history.map((entry) => (
                    <details
                      key={entry.id}
                      className="group p-3"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary">
                              {entry.queryType === "scenario"
                                ? `Ask ${advisorName}`
                                : entry.queryType === "debt_strategy"
                                  ? "Debt Strategy"
                                  : "Net Worth Forecast"}
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">{entry.queryText}</p>
                          </div>
                          <div className="flex shrink-0 items-start gap-2">
                            <time className="pt-1 text-xs text-muted-foreground" dateTime={entry.createdAt}>
                              {new Date(entry.createdAt).toLocaleString()}
                            </time>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${entry.queryText}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDeleteTarget(entry);
                              }}
                              data-testid={`button-delete-archive-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground group-open:hidden">Select to view response</p>
                      </summary>
                      <div className="mt-4 rounded-lg border bg-muted/20 p-4">
                        <MarkdownRenderer content={entry.responseText} />
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this archived response?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this saved question and response from {advisorName} Archives.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteHistoryMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteHistoryMutation.isPending}
                  onClick={() => deleteTarget && deleteHistoryMutation.mutate(deleteTarget.id)}
                >
                  {deleteHistoryMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={clearArchiveOpen} onOpenChange={setClearArchiveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear {advisorName} Archives?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all saved AI questions and responses. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearHistoryMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={clearHistoryMutation.isPending}
                  onClick={() => clearHistoryMutation.mutate()}
                >
                  {clearHistoryMutation.isPending ? "Clearing..." : "Clear archive"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
