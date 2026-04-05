"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Loader2,
  Trash2,
  Download,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  DEFAULT_INVOICE_TIME_ZONE,
  formatCurrency,
  formatDate,
  formatDateForInput,
  dollarsToCents,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InvoiceItem {
  invoice: {
    id: string;
    status: string;
    collectedAmountCents: number;
    legalEntityContactId: string;
  };
  invoiceDetails: {
    id?: string;
    issuedAt: string;
    dueAt: string;
    documentId?: string;
    lineItemsAndTotals: {
      totalAmountCents: number;
      subtotalCents: number;
    };
    invoiceNumber: string;
    billedTo: { name: string; email: string };
    memo: string;
  };
}

interface Contact {
  id: string;
  name: string;
  recipientEmail: string;
}

interface LineItem {
  name: string;
  quantity: number;
  price: number; // dollars
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

function statusBadge(status: string) {
  const map: Record<string, { variant: "success" | "warning" | "danger" | "muted" | "default"; label: string }> = {
    paid: { variant: "success", label: "Paid" },
    unpaid: { variant: "warning", label: "Unpaid" },
    paid_partially: { variant: "warning", label: "Partial" },
    overdue: { variant: "danger", label: "Overdue" },
    void: { variant: "muted", label: "Void" },
  };
  const s = map[status] || { variant: "default" as const, label: status };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function today() {
  return formatDateForInput(new Date(), DEFAULT_INVOICE_TIME_ZONE);
}

function in30Days() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return formatDateForInput(d, DEFAULT_INVOICE_TIME_ZONE);
}

function getDashboardInvoicePath(invoiceId: string) {
  return `/invoices/${invoiceId}`;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);

