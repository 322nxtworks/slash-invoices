"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { formatDateTime, humanizeKey } from "@/lib/utils";

interface ContractItem {
  id: string;
  externalId: string;
  templateId: string;
  templateTitle?: string | null;
  title: string;
  status: string;
  isDraft: boolean;
  metadata?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signerMobile?: string | null;
  signerCompanyName?: string | null;
  signPageUrl?: string | null;
  pdfUrl?: string | null;
  placeholderValues?: Record<string, string> | null;
  signerFieldDefaults?: Record<string, string> | null;
  signerFieldValues?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
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

  switch (status.toLowerCase()) {
    case "signed":
      return <Badge variant="success">Signed</Badge>;
    case "sent":
      return <Badge variant="warning">Sent</Badge>;
    case "withdrawn":
      return <Badge variant="danger">Withdrawn</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getContractLink(contractId: string) {
  return new URL(`/contracts/${contractId}`, window.location.origin).toString();
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = typeof params?.id === "string" ? params.id : "";
  const [contract, setContract] = useState<ContractItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function loadContract() {
    if (!contractId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load contract");
      }

      setContract(data.item);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContract();
  }, [contractId]);

  const contractLink = useMemo(() => {
    if (!contractId || typeof window === "undefined") return "";
    return getContractLink(contractId);
  }, [contractId]);

  async function handleRefresh() {
    if (!contractId) return;

    setRefreshing(true);
    setError("");

    try {
      const res = await fetch(`/api/contracts/${contractId}/refresh`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh contract");
      }

      setContract(data.item);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to refresh contract");
    } finally {
      setRefreshing(false);
    }
  }

  async function copyLink() {
    if (!contractLink) return;

    try {
      await navigator.clipboard.writeText(contractLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the contract link");
    }
  }

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="text-outline-stitch hover:text-on-surface hover:bg-surface-container-high" asChild>
            <Link href="/contracts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contracts
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <FileSignature className="h-6 w-6 text-primary-stitch" />
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {contract?.title || "Contract"}
              </h1>
              <p className="text-sm text-outline-stitch">
                Shared contract record and signer links
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={copyLink}
            disabled={!contractLink}
            className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy Link
          </Button>
          {contract?.signPageUrl && (
            <Button
              variant="outline"
              className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              asChild
            >
              <a href={contract.signPageUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Sign Page
              </a>
            </Button>
          )}
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh Status
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error-container/30 bg-error-container/20 px-4 py-3 text-sm text-error-stitch animate-panel-enter">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-outline-stitch" />
        </div>
      ) : contract ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-sm text-outline-stitch">Status</p>
                  <div className="mt-2">{statusBadge(contract.status, contract.isDraft)}</div>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Template</p>
                  <p className="mt-2 font-medium text-on-surface">
                    {contract.templateTitle || contract.templateId}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Created</p>
                  <p className="mt-2 font-medium text-on-surface">{formatDateTime(contract.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Last Synced</p>
                  <p className="mt-2 font-medium text-on-surface">{formatDateTime(contract.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Created By</p>
                  <p className="mt-2 font-medium text-on-surface">
                    {contract.createdByUser?.name || contract.createdByUser?.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Metadata</p>
                  <p className="mt-2 font-medium text-on-surface">{contract.metadata || "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
              <h2 className="font-semibold text-white">Signer</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-outline-stitch">Name</p>
                  <p className="mt-1 font-medium text-on-surface">{contract.signerName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Email</p>
                  <p className="mt-1 font-medium text-on-surface">{contract.signerEmail || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Mobile</p>
                  <p className="mt-1 font-medium text-on-surface">{contract.signerMobile || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-outline-stitch">Company</p>
                  <p className="mt-1 font-medium text-on-surface">
                    {contract.signerCompanyName || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
              <h2 className="font-semibold text-white">Placeholder Values</h2>
              <div className="mt-4 space-y-3">
                {contract.placeholderValues &&
                Object.keys(contract.placeholderValues).length > 0 ? (
                  Object.entries(contract.placeholderValues).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                    >
                      <p className="text-xs uppercase tracking-wider text-outline-stitch">
                        {humanizeKey(key)}
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{value || "—"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-outline-stitch">
                    No placeholder values were stored for this contract.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
              <h2 className="font-semibold text-white">Signer Field Defaults</h2>
              <div className="mt-4 space-y-3">
                {contract.signerFieldDefaults &&
                Object.keys(contract.signerFieldDefaults).length > 0 ? (
                  Object.entries(contract.signerFieldDefaults).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                    >
                      <p className="text-xs uppercase tracking-wider text-outline-stitch">
                        {humanizeKey(key)}
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{value || "—"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-outline-stitch">
                    No signer defaults were stored for this contract.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
              <h2 className="font-semibold text-white">Signer Field Values</h2>
              <div className="mt-4 space-y-3">
                {contract.signerFieldValues &&
                Object.keys(contract.signerFieldValues).length > 0 ? (
                  Object.entries(contract.signerFieldValues).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2"
                    >
                      <p className="text-xs uppercase tracking-wider text-outline-stitch">
                        {humanizeKey(key)}
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{value || "—"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-outline-stitch">
                    No signer-entered values have been synced yet.
                  </p>
                )}
              </div>
              {contract.pdfUrl && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="border-outline-variant/50 bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                    asChild
                  >
                    <a href={contract.pdfUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Signed PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
