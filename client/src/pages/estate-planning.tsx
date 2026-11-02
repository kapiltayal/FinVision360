import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ScrollText, Users, UserCheck, Plus, Pencil, Trash2,
  CheckCircle2, Circle, Wallet, Phone, Mail, Building2,
  ChevronDown, ChevronRight, Save, Layers3,
} from "lucide-react";
import {
  type Asset, type EstateBeneficiaryWithEntries, type EstateBeneficiaryPerson, type EstateDocument, type EstateContact,
  ESTATE_DOCUMENT_TYPES, ESTATE_CONTACT_ROLES,
} from "@shared/schema";
import { type BookCategory, categoryLabel, groupedBookEntries } from "@/lib/book-categories";
import { formatCurrency } from "@/lib/format";
import { summarizeBeneficiaryAllocations } from "@/lib/estate-beneficiary-allocation";
import { BeneficiaryAllocationView } from "@/components/estate/beneficiary-allocation-view";

type BeneficiaryDraft = {
  name: string;
  beneficiaryId?: number;
  percentage: string;
  notes: string;
};

function formatBeneficiaryUpdatedAt(value: Date | string | null | undefined) {
  if (!value) return "Not recorded";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

type EstateTab = "beneficiaries" | "documents" | "contacts";

const ESTATE_TABS: { key: EstateTab; label: string; icon: typeof UserCheck }[] = [
  { key: "beneficiaries", label: "Beneficiaries", icon: UserCheck },
  { key: "documents", label: "Documents", icon: ScrollText },
  { key: "contacts", label: "Contacts", icon: Users },
];

const ESTATE_DOCUMENT_GUIDANCE: Record<
  (typeof ESTATE_DOCUMENT_TYPES)[number]["key"],
  { purpose: string; whenToUse: string }
> = {
  will: {
    purpose: "States how you want assets distributed and can name an executor and guardians for minor children.",
    whenToUse: "Use it to document your wishes when you have assets, dependents, or specific people and organizations you want to provide for. Review it after major life changes.",
  },
  trust: {
    purpose: "Places assets under the care of a trustee who can manage them during your lifetime and distribute them according to your instructions.",
    whenToUse: "Consider it when you want continuity if you become incapacitated, more privacy than probate may provide, or a structured transfer of assets. Assets generally need to be titled to the trust.",
  },
  poa_financial: {
    purpose: "Names someone you trust to handle financial and legal matters if you cannot manage them yourself.",
    whenToUse: "Set it up before an illness or emergency so your agent can help with banking, investments, real estate, and other financial transactions when needed.",
  },
  poa_healthcare: {
    purpose: "Names a healthcare agent to make medical decisions for you when you are unable to make or communicate them.",
    whenToUse: "Use it to make sure a trusted person can speak with your care team and make decisions that follow your wishes during an accident or serious illness.",
  },
  living_will: {
    purpose: "Records your preferences about life-sustaining treatment and end-of-life care.",
    whenToUse: "Complete it in advance so your family, healthcare agent, and doctors have guidance if you cannot communicate your treatment preferences.",
  },
  hipaa: {
    purpose: "Authorizes specific people to receive protected health information from your healthcare providers.",
    whenToUse: "Use it when you want family members or your healthcare agent to be able to discuss your medical information with providers.",
  },
  beneficiary_designations: {
    purpose: "Directs accounts such as retirement plans and life insurance policies to the people or organizations you name.",
    whenToUse: "Review it after marriage, divorce, births, deaths, or account changes, and make sure the designations match your broader estate plan.",
  },
  letter_of_intent: {
    purpose: "Provides practical, personal instructions about items such as final wishes, pets, digital assets, and sentimental property.",
    whenToUse: "Use it to communicate details that may not belong in a legal document. Keep it current and accessible to the people helping your family.",
  },
};

// ── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ contact, onClose }: { contact?: EstateContact; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: contact?.name || "",
    role: contact?.role || "attorney",
    phone: contact?.phone || "",
    email: contact?.email || "",
    firm: contact?.firm || "",
    notes: contact?.notes || "",
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      contact
        ? apiRequest("PUT", `/api/estate/contacts/${contact.id}`, data)
        : apiRequest("POST", "/api/estate/contacts", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/estate/contacts"] });
      toast({ title: contact ? "Contact updated" : "Contact added" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role) {
      toast({ title: "Name and role are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Name</Label>
          <Input data-testid="input-contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Jane Smith" required />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger data-testid="select-contact-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTATE_CONTACT_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input data-testid="input-contact-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input data-testid="input-contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Firm / Organization</Label>
          <Input data-testid="input-contact-firm" value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} placeholder="e.g., Smith & Associates Law" />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Notes</Label>
          <Textarea data-testid="input-contact-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-contact">
          {saveMutation.isPending ? "Saving..." : contact ? "Update Contact" : "Add Contact"}
        </Button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EstatePlanningPage() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EstateContact | undefined>();
  const [expandedAsset, setExpandedAsset] = useState<number | null>(null);
  const [beneficiaryView, setBeneficiaryView] = useState<"account" | "beneficiary">("account");
  const [activeTab, setActiveTab] = useState<EstateTab>(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    const validTabs: EstateTab[] = ["beneficiaries", "documents", "contacts"];
    return validTabs.includes(tab as EstateTab) ? (tab as EstateTab) : "beneficiaries";
  });
  const [expandedDocuments, setExpandedDocuments] = useState<Record<string, boolean>>({});
  // Local beneficiary edits are only committed when the user clicks Save.
  const [benEdits, setBenEdits] = useState<Record<number, BeneficiaryDraft[]>>({});
  const [newBeneficiaryOpen, setNewBeneficiaryOpen] = useState(false);
  const [newBeneficiaryName, setNewBeneficiaryName] = useState("");
  const [editingBeneficiary, setEditingBeneficiary] = useState<EstateBeneficiaryPerson | null>(null);
  const [newBeneficiaryTarget, setNewBeneficiaryTarget] = useState<{ assetId: number; index: number } | null>(null);

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    const validTabs: EstateTab[] = ["beneficiaries", "documents", "contacts"];
    setActiveTab(validTabs.includes(tab as EstateTab) ? (tab as EstateTab) : "beneficiaries");
  }, [search]);

  const selectEstateTab = (tab: EstateTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    setLocation(`${location}?${params.toString()}`, { replace: true });
  };

  const { data: assets = [], isLoading: aLoading } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<BookCategory[]>({ queryKey: ["/api/assets/categories"] });
  const { data: beneficiaries = [], isLoading: bLoading } = useQuery<EstateBeneficiaryWithEntries[]>({ queryKey: ["/api/estate/beneficiaries"] });
  const { data: beneficiaryPeople = [], isLoading: peopleLoading, isError: peopleError, refetch: reloadPeople } = useQuery<EstateBeneficiaryPerson[]>({ queryKey: ["/api/estate/beneficiary-people"] });
  const { data: documents = [], isLoading: dLoading } = useQuery<EstateDocument[]>({ queryKey: ["/api/estate/documents"] });
  const { data: contacts = [], isLoading: cLoading } = useQuery<EstateContact[]>({ queryKey: ["/api/estate/contacts"] });

  const isLoading = aLoading || categoriesLoading || bLoading || dLoading || cLoading;

  const beneficiaryMap = new Map(beneficiaries.map((b) => [b.assetId, b]));
  const documentMap = new Map(documents.map((d) => [d.documentType, d]));
  const docsComplete = ESTATE_DOCUMENT_TYPES.filter((d) => documentMap.get(d.key)?.isComplete).length;
  const assetsWithBeneficiary = beneficiaries.filter((b) => b.hasBeneficiary).length;
  const groupedAssets = groupedBookEntries(assets, categories);
  const assetsByParent = new Map<string, typeof groupedAssets>();
  groupedAssets.forEach((group) => {
    const parentGroups = assetsByParent.get(group.parentCategory) ?? [];
    parentGroups.push(group);
    assetsByParent.set(group.parentCategory, parentGroups);
  });
  const parentAssetGroups = Array.from(assetsByParent.entries());

  const allocationSummary = useMemo(
    () => summarizeBeneficiaryAllocations(assets, beneficiaries, beneficiaryPeople),
    [assets, beneficiaries, beneficiaryPeople],
  );
  const totalAssetValue = allocationSummary.totalAssetValue;
  const assignedBeneficiaryValue = allocationSummary.totalAssignedValue;
  const beneficiaryValueCoverage = totalAssetValue > 0
    ? Math.min(100, Math.round((assignedBeneficiaryValue / totalAssetValue) * 100))
    : 0;

  // ── Beneficiary toggle (hasBeneficiary on/off) — optimistic ───────────────
  const toggleBeneficiaryMutation = useMutation({
    mutationFn: (data: { assetId: number; hasBeneficiary: boolean; beneficiaries?: Array<{ name: string; percentage: number; notes: string | null }> }) =>
      apiRequest("PUT", "/api/estate/beneficiaries", data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["/api/estate/beneficiaries"] });
      const prev = qc.getQueryData<EstateBeneficiaryWithEntries[]>(["/api/estate/beneficiaries"]);
      qc.setQueryData<EstateBeneficiaryWithEntries[]>(["/api/estate/beneficiaries"], (old = []) => {
        const idx = old.findIndex((b) => b.assetId === vars.assetId);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], hasBeneficiary: vars.hasBeneficiary };
          return updated;
        }
        return [...old, {
          id: -1,
          userId: "",
          assetId: vars.assetId,
          hasBeneficiary: vars.hasBeneficiary,
          beneficiaryName: null,
          notes: null,
          lastUpdatedAt: null,
          beneficiaries: [],
        }];
      });
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/estate/beneficiaries"], ctx.prev);
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/estate/beneficiaries"] }),
  });

  // ── Beneficiary list save ──────────────────────────────────────────────────
  const addBeneficiaryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/estate/beneficiary-people", { name });
      return response.json() as Promise<EstateBeneficiaryPerson>;
    },
    onSuccess: (person) => {
      qc.setQueryData<EstateBeneficiaryPerson[]>(["/api/estate/beneficiary-people"], (old = []) =>
        [...old.filter(item => item.id !== person.id), person].sort((a, b) => a.name.localeCompare(b.name)));
      qc.invalidateQueries({ queryKey: ["/api/estate/beneficiary-people"] });
      if (newBeneficiaryTarget) {
        const { assetId, index } = newBeneficiaryTarget;
        setBenEdits(prev => ({
          ...prev,
          [assetId]: (prev[assetId] || []).map((draft, i) => i === index ? { ...draft, name: person.name, beneficiaryId: person.id } : draft),
        }));
      }
      setNewBeneficiaryOpen(false);
      setNewBeneficiaryName("");
      setNewBeneficiaryTarget(null);
      toast({ title: "Beneficiary available for selection" });
    },
    onError: (error: Error) => toast({ title: "Could not add beneficiary", description: error.message, variant: "destructive" }),
  });

  const openNewBeneficiary = (target: { assetId: number; index: number } | null = null) => {
    setEditingBeneficiary(null);
    setNewBeneficiaryTarget(target);
    setNewBeneficiaryName("");
    setNewBeneficiaryOpen(true);
  };

  const updateBeneficiaryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await apiRequest("PATCH", `/api/estate/beneficiary-people/${id}`, { name });
      return response.json() as Promise<EstateBeneficiaryPerson>;
    },
    onSuccess: async (person) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: ["/api/estate/beneficiary-people"] }),
        qc.cancelQueries({ queryKey: ["/api/estate/beneficiaries"] }),
      ]);
      qc.setQueryData<EstateBeneficiaryPerson[]>(["/api/estate/beneficiary-people"], (old = []) =>
        [...old.filter(item => item.id !== person.id), person].sort((a, b) => a.name.localeCompare(b.name)));
      // Keep unsaved account percentages/notes intact and update only the selected identity.
      setBenEdits(prev => Object.fromEntries(Object.entries(prev).map(([assetId, drafts]) => [
        assetId, drafts.map(draft => draft.beneficiaryId === person.id ||
          (!draft.beneficiaryId && draft.name.trim().replace(/\s+/g, " ").toLowerCase() === editingBeneficiary?.normalizedName)
          ? { ...draft, name: person.name, beneficiaryId: person.id } : draft),
      ])));
      qc.invalidateQueries({ queryKey: ["/api/estate/beneficiary-people"] });
      qc.invalidateQueries({ queryKey: ["/api/estate/beneficiaries"] });
      setNewBeneficiaryOpen(false);
      setEditingBeneficiary(null);
      setNewBeneficiaryName("");
      toast({ title: "Beneficiary updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update beneficiary", description: error.message, variant: "destructive" }),
  });
  const beneficiaryDialogPending = addBeneficiaryMutation.isPending || updateBeneficiaryMutation.isPending;

  const saveBenDetailsMutation = useMutation({
    mutationFn: (data: { assetId: number; hasBeneficiary: boolean; beneficiaries: Array<{ name: string; percentage: number; notes: string | null }> }) =>
      apiRequest("PUT", "/api/estate/beneficiaries", data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/estate/beneficiaries"] });
      setExpandedAsset((current) => current === variables.assetId ? null : current);
      toast({ title: "Beneficiaries saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  // ── Document toggle — optimistic ──────────────────────────────────────────
  const toggleDocumentMutation = useMutation({
    mutationFn: (data: { documentType: string; isComplete: boolean; notes?: string | null }) =>
      apiRequest("PUT", "/api/estate/documents", data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["/api/estate/documents"] });
      const prev = qc.getQueryData<EstateDocument[]>(["/api/estate/documents"]);
      qc.setQueryData<EstateDocument[]>(["/api/estate/documents"], (old = []) => {
        const idx = old.findIndex((d) => d.documentType === vars.documentType);
        const now = new Date().toISOString();
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], isComplete: vars.isComplete, updatedAt: now as unknown as Date };
          return updated;
        }
        return [...old, { id: -1, userId: "", documentType: vars.documentType, isComplete: vars.isComplete, notes: null, updatedAt: now as unknown as Date }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/estate/documents"], ctx.prev);
      toast({ title: "Failed to save", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/estate/documents"] }),
  });

  // ── Contact delete ────────────────────────────────────────────────────────
  const deleteContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/estate/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/estate/contacts"] });
      toast({ title: "Contact removed" });
    },
  });

  const roleLabel = (role: string) => ESTATE_CONTACT_ROLES.find((r) => r.value === role)?.label || role;

  const openExpand = (assetId: number, ben: EstateBeneficiaryWithEntries | undefined) => {
    setExpandedAsset(assetId);
    setBenEdits((prev) => {
      if (prev[assetId]) return prev;
      const existing = ben?.beneficiaries?.map((beneficiary) => ({
        name: beneficiary.beneficiaryName,
        beneficiaryId: beneficiary.beneficiaryId ?? beneficiaryPeople.find(person =>
          person.normalizedName === beneficiary.beneficiaryName.trim().replace(/\s+/g, " ").toLowerCase())?.id,
        percentage: String(beneficiary.allocationPercentage),
        notes: beneficiary.notes || "",
      })) || [];
      const legacy = existing.length === 0 && ben?.beneficiaryName
        ? [{
            name: ben.beneficiaryName,
            beneficiaryId: beneficiaryPeople.find(person => person.normalizedName === ben.beneficiaryName!.trim().replace(/\s+/g, " ").toLowerCase())?.id,
            percentage: "100", notes: ben.notes || "",
          }]
        : existing;
      return { ...prev, [assetId]: legacy.length > 0 ? legacy : [{ name: "", percentage: "100", notes: "" }] };
    });
  };

  const updateBeneficiaryDraft = (assetId: number, index: number, field: keyof BeneficiaryDraft, value: string) => {
    setBenEdits((prev) => ({
      ...prev,
      [assetId]: (prev[assetId] || []).map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft
      ),
    }));
  };

  const draftsToPayload = (drafts: BeneficiaryDraft[]) =>
    drafts.map((draft) => ({
      name: draft.name.trim(),
      beneficiaryId: draft.beneficiaryId,
      percentage: Number(draft.percentage),
      notes: draft.notes.trim() || null,
    }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
      {/* Section navigation */}
      <nav className="border-b bg-background shrink-0" aria-label="Estate planning sections">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {ESTATE_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.key === "beneficiaries"
              ? assetsWithBeneficiary
              : tab.key === "documents"
                ? docsComplete
                : contacts.length;
            const countLabel = tab.key === "documents"
              ? `${count}/${ESTATE_DOCUMENT_TYPES.length}`
              : tab.key === "beneficiaries"
                ? `${count}/${assets.length}`
                : count;

            return (
              <button
                key={tab.key}
                type="button"
                aria-current={activeTab === tab.key ? "page" : undefined}
                onClick={() => selectEstateTab(tab.key)}
                data-testid={`tab-estate-${tab.key}`}
                className={`flex items-center gap-2 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap py-3 ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {countLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      {/* ── Section A: Beneficiary Designations ── */}
      {activeTab === "beneficiaries" && <>
        <Card className="mb-4 overflow-hidden border-border/70 bg-muted/15 shadow-none">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Estate readiness
                  </p>
                  <h2 className="mt-0.5 text-base font-medium text-foreground">
                    Beneficiary coverage
                  </h2>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-primary sm:text-3xl">
                  {beneficiaryValueCoverage}%
                </span>
                <span className="text-xs font-medium text-muted-foreground">covered</span>
              </div>
            </div>
            <div className="mt-3">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Beneficiary coverage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={beneficiaryValueCoverage}
              >
                <div
                  className="h-full rounded-full bg-primary/75 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, beneficiaryValueCoverage))}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(assignedBeneficiaryValue)}
                </span>
                {" "}of{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatCurrency(totalAssetValue)}
                </span>
                {" "}in total assets have a named beneficiary
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">Beneficiary Designations</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {beneficiaryView === "account"
                    ? "Mark which assets have a named beneficiary on file"
                    : "See each beneficiary’s share of your assets and what remains unassigned"}
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-lg border bg-muted/50 p-1" role="group" aria-label="Beneficiary view">
              {(["account", "beneficiary"] as const).map(view => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={beneficiaryView === view}
                  onClick={() => setBeneficiaryView(view)}
                  data-testid={`button-${view}-view`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    beneficiaryView === view
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {view === "account" ? "Account view" : "Beneficiary view"}
                </button>
              ))}
            </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
          {peopleError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              Could not load your beneficiary list. <button type="button" className="underline" onClick={() => reloadPeople()}>Retry</button>
            </p>
          )}
          {beneficiaryView === "beneficiary" ? (
            <BeneficiaryAllocationView summary={allocationSummary} onEdit={peopleLoading || peopleError ? undefined : (id) => {
              const person = beneficiaryPeople.find(item => item.id === id);
              if (!person) return;
              setEditingBeneficiary(person);
              setNewBeneficiaryTarget(null);
              setNewBeneficiaryName(person.name);
              setNewBeneficiaryOpen(true);
            }} />
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assets found. Add assets first to track beneficiary designations.</p>
          ) : (
            <div>
              {parentAssetGroups.map(([parentCategory, categoryGroups]) => {
                const accountCount = categoryGroups.reduce((sum, group) => sum + group.entries.length, 0);
                return (
                  <section key={parentCategory} className="border-b last:border-b-0">
                    <div className="flex items-center gap-3 border-b-2 border-primary/25 bg-muted/75 px-5 py-3 dark:bg-muted/55">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Layers3 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">{parentCategory}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryGroups.length} {categoryGroups.length === 1 ? "category" : "categories"} · {accountCount} {accountCount === 1 ? "account" : "accounts"}
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[800px] text-sm" data-testid={`table-beneficiaries-${parentCategory}`}>
                        <thead className="border-b bg-muted/50">
                          <tr className="text-left">
                            <th scope="col" className="px-5 py-3 font-medium">Category</th>
                            <th scope="col" className="px-5 py-3 font-medium">Account</th>
                            <th scope="col" className="px-5 py-3 font-medium">Account Value</th>
                            <th scope="col" className="px-5 py-3 font-medium">Beneficiary</th>
                            <th scope="col" className="px-5 py-3 font-medium">Status</th>
                            <th scope="col" className="px-5 py-3 text-center font-medium">Assign</th>
                            <th scope="col" className="w-12 px-3 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {categoryGroups.flatMap(({ category, entries: categoryAssets }) =>
                            categoryAssets.map((asset) => {
                              const ben = beneficiaryMap.get(asset.id);
                              const hasBen = ben?.hasBeneficiary ?? false;
                              const hasStoredBeneficiaryData = hasBen ||
                                Boolean(ben?.beneficiaryName) ||
                                Boolean(ben?.beneficiaries?.length);
                              const isExpanded = expandedAsset === asset.id;
                              const localEdit = benEdits[asset.id];
                              const isRemovingAll = !(localEdit || []).length && hasStoredBeneficiaryData;

                              return (
                                <Fragment key={asset.id}>
                                  <tr className="hover:bg-muted/30" data-testid={`beneficiary-row-${asset.id}`}>
                                    <td className="px-5 py-3 text-muted-foreground">{categoryLabel(categories, category)}</td>
                                    <td className="px-5 py-3">
                                      <p className="font-medium">{asset.name}</p>
                                      {asset.institution && (
                                        <p className="text-xs text-muted-foreground">{asset.institution}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        Last updated: {formatBeneficiaryUpdatedAt(ben?.lastUpdatedAt)}
                                      </p>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 font-medium tabular-nums">
                                      {formatCurrency(asset.value)}
                                    </td>
                                    <td className="max-w-56 px-5 py-3 text-muted-foreground">
                                      <span className="block truncate">
                                        {hasBen
                                          ? ben?.beneficiaries?.length
                                            ? ben.beneficiaries.map((beneficiary) => beneficiary.beneficiaryName).join(", ")
                                            : "Details needed"
                                          : "—"}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <Badge variant={hasBen ? "default" : "secondary"} className="text-xs">
                                        {hasBen ? "Assigned" : "Not assigned"}
                                      </Badge>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                      <Switch
                                        data-testid={`switch-beneficiary-${asset.id}`}
                                        checked={hasBen}
                                        onCheckedChange={(checked) => {
                                          if (!checked) {
                                            toggleBeneficiaryMutation.mutate({ assetId: asset.id, hasBeneficiary: false });
                                            return;
                                          }
                                          const existing = ben?.beneficiaries || [];
                                          const total = existing.reduce((sum, beneficiary) => sum + Number(beneficiary.allocationPercentage), 0);
                                          if (existing.length > 0 && Math.abs(total - 100) < 0.001) {
                                            toggleBeneficiaryMutation.mutate({
                                              assetId: asset.id,
                                              hasBeneficiary: true,
                                              beneficiaries: existing.map((beneficiary) => ({
                                                name: beneficiary.beneficiaryName,
                                                percentage: Number(beneficiary.allocationPercentage),
                                                notes: beneficiary.notes,
                                              })),
                                            });
                                          } else {
                                            openExpand(asset.id, ben);
                                            toast({ title: "Add beneficiary details first", description: "Enter names and allocations totaling 100%, then save." });
                                          }
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          if (isExpanded) {
                                            setExpandedAsset(null);
                                          } else {
                                            openExpand(asset.id, ben);
                                          }
                                        }}
                                        data-testid={`button-expand-beneficiary-${asset.id}`}
                                      >
                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      </Button>
                                    </td>
                                  </tr>

                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="bg-muted/20 p-0">
                                        <div className="border-t px-5 py-3">
                                          <div className="rounded-lg bg-muted/30 p-3 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                              <div>
                                                <Label className="text-xs">Beneficiaries</Label>
                                                <p className="text-[11px] text-muted-foreground">Choose each beneficiary and their share of this asset.</p>
                                              </div>
                                              <span className={`text-xs font-medium ${
                                                (localEdit || []).reduce((sum, draft) => sum + (Number(draft.percentage) || 0), 0) === 100
                                                  ? "text-emerald-600"
                                                  : "text-amber-600"
                                              }`}>
                                                Allocation: {(localEdit || []).reduce((sum, draft) => sum + (Number(draft.percentage) || 0), 0).toFixed(2)}%
                                              </span>
                                            </div>
                                            <div className="space-y-3">
                                              {(localEdit || []).map((draft, index) => (
                                                <div key={index} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_7rem_auto] gap-2 items-end">
                                                  <div className="space-y-1">
                                                    <Label className="text-[11px]">Beneficiary</Label>
                                                    <Select
                                                      value={String(draft.beneficiaryId ?? beneficiaryPeople.find(person => person.normalizedName === draft.name.trim().replace(/\s+/g, " ").toLowerCase())?.id ?? "")}
                                                      disabled={peopleLoading || peopleError}
                                                      onValueChange={(value) => {
                                                        if (value === "add-new") return openNewBeneficiary({ assetId: asset.id, index });
                                                        const person = beneficiaryPeople.find(item => item.id === Number(value));
                                                        if (!person) return;
                                                        setBenEdits(prev => ({
                                                          ...prev,
                                                          [asset.id]: (prev[asset.id] || []).map((item, i) => i === index ? { ...item, name: person.name, beneficiaryId: person.id } : item),
                                                        }));
                                                      }}
                                                    >
                                                      <SelectTrigger className="h-8 text-sm" aria-label="Select beneficiary" data-testid={`select-beneficiary-${asset.id}-${index}`}>
                                                        <SelectValue placeholder={peopleLoading ? "Loading…" : "Select beneficiary"} />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {beneficiaryPeople.map(person => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}
                                                        <SelectItem value="add-new" className="border-t font-medium text-primary">+ Add new beneficiary</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="space-y-1">
                                                    <Label className="text-[11px]">Allocation (%)</Label>
                                                    <Input
                                                      data-testid={`input-beneficiary-percentage-${asset.id}-${index}`}
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="1"
                                                      value={draft.percentage}
                                                      onChange={(e) => updateBeneficiaryDraft(asset.id, index, "percentage", e.target.value)}
                                                      className="h-8 text-sm"
                                                    />
                                                  </div>
                                                  <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => setBenEdits((prev) => ({
                                                      ...prev,
                                                      [asset.id]: (prev[asset.id] || []).filter((_, draftIndex) => draftIndex !== index),
                                                    }))}
                                                    aria-label={`Remove beneficiary ${index + 1}`}
                                                    data-testid={`button-remove-beneficiary-${asset.id}-${index}`}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </Button>
                                                  <div className="space-y-1 sm:col-span-3">
                                                    <Label className="text-[11px]">Notes (optional)</Label>
                                                    <Input
                                                      data-testid={`input-beneficiary-notes-${asset.id}${index ? `-${index}` : ""}`}
                                                      value={draft.notes}
                                                      onChange={(e) => updateBeneficiaryDraft(asset.id, index, "notes", e.target.value)}
                                                      placeholder="e.g., Spouse"
                                                      className="h-8 text-sm"
                                                    />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                            {(localEdit || []).length > 0 &&
                                              ((localEdit || []).some((draft) => !draft.name.trim() || !Number.isFinite(Number(draft.percentage)) || Number(draft.percentage) <= 0 || Number(draft.percentage) > 100) ||
                                                Math.abs((localEdit || []).reduce((sum, draft) => sum + (Number(draft.percentage) || 0), 0) - 100) > 0.001) && (
                                              <p className="text-xs text-amber-600">
                                                Enter a name and valid allocation for every row. Allocations must total exactly 100%.
                                              </p>
                                            )}
                                            {isRemovingAll && (
                                              <p className="text-xs text-muted-foreground">
                                                Saving now will remove all beneficiaries and mark this asset as unassigned.
                                              </p>
                                            )}
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setBenEdits((prev) => ({
                                                ...prev,
                                                [asset.id]: [...(prev[asset.id] || []), { name: "", percentage: "0", notes: "" }],
                                              }))}
                                              data-testid={`button-add-beneficiary-${asset.id}`}
                                            >
                                              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Beneficiary
                                            </Button>
                                          </div>
                                          <div className="flex justify-end mt-2">
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                saveBenDetailsMutation.mutate({
                                                  assetId: asset.id,
                                                  hasBeneficiary: isRemovingAll ? false : true,
                                                  beneficiaries: isRemovingAll ? [] : draftsToPayload(localEdit || []),
                                                })
                                              }
                                              disabled={
                                                saveBenDetailsMutation.isPending ||
                                                (!(localEdit || []).length && !hasStoredBeneficiaryData) ||
                                                ((localEdit || []).length > 0 && (
                                                  (localEdit || []).some((draft) =>
                                                    !draft.name.trim() ||
                                                    !Number.isFinite(Number(draft.percentage)) ||
                                                    Number(draft.percentage) <= 0 ||
                                                    Number(draft.percentage) > 100
                                                  ) ||
                                                  Math.abs((localEdit || []).reduce((sum, draft) => sum + (Number(draft.percentage) || 0), 0) - 100) > 0.001
                                                ))
                                              }
                                              data-testid={`button-save-beneficiary-${asset.id}`}
                                            >
                                              {isRemovingAll
                                                ? <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                                : <Save className="h-3.5 w-3.5 mr-1.5" />
                                              }
                                              {saveBenDetailsMutation.isPending
                                                ? "Saving..."
                                                : isRemovingAll
                                                  ? "Remove All & Unassign"
                                                  : "Save & Assign"}
                                            </Button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            }),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
        {beneficiaryView === "beneficiary" && (
          <div className="flex justify-end px-6 pb-6">
            <Button size="sm" variant="outline" onClick={() => openNewBeneficiary()} data-testid="button-add-beneficiary">
              <Plus className="mr-1.5 h-4 w-4" /> Add beneficiary
            </Button>
          </div>
        )}
        </Card>
      </>}

      {/* ── Section B: Estate Planning Documents ── */}
      {activeTab === "documents" && <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <ScrollText className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base">Key Estate Planning Documents</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check off documents you have in place — {docsComplete} of {ESTATE_DOCUMENT_TYPES.length} complete
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1">
            {ESTATE_DOCUMENT_TYPES.map((doc) => {
              const record = documentMap.get(doc.key);
              const isComplete = record?.isComplete ?? false;
              const guidance = ESTATE_DOCUMENT_GUIDANCE[doc.key];
              const isExpanded = expandedDocuments[doc.key] ?? false;

              return (
                <div
                  key={doc.key}
                  className="rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 px-2">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-3 py-3 text-left"
                      data-testid={`doc-row-${doc.key}`}
                      onClick={() =>
                        toggleDocumentMutation.mutate({
                          documentType: doc.key,
                          isComplete: !isComplete,
                          notes: record?.notes ?? null,
                        })
                      }
                    >
                      {isComplete
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      }
                      <span className={`text-sm flex-1 ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                        {doc.label}
                      </span>
                      {isComplete && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 shrink-0">
                          Done
                        </Badge>
                      )}
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={isExpanded}
                      aria-controls={`document-guidance-${doc.key}`}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} guidance for ${doc.label}`}
                      data-testid={`button-expand-document-${doc.key}`}
                      onClick={() =>
                        setExpandedDocuments((current) => ({
                          ...current,
                          [doc.key]: !isExpanded,
                        }))
                      }
                    >
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                  </div>
                  {isExpanded && (
                    <div
                      id={`document-guidance-${doc.key}`}
                      className="ml-10 mr-10 mb-3 rounded-md border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5 text-xs leading-relaxed dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    >
                      <p>
                        <span className="font-semibold text-foreground">Purpose: </span>
                        <span className="text-muted-foreground">{guidance.purpose}</span>
                      </p>
                      <p className="mt-1.5">
                        <span className="font-semibold text-foreground">When to use: </span>
                        <span className="text-muted-foreground">{guidance.whenToUse}</span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 px-2">
            Click the check icon or document name to toggle its status. Expand an item to learn more. Consult a licensed estate attorney for personalized guidance.
          </p>
          </CardContent>
        </Card>}

      {/* ── Section C: Key Contacts ── */}
      {activeTab === "contacts" && <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-violet-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-base">Key Estate Contacts</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Attorneys, executors, advisors, and other key people</p>
              </div>
            </div>
            <Button size="sm" onClick={() => { setEditingContact(undefined); setContactDialogOpen(true); }} data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-1.5" /> Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {contacts.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">No contacts yet</p>
              <p className="text-xs text-muted-foreground mb-4">Add your estate attorney, executor, financial advisor, and other key people.</p>
              <Button size="sm" onClick={() => { setEditingContact(undefined); setContactDialogOpen(true); }} data-testid="button-add-first-contact">
                <Plus className="h-4 w-4 mr-1.5" /> Add Your First Contact
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {contacts.map((contact) => (
                <Card key={contact.id} className="bg-muted/30 border" data-testid={`card-contact-${contact.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{contact.name}</p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5">{roleLabel(contact.role)}</Badge>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditingContact(contact); setContactDialogOpen(true); }}
                          data-testid={`button-edit-contact-${contact.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => deleteContactMutation.mutate(contact.id)}
                          data-testid={`button-delete-contact-${contact.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      {contact.firm && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{contact.firm}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" /><span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">{contact.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}

      <Dialog open={newBeneficiaryOpen} onOpenChange={(open) => { if (!beneficiaryDialogPending) setNewBeneficiaryOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBeneficiary ? "Edit beneficiary" : "Add beneficiary"}</DialogTitle>
            <DialogDescription>
              {editingBeneficiary ? "Updates this name on all assigned accounts. Allocation percentages stay the same." : "Save a name once to reuse across accounts."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!newBeneficiaryName.trim() || beneficiaryDialogPending) return;
            if (editingBeneficiary) updateBeneficiaryMutation.mutate({ id: editingBeneficiary.id, name: newBeneficiaryName });
            else addBeneficiaryMutation.mutate(newBeneficiaryName);
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-beneficiary-name">Name</Label>
              <Input id="new-beneficiary-name" value={newBeneficiaryName} onChange={event => setNewBeneficiaryName(event.target.value)} maxLength={200} autoFocus required disabled={beneficiaryDialogPending} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewBeneficiaryOpen(false)} disabled={beneficiaryDialogPending}>Cancel</Button>
              <Button type="submit" disabled={!newBeneficiaryName.trim() || beneficiaryDialogPending}>{beneficiaryDialogPending ? "Saving…" : editingBeneficiary ? "Save changes" : "Add beneficiary"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Estate Contact"}</DialogTitle>
          </DialogHeader>
          <ContactForm contact={editingContact} onClose={() => setContactDialogOpen(false)} />
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
