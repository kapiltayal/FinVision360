import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ScrollText, Users, UserCheck, Plus, Pencil, Trash2,
  CheckCircle2, Circle, Wallet, Phone, Mail, Building2,
  ChevronDown, ChevronRight, Save,
} from "lucide-react";
import {
  type Asset, type EstateBeneficiary, type EstateDocument, type EstateContact,
  ASSET_CATEGORIES, ESTATE_DOCUMENT_TYPES, ESTATE_CONTACT_ROLES,
} from "@shared/schema";
import { getCategoryLabel } from "@/lib/format";

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
  const { toast } = useToast();
  const qc = useQueryClient();

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EstateContact | undefined>();
  const [expandedAsset, setExpandedAsset] = useState<number | null>(null);
  // Local edits for beneficiary name/notes — only committed when user clicks Save
  const [benEdits, setBenEdits] = useState<Record<number, { name: string; notes: string }>>({});

  const { data: assets = [], isLoading: aLoading } = useQuery<Asset[]>({ queryKey: ["/api/assets"] });
  const { data: beneficiaries = [], isLoading: bLoading } = useQuery<EstateBeneficiary[]>({ queryKey: ["/api/estate/beneficiaries"] });
  const { data: documents = [], isLoading: dLoading } = useQuery<EstateDocument[]>({ queryKey: ["/api/estate/documents"] });
  const { data: contacts = [], isLoading: cLoading } = useQuery<EstateContact[]>({ queryKey: ["/api/estate/contacts"] });

  const isLoading = aLoading || bLoading || dLoading || cLoading;

  const beneficiaryMap = new Map(beneficiaries.map((b) => [b.assetId, b]));
  const documentMap = new Map(documents.map((d) => [d.documentType, d]));

  const docsComplete = ESTATE_DOCUMENT_TYPES.filter((d) => documentMap.get(d.key)?.isComplete).length;
  const assetsWithBeneficiary = beneficiaries.filter((b) => b.hasBeneficiary).length;

  // ── Beneficiary toggle (hasBeneficiary on/off) — optimistic ───────────────
  const toggleBeneficiaryMutation = useMutation({
    mutationFn: (data: { assetId: number; hasBeneficiary: boolean; beneficiaryName?: string | null; notes?: string | null }) =>
      apiRequest("PUT", "/api/estate/beneficiaries", data),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["/api/estate/beneficiaries"] });
      const prev = qc.getQueryData<EstateBeneficiary[]>(["/api/estate/beneficiaries"]);
      qc.setQueryData<EstateBeneficiary[]>(["/api/estate/beneficiaries"], (old = []) => {
        const idx = old.findIndex((b) => b.assetId === vars.assetId);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], hasBeneficiary: vars.hasBeneficiary };
          return updated;
        }
        return [...old, { id: -1, userId: "", assetId: vars.assetId, hasBeneficiary: vars.hasBeneficiary, beneficiaryName: vars.beneficiaryName ?? null, notes: vars.notes ?? null }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/estate/beneficiaries"], ctx.prev);
      toast({ title: "Failed to save", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["/api/estate/beneficiaries"] }),
  });

  // ── Beneficiary name/notes save ───────────────────────────────────────────
  const saveBenDetailsMutation = useMutation({
    mutationFn: (data: { assetId: number; hasBeneficiary: boolean; beneficiaryName: string | null; notes: string | null }) =>
      apiRequest("PUT", "/api/estate/beneficiaries", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/estate/beneficiaries"] });
      toast({ title: "Beneficiary details saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
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

  const openExpand = (assetId: number, ben: EstateBeneficiary | undefined) => {
    setExpandedAsset(assetId);
    setBenEdits((prev) => ({
      ...prev,
      [assetId]: { name: ben?.beneficiaryName || "", notes: ben?.notes || "" },
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header-gradient">
        <h1 className="text-2xl font-bold" data-testid="text-estate-title">Estate &amp; Legacy Planning</h1>
        <p className="text-muted-foreground">Track key steps to protect and pass on your assets</p>
        <div className="flex flex-wrap gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground">Documents: <span className="font-semibold text-foreground">{docsComplete}/{ESTATE_DOCUMENT_TYPES.length}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <UserCheck className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">Beneficiaries assigned: <span className="font-semibold text-foreground">{assetsWithBeneficiary}/{assets.length}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4 text-violet-500" />
            <span className="text-muted-foreground">Contacts: <span className="font-semibold text-foreground">{contacts.length}</span></span>
          </div>
        </div>
      </div>

      {/* ── Section A: Beneficiary Designations ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Beneficiary Designations</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Mark which assets have a named beneficiary on file</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assets found. Add assets first to track beneficiary designations.</p>
          ) : (
            <div className="divide-y">
              {assets.map((asset) => {
                const ben = beneficiaryMap.get(asset.id);
                const hasBen = ben?.hasBeneficiary ?? false;
                const isExpanded = expandedAsset === asset.id;
                const localEdit = benEdits[asset.id];

                return (
                  <div key={asset.id} data-testid={`beneficiary-row-${asset.id}`}>
                    {/* Row */}
                    <div className="flex items-center justify-between py-3 px-1 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Wallet className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{getCategoryLabel(ASSET_CATEGORIES, asset.category)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {hasBen && ben?.beneficiaryName && (
                          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[120px]">{ben.beneficiaryName}</span>
                        )}
                        <Badge variant={hasBen ? "default" : "secondary"} className="text-xs">
                          {hasBen ? "Assigned" : "Not assigned"}
                        </Badge>
                        <Switch
                          data-testid={`switch-beneficiary-${asset.id}`}
                          checked={hasBen}
                          onCheckedChange={(checked) => {
                            toggleBeneficiaryMutation.mutate({
                              assetId: asset.id,
                              hasBeneficiary: checked,
                              beneficiaryName: ben?.beneficiaryName ?? null,
                              notes: ben?.notes ?? null,
                            });
                            if (checked && !isExpanded) openExpand(asset.id, ben);
                          }}
                        />
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
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="pb-3 px-1 mb-2">
                        <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Beneficiary Name</Label>
                            <Input
                              data-testid={`input-beneficiary-name-${asset.id}`}
                              value={localEdit?.name ?? ""}
                              onChange={(e) =>
                                setBenEdits((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], name: e.target.value } }))
                              }
                              placeholder="e.g., John Doe"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              data-testid={`input-beneficiary-notes-${asset.id}`}
                              value={localEdit?.notes ?? ""}
                              onChange={(e) =>
                                setBenEdits((prev) => ({ ...prev, [asset.id]: { ...prev[asset.id], notes: e.target.value } }))
                              }
                              placeholder="e.g., 50% to each"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              saveBenDetailsMutation.mutate({
                                assetId: asset.id,
                                hasBeneficiary: hasBen,
                                beneficiaryName: localEdit?.name?.trim() || null,
                                notes: localEdit?.notes?.trim() || null,
                              })
                            }
                            disabled={saveBenDetailsMutation.isPending}
                            data-testid={`button-save-beneficiary-${asset.id}`}
                          >
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                            {saveBenDetailsMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section B: Estate Planning Documents ── */}
      <Card>
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

              return (
                <button
                  key={doc.key}
                  type="button"
                  className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left"
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
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 px-2">
            Click any item to toggle its status. Consult a licensed estate attorney for personalized guidance.
          </p>
        </CardContent>
      </Card>

      {/* ── Section C: Key Contacts ── */}
      <Card>
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
      </Card>

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
  );
}
