"use client";

import { useState, useEffect, useCallback, useDeferredValue } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Loader2, Search, X } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  recipientType: string;
  recipientLegalName: string;
  recipientEmail: string;
}

function getContactInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "—";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    recipientLegalName: "",
    recipientEmail: "",
  });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const fetchContacts = useCallback(async (searchTerm?: string, signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (searchTerm?.trim()) {
        params.set("q", searchTerm.trim());
      }

      const res = await fetch(`/api/contacts${params.size ? `?${params}` : ""}`, {
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.items || []);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      // No API key yet — that's fine
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchContacts(deferredSearch, controller.signal);

    return () => controller.abort();
  }, [deferredSearch, fetchContacts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create contact");
        setCreating(false);
        return;
      }

      setForm({ name: "", recipientLegalName: "", recipientEmail: "" });
      setShowDialog(false);
      fetchContacts(deferredSearch);
    } catch {
      setError("Failed to create contact");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary-stitch" />
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Contacts
          </h1>
        </div>
        <Button
          className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-md shadow-[0_4px_14px_0_rgba(173,198,255,0.15)]"
          onClick={() => setShowDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Contact
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name"
            className="pl-9 pr-10 bg-background border-outline-variant/50 rounded-md focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear contact search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-sm text-muted-foreground">
            {loading ? "Searching..." : `${contacts.length} result${contacts.length === 1 ? "" : "s"}`}
          </p>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">
            {search ? "No contacts found" : "No contacts yet"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search
              ? `No contacts match "${search.trim()}".`
              : "Add your first customer to start invoicing."}
          </p>
          {search ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low/70 p-3 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
          <div className="hidden md:grid md:grid-cols-[1.1fr_1fr_1.2fr] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-outline-stitch">
            <span>Name</span>
            <span>Legal Name</span>
            <span>Email</span>
          </div>

          <div className="space-y-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="group rounded-lg border border-transparent bg-surface-container px-4 py-3 smooth-transition hover:border-outline-variant/40 hover:bg-surface-container-high"
              >
                <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1.2fr] md:items-center">
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-outline-stitch md:hidden">
                      Name
                    </p>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary-stitch/30 to-primary-container/35 text-[11px] font-semibold text-primary-stitch">
                        {getContactInitials(c.name)}
                      </div>
                      <p className="truncate text-sm font-medium text-on-surface">
                        {c.name}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-outline-stitch md:hidden">
                      Legal Name
                    </p>
                    <p className="truncate text-sm text-outline-stitch">
                      {c.recipientLegalName || "—"}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-outline-stitch md:hidden">
                      Email
                    </p>
                    <p className="truncate text-sm text-outline-stitch">
                      {c.recipientEmail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60 animate-page-enter"
            onClick={() => setShowDialog(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-outline-variant/40 bg-surface-container p-6 shadow-[0_22px_60px_-30px_rgba(0,0,0,0.9)] animate-panel-enter">
            <h2 className="text-lg font-semibold mb-1 text-white">New Contact</h2>
            <p className="text-sm text-outline-stitch mb-5">
              Add a customer or business contact for invoicing.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-name">Display Name</Label>
                <Input
                  id="c-name"
                  placeholder="e.g. Acme Corp"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-legal">Legal Name</Label>
                <Input
                  id="c-legal"
                  placeholder="e.g. Acme Corporation Pty Ltd"
                  value={form.recipientLegalName}
                  onChange={(e) =>
                    setForm({ ...form, recipientLegalName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="billing@acme.com"
                  value={form.recipientEmail}
                  onChange={(e) =>
                    setForm({ ...form, recipientEmail: e.target.value })
                  }
                  required
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
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
