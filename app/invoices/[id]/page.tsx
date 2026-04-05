"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  buildSlashInvoiceLinkFromIdentifiers,
  normalizeSlashUrl,
} from "@/lib/slash-invoice-link";

interface InvoiceResponse {
  slashInvoiceLink?: string | null;
  invoice?: {
    id: string;
    status?: string;
    collectedAmountCents?: number;
  };
  invoiceDetails?: {
    invoiceNumber?: string;
    documentId?: string;
    issuedAt?: string;
    dueAt?: string;
    memo?: string;
    billedTo?: {
      name?: string;
      email?: string;
    };
    lineItemsAndTotals?: {
      subtotalCents?: number;
      totalAmountCents?: number;
      lineItems?: Array<{
        name?: string;
        quantity?: number;
        priceCents?: number;
      }>;
    };
  };
}

function statusBadge(status?: string) {
  const variants: Record<
    string,
    { variant: "success" | "warning" | "danger" | "muted" | "default"; label: string }
  > = {
    paid: { variant: "success", label: "Paid" },
    unpaid: { variant: "warning", label: "Unpaid" },
    paid_partially: { variant: "warning", label: "Partial" },
    overdue: { variant: "danger", label: "Overdue" },
    void: { variant: "muted", label: "Void" },
  };

  const resolved = (status && variants[status]) || {
    variant: "default" as const,
    label: status || "Unknown",
  };

  return <Badge variant={resolved.variant}>{resolved.label}</Badge>;
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = typeof params?.id === "string" ? params.id : "";

  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;

    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || "Failed to load invoice");
          }
          return;
        }

        if (!cancelled) {
          setInvoice(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load invoice");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const slashInvoiceLink = useMemo(
    () =>
      normalizeSlashUrl(invoice?.slashInvoiceLink) ||
      buildSlashInvoiceLinkFromIdentifiers({
        documentId: invoice?.invoiceDetails?.documentId,
        invoiceId: invoice?.invoice?.id || invoiceId,
      }),
    [invoice?.slashInvoiceLink, invoice?.invoiceDetails?.documentId, invoice?.invoice?.id, invoiceId]
  );

  async function copyLink() {
    if (!slashInvoiceLink) {
      setError("Slash invoice link is not available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(slashInvoiceLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the invoice link");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">
                {invoice?.invoiceDetails?.invoiceNumber || "Invoice"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Slash invoice link and invoice details
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={copyLink}
            disabled={!slashInvoiceLink}
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy Slash Link"}
          </Button>
          {slashInvoiceLink && (
            <Button asChild>
              <a href={slashInvoiceLink} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in New Tab
              </a>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoice ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-2">{statusBadge(invoice.invoice?.status)}</div>
                </div>
                {invoice.invoiceDetails?.documentId && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Document ID</p>
                    <p className="mt-2 font-mono text-sm">
                      {invoice.invoiceDetails.documentId}
                    </p>
                  </div>
                )}
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Issue Date</dt>
                  <dd className="mt-1 font-medium">
                    {invoice.invoiceDetails?.issuedAt
                      ? formatDate(invoice.invoiceDetails.issuedAt)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Due Date</dt>
                  <dd className="mt-1 font-medium">
                    {invoice.invoiceDetails?.dueAt
                      ? formatDate(invoice.invoiceDetails.dueAt)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Customer</dt>
                  <dd className="mt-1 font-medium">
                    {invoice.invoiceDetails?.billedTo?.name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="mt-1 font-medium">
                    {invoice.invoiceDetails?.billedTo?.email || "—"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Line Items</h2>
              {invoice.invoiceDetails?.lineItemsAndTotals?.lineItems?.length ? (
                <div className="space-y-3">
                  {invoice.invoiceDetails.lineItemsAndTotals.lineItems.map(
                    (item, index) => (
                    <div
                      key={`${item.name || "line-item"}-${index}`}
                      className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{item.name || "Untitled item"}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty {item.quantity || 0}
                        </p>
                      </div>
                      <p className="font-mono text-sm">
                        {formatCurrency(item.priceCents || 0)}
                      </p>
                    </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Slash did not return line-item detail for this invoice.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Totals</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(
                      invoice.invoiceDetails?.lineItemsAndTotals?.subtotalCents || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(
                      invoice.invoiceDetails?.lineItemsAndTotals?.totalAmountCents || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-mono">
                    {formatCurrency(invoice.invoice?.collectedAmountCents || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold">Memo</h2>
              <p className="text-sm text-muted-foreground">
                {invoice.invoiceDetails?.memo || "No memo added."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
