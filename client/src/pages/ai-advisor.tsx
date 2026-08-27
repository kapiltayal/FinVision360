import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Lightbulb, TrendingUp, CreditCard, Loader2, Sparkles, Send } from "lucide-react";
import { type Asset, type Liability } from "@shared/schema";

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
}: {
  endpoint: string;
  body: any;
  onStart?: () => void;
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
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
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
        <div ref={containerRef} className="max-h-[500px] overflow-y-auto">
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
  const [scenarioQuery, setScenarioQuery] = useState("");
  const [scenarioSubmitted, setScenarioSubmitted] = useState<any>(null);

  const [debtBudget, setDebtBudget] = useState("500");
  const [debtSubmitted, setDebtSubmitted] = useState<any>(null);

  const [forecastYears, setForecastYears] = useState("10");
  const [forecastSubmitted, setForecastSubmitted] = useState<any>(null);

  const handleScenarioSubmit = () => {
    if (!scenarioQuery.trim()) return;
    setScenarioSubmitted({ scenario: scenarioQuery.trim() });
  };

  const handleDebtSubmit = () => {
    setDebtSubmitted({ monthlyBudget: debtBudget });
  };

  const handleForecastSubmit = () => {
    setForecastSubmitted({ yearsToForecast: forecastYears });
  };

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
        <h1 className="text-2xl font-bold" data-testid="text-ai-title">AI Finance Intelligence</h1>
        <p className="text-muted-foreground">Get personalized insights powered by AI</p>
      </div>

      <Tabs defaultValue="scenario">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenario" data-testid="tab-scenario">
            <Lightbulb className="h-4 w-4 mr-2" /> Scenario Planner
          </TabsTrigger>
          <TabsTrigger value="debt" data-testid="tab-debt">
            <CreditCard className="h-4 w-4 mr-2" /> Debt Strategy
          </TabsTrigger>
          <TabsTrigger value="forecast" data-testid="tab-forecast">
            <TrendingUp className="h-4 w-4 mr-2" /> Net Worth Forecast
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenario" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Ask About Your Finances
              </CardTitle>
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
                  placeholder="Describe a financial scenario or ask a question..."
                  rows={2}
                  className="flex-1"
                  data-testid="input-scenario-query"
                />
                <Button onClick={handleScenarioSubmit} className="self-end" data-testid="button-analyze-scenario">
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
            />
          )}
        </TabsContent>

        <TabsContent value="debt" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Debt Reduction Strategy
              </CardTitle>
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
                        data-testid="input-debt-budget"
                        className="max-w-xs"
                      />
                      <Button onClick={handleDebtSubmit} data-testid="button-analyze-debt">
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
            />
          )}
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Net Worth Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Years to Forecast</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={forecastYears}
                    onChange={(e) => setForecastYears(e.target.value)}
                    min={1}
                    max={50}
                    className="max-w-xs"
                    data-testid="input-forecast-years"
                  />
                  <Button onClick={handleForecastSubmit} data-testid="button-forecast">
                    <TrendingUp className="h-4 w-4 mr-2" /> Forecast
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          {forecastSubmitted && (
            <StreamingResponse
              key={JSON.stringify(forecastSubmitted)}
              endpoint="/api/ai/forecast"
              body={forecastSubmitted}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