  // Invoice form state
  const [contactId, setContactId] = useState("");
  const [issuedAt, setIssuedAt] = useState(today());
  const [dueAt, setDueAt] = useState(in30Days());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [memo, setMemo] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { name: "", quantity: 1, price: 0 },
  ]);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.items || []);
      }
    } catch {
      // OK
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.items || []);
      }
    } catch {
      // OK
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchContacts();
  }, [fetchInvoices, fetchContacts]);

  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.price,
    0
  );
  const discountAmount = subtotal * (discount / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (tax / 100);
  const total = afterDiscount + taxAmount;

  function addLineItem() {
    setLineItems([...lineItems, { name: "", quantity: 1, price: 0 }]);
  }

  function removeLineItem(i: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== i));
  }

  function updateLineItem(i: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    if (field === "name") {
      updated[i].name = value as string;
    } else {
      updated[i][field] = Number(value) || 0;
    }
    setLineItems(updated);
  }

  function resetForm() {
    setContactId("");
    setIssuedAt(today());
    setDueAt(in30Days());
    setInvoiceNumber("");
    setMemo("");
    setDiscount(0);
    setTax(0);
    setLineItems([{ name: "", quantity: 1, price: 0 }]);
    setError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalEntityContactId: contactId,
          issuedAt,
          dueAt,
          lineItems: lineItems
            .filter((li) => li.name && li.price > 0)
            .map((li) => ({
              name: li.name,
              quantity: li.quantity,
              priceCents: dollarsToCents(li.price),
            })),
          discount: discount > 0 ? discount : undefined,
          tax: tax > 0 ? tax : undefined,
          invoiceNumber: invoiceNumber || undefined,
          memo: memo || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create invoice");
        setCreating(false);
        return;
      }

      const data = await res.json();
      const invoiceId =
        typeof data?.invoice?.id === "string" ? data.invoice.id : null;

      resetForm();
      setShowDialog(false);
      setCreatedInvoiceId(invoiceId);
      fetchInvoices();
    } catch {
      setError("Failed to create invoice");
    } finally {
      setCreating(false);
    }
  }

  function exportCsv() {
    const headers = ["Invoice #", "Customer", "Email", "Issued", "Due", "Amount", "Collected", "Status", "Memo"];
    const rows = invoices.map((item) => [
      item.invoiceDetails.invoiceNumber || "",
      item.invoiceDetails.billedTo?.name || "",
      item.invoiceDetails.billedTo?.email || "",
      item.invoiceDetails.issuedAt || "",
      item.invoiceDetails.dueAt || "",
      ((item.invoiceDetails.lineItemsAndTotals?.totalAmountCents || 0) / 100).toFixed(2),
      ((item.invoice.collectedAmountCents || 0) / 100).toFixed(2),
      item.invoice.status || "",
      item.invoiceDetails.memo || "",
    ]);

    const escape = (v: string) => {
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };

    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${formatDateForInput(
      new Date(),
      DEFAULT_INVOICE_TIME_ZONE
    )}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyInvoiceLink(invoiceId: string) {
    const link = new URL(
      getDashboardInvoicePath(invoiceId),
      window.location.origin
    ).toString();

    try {
      await navigator.clipboard.writeText(link);
      setCopiedInvoiceId(invoiceId);
      window.setTimeout(() => {
        setCopiedInvoiceId((current) =>
          current === invoiceId ? null : current
        );
      }, 2000);
    } catch {
      setError("Could not copy the invoice link");
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Invoices</h1>
        </div>
        <div className="flex items-center gap-2">
          {invoices.length > 0 && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {createdInvoiceId && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-emerald-300">Invoice created</p>
              <p className="text-sm text-emerald-100/80">
                The dashboard link is ready to copy or open.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copyInvoiceLink(createdInvoiceId)}
              >
                {copiedInvoiceId === createdInvoiceId ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copiedInvoiceId === createdInvoiceId ? "Copied" : "Copy Link"}
              </Button>
              <Button asChild>
                <Link href={getDashboardInvoicePath(createdInvoiceId)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Invoice
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setLoading(true);
            }}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              statusFilter === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No invoices found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first invoice to get started.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setShowDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Issued
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Due
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((item) => (
                <tr
                  key={item.invoice.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    <Link
                      href={getDashboardInvoicePath(item.invoice.id)}
                      className="hover:text-primary hover:underline"
                    >
                      {item.invoiceDetails.invoiceNumber || "View invoice"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.invoiceDetails.billedTo?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(item.invoiceDetails.issuedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(item.invoiceDetails.dueAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {formatCurrency(
                      item.invoiceDetails.lineItemsAndTotals?.totalAmountCents || 0
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {statusBadge(item.invoice.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={getDashboardInvoicePath(item.invoice.id)}>
                          View
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyInvoiceLink(item.invoice.id)}
                      >
                        {copiedInvoiceId === item.invoice.id ? (
                          <Check className="mr-2 h-3.5 w-3.5" />
                        ) : (
                          <Copy className="mr-2 h-3.5 w-3.5" />
                        )}
                        {copiedInvoiceId === item.invoice.id ? "Copied" : "Copy Link"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Invoice Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto py-8">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => {
              setShowDialog(false);
              resetForm();
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-1">New Invoice</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Create and send an invoice to a contact.
            </p>
            <form onSubmit={handleCreate} className="space-y-5">
              {/* Contact */}
              <div className="space-y-2">
                <Label>Bill To</Label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.recipientEmail})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={issuedAt}
                    onChange={(e) => setIssuedAt(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Invoice Number */}
              <div className="space-y-2">
                <Label>Invoice Number (optional)</Label>
                <Input
                  placeholder="Auto-generated if blank"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <Label>Line Items</Label>
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-end">
                    {i === 0 && (
                      <>
                        <span className="text-xs text-muted-foreground mb-1">Description</span>
                        <span className="text-xs text-muted-foreground mb-1">Qty</span>
                        <span className="text-xs text-muted-foreground mb-1">Price ($)</span>
                        <span />
                      </>
                    )}
                    <Input
                      placeholder="Item description"
                      value={li.name}
                      onChange={(e) => updateLineItem(i, "name", e.target.value)}
                      required
                    />
                    <Input
                      type="number"
                      min={1}
                      value={li.quantity}
                      onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                      required
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={li.price || ""}
                      onChange={(e) => updateLineItem(i, "price", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeLineItem(i)}
                      className="h-10 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Line Item
                </Button>
              </div>

              {/* Discount & Tax */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tax || ""}
                    onChange={(e) => setTax(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-md bg-muted/50 p-4 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Discount ({discount}%)</span>
                    <span className="font-mono">
                      -${discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({tax}%)</span>
                    <span className="font-mono">
                      +${taxAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="font-mono">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Memo */}
              <div className="space-y-2">
                <Label>Memo (optional)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Notes or payment instructions"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
