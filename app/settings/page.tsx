"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  Landmark,
  ShieldCheck,
} from "lucide-react";

interface LegalEntity {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  accountNumber: string;
  status: string;
}

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);

  const fetchEntitiesAndAccounts = useCallback(
    async (entityId?: string, accountIdToKeep?: string) => {
      setLoadingEntities(true);
      try {
        const accountQuery = entityId
          ? `?legalEntityId=${encodeURIComponent(entityId)}`
          : "";
        const [entRes, accRes] = await Promise.all([
          fetch("/api/legal-entities"),
          fetch(`/api/accounts${accountQuery}`),
        ]);

        if (entRes.ok) {
          const data = await entRes.json();
          setLegalEntities(data.items || []);
        }

        if (accRes.ok) {
          const data = await accRes.json();
          const nextAccounts = data.items || [];
          setAccounts(nextAccounts);

          if (
            accountIdToKeep &&
            !nextAccounts.some((account: Account) => account.id === accountIdToKeep)
          ) {
            setSelectedAccount("");
          }
        }
      } catch {
        // OK
      } finally {
        setLoadingEntities(false);
      }
    },
    []
  );

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.hasApiKey);
        setMaskedKey(data.maskedKey);
        setSelectedEntity(data.legalEntityId || "");
        setSelectedAccount(data.accountId || "");
      }
    } catch {
      // OK
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!hasApiKey) return;
    fetchEntitiesAndAccounts(selectedEntity, selectedAccount);
  }, [fetchEntitiesAndAccounts, hasApiKey, selectedEntity]);

  const selectedEntityName = useMemo(
    () =>
      legalEntities.find((entity) => entity.id === selectedEntity)?.name ||
      "Not selected",
    [legalEntities, selectedEntity]
  );

  const selectedAccountName = useMemo(() => {
    const account = accounts.find((item) => item.id === selectedAccount);
    if (!account) return "Not selected";
    return `${account.name} (${account.accountNumber})`;
  }, [accounts, selectedAccount]);

  const preferencesReady = Boolean(selectedEntity && selectedAccount);

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save API key");
        setSavingKey(false);
        return;
      }

      setSuccess("Connected to Slash successfully");
      setApiKey("");
      setSelectedEntity("");
      setSelectedAccount("");
      fetchSettings();
    } catch {
      setError("Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleSavePreferences() {
    setSavingPreferences(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalEntityId: selectedEntity || null,
          accountId: selectedAccount || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSavingPreferences(false);
        return;
      }

      setSuccess("Preferences saved");
    } catch {
      setError("Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 animate-page-enter">
        <Settings className="h-6 w-6 text-primary-stitch" />
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
      </div>

      <div className="max-w-5xl space-y-6">
        {/* API Key Card */}
        <div className="rounded-3xl border border-outline-variant/40 bg-[linear-gradient(155deg,rgba(77,142,255,0.14),rgba(28,32,40,0.94)_42%,rgba(28,32,40,0.98))] p-6 animate-panel-enter shadow-[0_30px_70px_-44px_rgba(0,0,0,0.95)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold text-white">Slash API Connection</h2>
            {hasApiKey ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high px-3 py-1 text-xs font-medium text-outline-stitch">
                <XCircle className="h-3.5 w-3.5" />
                Disconnected
              </span>
            )}
          </div>
          <p className="text-sm text-outline-stitch mb-4">
            Connect your Slash account to manage invoices.
          </p>

          {hasApiKey && maskedKey && (
            <div className="mb-3 rounded-xl border border-outline-variant/30 bg-surface-container-high/75 px-3 py-2 font-mono text-sm text-on-surface">
              {maskedKey}
            </div>
          )}

          <form onSubmit={handleSaveKey} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={
                  hasApiKey
                    ? "Enter new key to replace..."
                    : "Enter your Slash API key..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                className="bg-background border-outline-variant/50 rounded-xl focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline-stitch hover:text-on-surface transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              type="submit"
              disabled={savingKey || !apiKey.trim()}
              className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-xl shadow-[0_8px_20px_-10px_rgba(173,198,255,0.45)]"
            >
              {savingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Connect"
              )}
            </Button>
          </form>

          <p className="mt-3 text-xs text-outline-stitch">
            Your key is encrypted at rest and only used server-side for Slash API calls.
          </p>
        </div>

        {/* Entity & Account Selection */}
        {hasApiKey && (
          <div className="rounded-3xl border border-outline-variant/40 bg-[linear-gradient(175deg,rgba(77,142,255,0.12),rgba(28,32,40,0.95)_48%)] p-6 animate-panel-enter shadow-[0_24px_60px_-38px_rgba(0,0,0,0.95)]">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="mb-1 font-semibold text-white">Account Preferences</h2>
                <p className="text-sm text-outline-stitch">
                  Choose the legal entity and default destination account for invoice
                  payments.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  preferencesReady
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-outline-variant/40 bg-surface-container-high/70 text-outline-stitch"
                }`}
              >
                {preferencesReady ? "Routing configured" : "Incomplete"}
              </span>
            </div>

            {loadingEntities ? (
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/70 px-3 py-3 text-sm text-outline-stitch">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading entities and accounts...
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="space-y-3 rounded-2xl border border-outline-variant/35 bg-surface-container-low/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Building2 className="h-4 w-4 text-primary-stitch" />
                      Legal Entity
                    </div>
                    <Label className="text-xs uppercase tracking-wider text-outline-stitch font-medium">
                      Billing Entity
                    </Label>
                    <select
                      value={selectedEntity}
                      onChange={(e) => {
                        setSelectedEntity(e.target.value);
                        setSelectedAccount("");
                      }}
                      className="flex h-11 w-full rounded-xl border border-outline-variant/50 bg-background px-4 py-2 text-sm text-on-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                    >
                      <option value="">Select...</option>
                      {legalEntities.map((le) => (
                        <option key={le.id} value={le.id}>
                          {le.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-outline-stitch">
                      This is the legal issuer shown on invoices.
                    </p>
                  </section>

                  <section className="space-y-3 rounded-2xl border border-outline-variant/35 bg-surface-container-low/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Landmark className="h-4 w-4 text-primary-stitch" />
                      Default Account
                    </div>
                    <Label className="text-xs uppercase tracking-wider text-outline-stitch font-medium">
                      Receiving Account
                    </Label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-outline-variant/50 bg-background px-4 py-2 text-sm text-on-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                    >
                      <option value="">Select...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.accountNumber})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-outline-stitch">
                      Incoming invoice payments route here by default.
                    </p>
                  </section>
                </div>

                <section className="mt-4 rounded-2xl border border-outline-variant/35 bg-surface-container-low/70 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                    <ShieldCheck className="h-4 w-4 text-primary-stitch" />
                    Current Routing Preview
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-outline-variant/25 bg-background/45 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-outline-stitch">
                        Legal Entity
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{selectedEntityName}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant/25 bg-background/45 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-outline-stitch">
                        Receiving Account
                      </p>
                      <p className="mt-1 text-sm text-on-surface">{selectedAccountName}</p>
                    </div>
                  </div>
                </section>

                <div className="mt-5 flex justify-end">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={savingPreferences}
                    className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-xl shadow-[0_8px_20px_-10px_rgba(173,198,255,0.45)]"
                  >
                    {savingPreferences ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save Preferences
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Messages */}
        {error && (
          <p className="animate-panel-enter rounded-xl border border-error-container/30 bg-error-container/20 px-3 py-2 text-sm text-error-stitch">
            {error}
          </p>
        )}
        {success && (
          <p className="animate-panel-enter rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
