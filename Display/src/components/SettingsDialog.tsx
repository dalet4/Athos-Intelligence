import { useState, useEffect } from "react";
import { Settings, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------
interface ModelEntry {
  id: string;
  name: string;
  provider: "OpenAI" | "Google" | "Anthropic" | "Meta";
  input: number;   // $/1M prompt tokens
  output: number;  // $/1M completion tokens
  link: number;    // quality 1-5
  extract: number;
  classify: number;
  note: string;
}

const MODEL_CATALOG: ModelEntry[] = [
  { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B", provider: "Meta",      input: 0,     output: 0,     link: 3, extract: 2, classify: 3, note: "Free tier, rate-limited" },
  { id: "google/gemini-flash-1.5",               name: "Gemini Flash 1.5",  provider: "Google",   input: 0.075, output: 0.30,  link: 5, extract: 4, classify: 5, note: "Best value overall" },
  { id: "google/gemini-2.0-flash-001",           name: "Gemini 2.0 Flash",  provider: "Google",   input: 0.10,  output: 0.40,  link: 5, extract: 4, classify: 5, note: "Slightly newer Flash" },
  { id: "openai/gpt-4o-mini",                    name: "GPT-4o Mini",       provider: "OpenAI",   input: 0.15,  output: 0.60,  link: 5, extract: 4, classify: 5, note: "JSON Schema support" },
  { id: "anthropic/claude-3-haiku",              name: "Claude 3 Haiku",    provider: "Anthropic",input: 0.25,  output: 1.25,  link: 4, extract: 4, classify: 5, note: "Fast, strong instructions" },
  { id: "anthropic/claude-3.5-haiku",            name: "Claude 3.5 Haiku",  provider: "Anthropic",input: 0.80,  output: 4.00,  link: 4, extract: 5, classify: 5, note: "Better reasoning" },
  { id: "openai/gpt-4o-2024-08-06",              name: "GPT-4o (Aug '24)",  provider: "OpenAI",   input: 2.50,  output: 10.00, link: 5, extract: 5, classify: 5, note: "High-quality structured outputs" },
  { id: "openai/gpt-4o",                         name: "GPT-4o",            provider: "OpenAI",   input: 5.00,  output: 15.00, link: 5, extract: 5, classify: 5, note: "Premium, rarely needed" },
  { id: "openai/gpt-4-turbo-preview",            name: "GPT-4 Turbo",       provider: "OpenAI",   input: 10.00, output: 30.00, link: 5, extract: 5, classify: 5, note: "Legacy — not recommended" },
];

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------
type TaskKey = "structured_extraction" | "link_extraction" | "classification";

interface Task {
  key: TaskKey;
  label: string;
  description: string;
  qualityKey: "extract" | "link" | "classify";
  promptTokens: number;
  completionTokens: number;
  recommended: string;
  cliOnly?: boolean;
}

const TASKS: Task[] = [
  {
    key: "structured_extraction",
    label: "Structured Extraction",
    description: "Parses agency website content into structured fields — description, clients, directors, revenue, etc.",
    qualityKey: "extract",
    promptTokens: 20_000,
    completionTokens: 800,
    recommended: "openai/gpt-4o-mini",
  },
  {
    key: "link_extraction",
    label: "Link Extraction",
    description: "Identifies About, Team, Partners, and Careers page URLs from homepage HTML. CLI pipeline only.",
    qualityKey: "link",
    promptTokens: 3_000,
    completionTokens: 150,
    recommended: "google/gemini-flash-1.5",
    cliOnly: true,
  },
  {
    key: "classification",
    label: "Classification",
    description: "Classifies growth signals (news, hiring, expansions) from search results. CLI pipeline only.",
    qualityKey: "classify",
    promptTokens: 500,
    completionTokens: 200,
    recommended: "openai/gpt-4o-mini",
    cliOnly: true,
  },
];

// ---------------------------------------------------------------------------
// localStorage keys & defaults
// ---------------------------------------------------------------------------
const LS_KEYS: Record<TaskKey, string> = {
  structured_extraction: "athos_model_structured_extraction",
  link_extraction: "athos_model_link_extraction",
  classification: "athos_model_classification",
};

const DEFAULTS: Record<TaskKey, string> = {
  structured_extraction: "openai/gpt-4o-mini",
  link_extraction: "google/gemini-flash-1.5",
  classification: "openai/gpt-4o-mini",
};

export function loadModelSettings(): Record<TaskKey, string> {
  return {
    structured_extraction: localStorage.getItem(LS_KEYS.structured_extraction) || DEFAULTS.structured_extraction,
    link_extraction:       localStorage.getItem(LS_KEYS.link_extraction)       || DEFAULTS.link_extraction,
    classification:        localStorage.getItem(LS_KEYS.classification)        || DEFAULTS.classification,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function estimateCost(model: ModelEntry, task: Task): number {
  return (task.promptTokens / 1_000_000) * model.input +
         (task.completionTokens / 1_000_000) * model.output;
}

function costColor(cost: number): string {
  if (cost === 0)    return "text-green-600";
  if (cost < 0.001)  return "text-emerald-600";
  if (cost < 0.01)   return "text-green-600";
  if (cost < 0.05)   return "text-yellow-600";
  return "text-red-500";
}

function costBarColor(cost: number): string {
  if (cost === 0)    return "bg-green-400";
  if (cost < 0.001)  return "bg-emerald-400";
  if (cost < 0.01)   return "bg-green-400";
  if (cost < 0.05)   return "bg-yellow-400";
  return "bg-red-400";
}

function formatCost(cost: number): string {
  if (cost === 0) return "FREE";
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  if (cost < 0.01)  return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(4)}`;
}

const PROVIDER_BADGE: Record<string, string> = {
  OpenAI:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  Google:    "bg-blue-50 text-blue-700 border-blue-200",
  Anthropic: "bg-orange-50 text-orange-700 border-orange-200",
  Meta:      "bg-purple-50 text-purple-700 border-purple-200",
};

function Stars({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <span className="text-xs tracking-tight">
      <span className="text-yellow-400">{"★".repeat(count)}</span>
      <span className="text-slate-200">{"★".repeat(total - count)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Usage stats helpers
// ---------------------------------------------------------------------------
interface PeriodStats {
  total_cost: number;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  top_models: { model: string; cost: number }[];
}

interface UsageStats {
  all_time: PeriodStats;
  monthly: PeriodStats;
  weekly: PeriodStats;
}

interface OpenRouterUsage {
  usage: number;
  limit: number | null;
  is_free_tier: boolean;
}

async function fetchOpenRouterUsage(): Promise<OpenRouterUsage | null> {
  try {
    const { data, error } = await supabase.functions.invoke('openrouter-usage');
    if (error || data?.error) return null;
    return data as OpenRouterUsage;
  } catch {
    return null;
  }
}

async function fetchUsageStats(): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  async function periodStats(since?: string): Promise<PeriodStats> {
    let query = supabase.from("llm_usage").select("cost, prompt_tokens, completion_tokens, run_id, model");
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const total_cost = rows.reduce((s, r) => s + Number(r.cost), 0);
    const prompt_tokens = rows.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0);
    const completion_tokens = rows.reduce((s, r) => s + (r.completion_tokens ?? 0), 0);
    const runs = new Set(rows.map(r => r.run_id).filter(Boolean)).size;

    // top models
    const modelMap: Record<string, number> = {};
    for (const r of rows) {
      modelMap[r.model] = (modelMap[r.model] ?? 0) + Number(r.cost);
    }
    const top_models = Object.entries(modelMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([model, cost]) => ({ model, cost }));

    return { total_cost, runs, prompt_tokens, completion_tokens, top_models };
  }

  const [all_time, monthly, weekly] = await Promise.all([
    periodStats(),
    periodStats(startOfMonth),
    periodStats(startOfWeek),
  ]);

  return { all_time, monthly, weekly };
}

function CostBadge({ cost }: { cost: number }) {
  const cls = cost === 0 ? "text-slate-400"
    : cost < 0.01  ? "text-emerald-600 font-semibold"
    : cost < 0.50  ? "text-green-600 font-semibold"
    : cost < 5.00  ? "text-yellow-600 font-semibold"
    : "text-red-500 font-semibold";
  return <span className={`font-mono text-lg ${cls}`}>${cost.toFixed(4)}</span>;
}

function StatCard({ label, stats }: { label: string; stats: PeriodStats }) {
  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <CostBadge cost={stats.total_cost} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
        <div>
          <div className="font-semibold text-foreground text-sm">{stats.runs}</div>
          <div>runs</div>
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm">{(stats.prompt_tokens / 1000).toFixed(1)}k</div>
          <div>prompt tok</div>
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm">{(stats.completion_tokens / 1000).toFixed(1)}k</div>
          <div>output tok</div>
        </div>
      </div>
      {stats.top_models.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/40">
          {stats.top_models.map(m => (
            <div key={m.model} className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground truncate max-w-[200px]">{m.model}</span>
              <span className="font-mono text-slate-600">${m.cost.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<TaskKey, string>>(loadModelSettings);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [orUsage, setOrUsage] = useState<OpenRouterUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const { toast } = useToast();

  // Reload settings and usage whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setSelected(loadModelSettings());
    setUsageLoading(true);
    Promise.all([fetchUsageStats(), fetchOpenRouterUsage()])
      .then(([stats, or]) => { setUsageStats(stats); setOrUsage(or); })
      .catch(console.error)
      .finally(() => setUsageLoading(false));
  }, [open]);

  function handleSave() {
    (Object.keys(LS_KEYS) as TaskKey[]).forEach(k => {
      localStorage.setItem(LS_KEYS[k], selected[k]);
    });
    setOpen(false);
    toast({ title: "Settings saved", description: "Model preferences updated." });
  }

  // Estimated cost per full enrichment run (structured_extraction only affects web)
  const enrichCost = (() => {
    const m = MODEL_CATALOG.find(m => m.id === selected.structured_extraction);
    const t = TASKS.find(t => t.key === "structured_extraction")!;
    return m ? estimateCost(m, t) : 0;
  })();

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="shadow-sm hover:shadow-md transition-all duration-300"
        title="Pipeline Settings"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-500" />
              Pipeline Settings
            </DialogTitle>
            <DialogDescription>
              Choose which LLM to use for each pipeline task. Costs are estimated per typical run.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="structured_extraction" className="mt-2">
            <TabsList className="w-full">
              {TASKS.map(t => (
                <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs">
                  {t.label}
                  {t.cliOnly && <span className="ml-1 text-[9px] text-muted-foreground">(CLI)</span>}
                </TabsTrigger>
              ))}
              <TabsTrigger value="usage" className="flex-1 text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Usage
              </TabsTrigger>
            </TabsList>

            {TASKS.map(task => {
              const costs = MODEL_CATALOG.map(m => estimateCost(m, task));
              const maxCost = Math.max(...costs) || 1;

              return (
                <TabsContent key={task.key} value={task.key} className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">{task.description}</p>

                  <RadioGroup
                    value={selected[task.key]}
                    onValueChange={(val) => setSelected(prev => ({ ...prev, [task.key]: val }))}
                    className="space-y-1.5"
                  >
                    {MODEL_CATALOG.map((model) => {
                      const cost = estimateCost(model, task);
                      const barPct = cost === 0 ? 2 : Math.max(2, (cost / maxCost) * 100);
                      const isRec = model.id === task.recommended;
                      const isSelected = selected[task.key] === model.id;

                      return (
                        <label
                          key={model.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? "border-primary/60 bg-primary/5"
                              : "border-border/50 hover:border-border hover:bg-slate-50/50"
                          }`}
                        >
                          <RadioGroupItem value={model.id} id={`${task.key}-${model.id}`} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                                {model.name}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PROVIDER_BADGE[model.provider]}`}>
                                {model.provider}
                              </Badge>
                              {isRec && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border border-green-200 hover:bg-green-100">
                                  Recommended
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{model.note}</p>

                            {/* Cost bar */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${costBarColor(cost)}`}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <span className={`text-[11px] font-mono font-semibold w-16 text-right ${costColor(cost)}`}>
                                {formatCost(cost)}/run
                              </span>
                              <Stars count={model[task.qualityKey]} />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </TabsContent>
              );
            })}
            {/* Usage tab */}
            <TabsContent value="usage" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                LLM spend tracked from web enrichments. CLI pipeline usage is tracked separately via <code className="bg-muted px-1 rounded text-[11px]">python cost_manager.py --stats</code>.
              </p>
              {usageLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading usage data…</span>
                </div>
              ) : usageStats ? (
                <div className="grid grid-cols-1 gap-3">
                  <StatCard label="This Week"  stats={usageStats.weekly} />
                  <StatCard label="This Month" stats={usageStats.monthly} />
                  <StatCard label="All Time"   stats={usageStats.all_time} />

                  {/* OpenRouter account lifetime spend */}
                  {orUsage && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-foreground">OpenRouter Account</span>
                          <p className="text-[11px] text-muted-foreground">Lifetime spend across all API keys</p>
                        </div>
                        <CostBadge cost={orUsage.usage} />
                      </div>
                      {orUsage.limit !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Credit limit</span>
                            <span className="font-mono">${orUsage.limit.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((orUsage.usage / orUsage.limit) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right">
                            {((orUsage.usage / orUsage.limit) * 100).toFixed(1)}% used
                          </div>
                        </div>
                      )}
                      {orUsage.is_free_tier && (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                          Free tier
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No usage data yet.</p>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground flex-1">
              Estimated cost per web enrichment:{" "}
              <span className={`font-semibold font-mono ${costColor(enrichCost)}`}>
                {formatCost(enrichCost)}
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Settings</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
