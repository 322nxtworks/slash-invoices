"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  Loader2,
  PencilLine,
  RefreshCcw,
  Send,
} from "lucide-react";
import {
  DEFAULT_INVOICE_TIME_ZONE,
  formatDateForInput,
  formatDateTime,
  humanizeKey,
} from "@/lib/utils";

interface TemplateListItem {
  template_id: string;
  title: string;
}

interface TemplateDetails {
  template_id: string;
  title: string;
  placeholder_fields?: string[];
  signer_field_ids?: string[];
}

interface Contact {
  id: string;
  name: string;
  recipientLegalName: string;
  recipientEmail: string;
}

interface ContractItem {
  id: string;
  externalId: string;
  templateId: string;
  templateTitle?: string | null;
  title: string;
  status: string;
  isDraft: boolean;
  signerName?: string | null;
  signerEmail?: string | null;
  signerMobile?: string | null;
  signerCompanyName?: string | null;
  signPageUrl?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  createdByUser?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
}

function statusBadge(status: string, isDraft: boolean) {
  if (isDraft || status === "draft") {
    return <Badge variant="muted">Draft</Badge>;
  }

  const normalized = status.toLowerCase();
  if (normalized === "signed") {
    return <Badge variant="success">Signed</Badge>;
  }
  if (normalized === "withdrawn") {
    return <Badge variant="danger">Withdrawn</Badge>;
  }
  if (normalized === "sent") {
    return <Badge variant="warning">Sent</Badge>;
  }

  return <Badge variant="outline">{status}</Badge>;
}

function getDashboardContractPath(contractId: string) {
  return `/contracts/${contractId}`;
}

function inferPlaceholderValue(key: string, contact?: Contact | null) {
  if (!contact) return "";

  const normalized = key.toLowerCase();
  if (normalized.includes("legal") && normalized.includes("name")) {
    return contact.recipientLegalName || contact.name;
  }
  if (normalized.includes("contact person")) {
    return contact.name;
  }
  if (normalized.includes("email")) {
    return contact.recipientEmail;
  }
  if (
    normalized.includes("client") &&
    normalized.includes("name")
  ) {
    return contact.recipientLegalName || contact.name;
  }
  if (normalized.includes("company")) {
    return contact.recipientLegalName || contact.name;
  }

  return "";
}

function isDatePlaceholderKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("date");
}

function getDefaultPlaceholderValue(key: string) {
  if (isDatePlaceholderKey(key)) {
    return formatDateForInput(new Date(), DEFAULT_INVOICE_TIME_ZONE);
  }

  return "";
}

export default function ContractsPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [templateDetails, setTemplateDetails] = useState<TemplateDetails | null>(
    null
  );
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>(
    {}
  );
  const [signerFieldDefaults, setSignerFieldDefaults] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    metadata: "",
    signerName: "",
    signerEmail: "",
    signerMobile: "",
    signerCompanyName: "",
    saveAsDraft: true,
  });

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load contracts");
      }

      const data = await res.json();
      setContracts(data.items || []);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load contracts");
    }
  }, []);

  const fetchTemplateDetails = useCallback(async (templateId: string) => {
    if (!templateId) {
      setTemplateDetails(null);
      setPlaceholderValues({});
      setSignerFieldDefaults({});
      return;
    }

    setLoadingTemplate(true);
    try {
      const res = await fetch(`/api/contracts/templates/${templateId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load template");
      }

      const data = await res.json();
      const item = data.item as TemplateDetails;
      setTemplateDetails(item);
      setPlaceholderValues((current) =>
        Object.fromEntries(
          (item.placeholder_fields || []).map((key) => [
            key,
            current[key] || getDefaultPlaceholderValue(key),
          ])
        )
      );
      setSignerFieldDefaults((current) =>
        Object.fromEntries(
          (item.signer_field_ids || []).map((key) => [key, current[key] || ""])
        )
      );
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load template");
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [templatesRes, contractsRes, contactsRes] = await Promise.all([
          fetch("/api/contracts/templates"),
          fetch("/api/contracts"),
          fetch("/api/contacts"),
        ]);

        if (!templatesRes.ok) {
          const data = await templatesRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load eSignatures templates");
        }
        if (!contractsRes.ok) {
          const data = await contractsRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load contracts");
        }
        if (!contactsRes.ok) {
          const data = await contactsRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load contacts");
        }

        const [templatesData, contractsData, contactsData] = await Promise.all([
          templatesRes.json(),
          contractsRes.json(),
          contactsRes.json(),
        ]);

        if (!active) return;

        const nextTemplates = (templatesData.items || []) as TemplateListItem[];
        setTemplates(nextTemplates);
        setContracts(contractsData.items || []);
        setContacts(contactsData.items || []);

        const nextTemplateId =
          templatesData.defaultTemplateId ||
          nextTemplates[0]?.template_id ||
          "";
        setSelectedTemplateId(nextTemplateId);
      } catch (error: unknown) {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Failed to load data");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchTemplateDetails(selectedTemplateId);
    }
  }, [fetchTemplateDetails, selectedTemplateId]);

  useEffect(() => {
    if (!selectedContact) return;

    setForm((current) => ({
      ...current,
      signerName: current.signerName || selectedContact.name,
      signerEmail: current.signerEmail || selectedContact.recipientEmail,
      signerCompanyName:
        current.signerCompanyName ||
        selectedContact.recipientLegalName ||
        selectedContact.name,
    }));

    if (templateDetails?.placeholder_fields?.length) {
      setPlaceholderValues((current) => {
        const next = { ...current };

        for (const key of templateDetails.placeholder_fields || []) {
          if (!next[key]) {
            const inferred = inferPlaceholderValue(key, selectedContact);
            if (inferred) {
              next[key] = inferred;
            }
          }
        }

        return next;
      });
    }
  }, [selectedContact, templateDetails]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          title: form.title,
          metadata: form.metadata,
          signerName: form.signerName,
          signerEmail: form.signerEmail,
          signerMobile: form.signerMobile,
          signerCompanyName: form.signerCompanyName,
          saveAsDraft: form.saveAsDraft,
          placeholderValues,
          signerFieldDefaults,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create contract");
      }

      const item = data.item as ContractItem;
      setContracts((current) => [item, ...current]);
      setSuccess(
        form.saveAsDraft
          ? "Draft contract created. Open it in eSignatures to review and send."
          : "Contract created and sent successfully."
      );
      setForm((current) => ({
        ...current,
        title: "",
        metadata: "",
        signerMobile: "",
      }));
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to create contract");
    } finally {
      setCreating(false);
    }
  }

  async function openTemplateEditor() {
    if (!selectedTemplateId) return;

    setOpeningEditor(true);
    setError("");

    try {
      const res = await fetch(
        `/api/contracts/templates/${selectedTemplateId}/editor`,
        {
          method: "POST",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to open the template editor");
      }

      window.open(data.editorUrl, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Failed to open the template editor"
      );
    } finally {
      setOpeningEditor(false);
    }
  }

  async function refreshContract(id: string) {
    setRefreshingId(id);
    setError("");

    try {
      const res = await fetch(`/api/contracts/${id}/refresh`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh the contract");
      }

      const item = data.item as ContractItem;
      setContracts((current) =>
        current.map((contract) => (contract.id === id ? item : contract))
      );
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Failed to refresh the contract"
      );
    } finally {
      setRefreshingId(null);
    }
  }

  async function copyContractLink(contractId: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(getDashboardContractPath(contractId), window.location.origin).toString()
      );
      setCopiedContractId(contractId);
      window.setTimeout(() => {
        setCopiedContractId((current) => (current === contractId ? null : current));
      }, 2000);
    } catch {
      setError("Could not copy the contract link");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-outline-stitch" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-page-enter">
      <div className="flex items-center gap-3">
        <FileSignature className="h-6 w-6 text-primary-stitch" />
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Contracts</h1>
          <p className="text-sm text-outline-stitch">
            Use your shared eSignatures template to draft and send internal team
            contracts.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-container/30 bg-error-container/20 px-4 py-3 text-sm text-error-stitch animate-panel-enter">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 animate-panel-enter">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white">Create Contract</h2>
              <p className="text-sm text-outline-stitch">
                Fill the signer details and the placeholder fields from your
                shared template.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={openTemplateEditor}
              disabled={!selectedTemplateId || openingEditor}
              className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
            >
              {openingEditor ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PencilLine className="mr-2 h-4 w-4" />
              )}
              Edit Template
            </Button>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-outline-variant/50 bg-background px-4 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                >
                  {templates.length === 0 && (
                    <option value="">No templates available</option>
                  )}
                  {templates.map((template) => (
                    <option key={template.template_id} value={template.template_id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Prefill From Contact</Label>
                <select
                  id="contact"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="flex h-11 w-full rounded-xl border border-outline-variant/50 bg-background px-4 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                >
                  <option value="">Choose a contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contract-title">Contract Title</Label>
                <Input
                  id="contract-title"
                  placeholder="Optional custom title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata</Label>
                <Input
                  id="metadata"
                  placeholder="Optional internal reference"
                  value={form.metadata}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, metadata: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signer-name">Signer Name</Label>
                <Input
                  id="signer-name"
                  value={form.signerName}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      signerName: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signer-email">Signer Email</Label>
                <Input
                  id="signer-email"
                  type="email"
                  value={form.signerEmail}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      signerEmail: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signer-mobile">Signer Mobile</Label>
                <Input
                  id="signer-mobile"
                  placeholder="+61..."
                  value={form.signerMobile}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      signerMobile: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signer-company">Signer Company</Label>
                <Input
                  id="signer-company"
                  value={form.signerCompanyName}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      signerCompanyName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 smooth-transition">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-white">Template Placeholder Fields</h3>
                  <p className="text-sm text-outline-stitch">
                    These are pulled live from the selected eSignatures template.
                  </p>
                </div>
                {loadingTemplate && (
                  <Loader2 className="h-4 w-4 animate-spin text-outline-stitch" />
                )}
              </div>

              {templateDetails?.placeholder_fields?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {templateDetails.placeholder_fields.map((key) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`placeholder-${key}`}>{humanizeKey(key)}</Label>
                      <Input
                        id={`placeholder-${key}`}
                        type={isDatePlaceholderKey(key) ? "date" : "text"}
                        value={placeholderValues[key] || ""}
                        onChange={(e) =>
                          setPlaceholderValues((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={
                          isDatePlaceholderKey(key)
                            ? undefined
                            : `Enter ${humanizeKey(key).toLowerCase()}`
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-outline-stitch">
                  This template does not expose placeholder fields.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 smooth-transition">
              <h3 className="font-medium text-white">Signer Field Defaults</h3>
              <p className="mb-3 text-sm text-outline-stitch">
                Pre-fill any signer fields you added to the template editor.
              </p>

              {templateDetails?.signer_field_ids?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {templateDetails.signer_field_ids.map((key) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`signer-field-${key}`}>{humanizeKey(key)}</Label>
                      <Input
                        id={`signer-field-${key}`}
                        value={signerFieldDefaults[key] || ""}
                        onChange={(e) =>
                          setSignerFieldDefaults((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={`Default for ${humanizeKey(key).toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-outline-stitch">
                  No signer field IDs were returned for this template yet.
                </p>
              )}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface smooth-transition">
              <input
                type="checkbox"
                checked={form.saveAsDraft}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    saveAsDraft: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-outline-variant/50 bg-background"
              />
              <span>
                Save as draft first instead of sending immediately
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={creating || !selectedTemplateId}
                className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-xl shadow-[0_4px_14px_0_rgba(173,198,255,0.15)]"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : form.saveAsDraft ? (
                  <FileSignature className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {form.saveAsDraft ? "Create Draft" : "Create and Send"}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
            <h2 className="font-semibold text-white">Selected Template</h2>
            <p className="mt-1 text-sm text-outline-stitch">
              {templateDetails?.title || "No template selected"}
            </p>
            <div className="mt-4 space-y-3 text-sm text-outline-stitch">
              <div className="flex items-center justify-between gap-4">
                <span>Placeholder fields</span>
                <span>{templateDetails?.placeholder_fields?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Signer defaults</span>
                <span>{templateDetails?.signer_field_ids?.length || 0}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={openTemplateEditor}
                disabled={!selectedTemplateId || openingEditor}
                className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              >
                <PencilLine className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (selectedTemplateId) {
                    fetchTemplateDetails(selectedTemplateId);
                  }
                }}
                disabled={!selectedTemplateId || loadingTemplate}
                className="text-outline-stitch hover:text-on-surface hover:bg-surface-container-high"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh Fields
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
            <h2 className="font-semibold text-white">Safety Defaults</h2>
            <ul className="mt-3 space-y-2 text-sm text-outline-stitch">
              <li>Live contracts only. Demo mode stays off.</li>
              <li>Draft-first is enabled by default for safer review.</li>
              <li>Contract status sync can be refreshed manually or by webhook.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between border-b border-outline-variant/40 px-6 py-4">
          <div>
            <h2 className="font-semibold text-white">Contract History</h2>
            <p className="text-sm text-outline-stitch">
              Shared across the team so everyone sees the same contracts.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void fetchContracts()}
            className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh List
          </Button>
        </div>

        {contracts.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-white">No contracts yet</p>
            <p className="mt-1 text-sm text-outline-stitch">
              Create the first contract from your shared template above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto app-scrollbar px-3 pb-3">
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr>
                  <th className="rounded-l-xl bg-surface-container-high/70 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-outline-stitch">
                    Contract
                  </th>
                  <th className="bg-surface-container-high/70 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-outline-stitch">
                    Signer
                  </th>
                  <th className="bg-surface-container-high/70 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-outline-stitch">
                    Status
                  </th>
                  <th className="bg-surface-container-high/70 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-outline-stitch">
                    Created
                  </th>
                  <th className="rounded-r-xl bg-surface-container-high/70 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-outline-stitch">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="bg-surface-container-low/50 hover:bg-surface-container-high/45 smooth-transition shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                  >
                    <td className="rounded-l-xl px-4 py-4 align-top text-sm">
                      <div className="font-medium text-on-surface">{contract.title}</div>
                      <div className="mt-1 text-outline-stitch">
                        {contract.templateTitle || contract.templateId}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <div className="text-on-surface">{contract.signerName || "—"}</div>
                      <div className="mt-1 text-outline-stitch">
                        {contract.signerEmail || contract.signerMobile || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      {statusBadge(contract.status, contract.isDraft)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-outline-stitch">
                      <div>{formatDateTime(contract.createdAt)}</div>
                      <div className="mt-1">
                        {contract.createdByUser?.name || contract.createdByUser?.email}
                      </div>
                    </td>
                    <td className="rounded-r-xl px-4 py-4 align-top text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                          asChild
                        >
                          <Link href={getDashboardContractPath(contract.id)}>
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyContractLink(contract.id)}
                          className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                        >
                          {copiedContractId === contract.id ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          Copy Link
                        </Button>
                        {contract.signPageUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                            asChild
                          >
                            <a
                              href={contract.signPageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open Sign Page
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshContract(contract.id)}
                          disabled={refreshingId === contract.id}
                          className="text-outline-stitch hover:text-on-surface hover:bg-surface-container-high"
                        >
                          {refreshingId === contract.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                          )}
                          Refresh
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
