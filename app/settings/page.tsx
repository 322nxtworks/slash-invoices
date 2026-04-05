"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

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

      <div className="max-w-3xl space-y-6">
        {/* API Key Card */}
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-white">Slash API Connection</h2>
            {hasApiKey ? (
              <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-md bg-surface-container-high px-2 py-1 text-xs font-medium text-outline-stitch">
                <XCircle className="h-3.5 w-3.5" />
                Disconnected
              </span>
            )}
          </div>
          <p className="text-sm text-outline-stitch mb-4">
            Connect your Slash account to manage invoices.
          </p>

          {hasApiKey && maskedKey && (
            <div className="text-sm text-on-surface mb-3 bg-surface-container-high rounded-md px-3 py-2 font-mono">
              {maskedKey}
            </div>
          )}

          <form onSubmit={handleSaveKey} className="flex gap-2">
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
                className="bg-background border-outline-variant/50 rounded-md focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
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
              className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-md shadow-[0_4px_14px_0_rgba(173,198,255,0.15)]"
            >
              {savingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        </div>

        {/* Entity & Account Selection */}
        {hasApiKey && (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-6 space-y-4 animate-panel-enter shadow-[0_18px_40px_-26px_rgba(0,0,0,0.8)]">
            <div>
              <h2 className="font-semibold mb-1 text-white">Account Preferences</h2>
              <p className="text-sm text-outline-stitch">
                Select which entity and account to use for invoices.
              </p>
            </div>

            {loadingEntities ? (
              <div className="flex items-center gap-2 text-sm text-outline-stitch">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-outline-stitch font-medium">Legal Entity</Label>
                  <select
                    value={selectedEntity}
                    onChange={(e) => {
                      setSelectedEntity(e.target.value);
                      setSelectedAccount("");
                    }}
                    className="flex h-10 w-full rounded-md border border-outline-variant/50 bg-background px-3 py-2 text-sm text-on-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                  >
                    <option value="">Select...</option>
                    {legalEntities.map((le) => (
                      <option key={le.id} value={le.id}>
                        {le.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-outline-stitch font-medium">Default Account (for receiving payments)</Label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-outline-variant/50 bg-background px-3 py-2 text-sm text-on-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch"
                  >
                    <option value="">Select...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  className="bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed border-0 hover:opacity-90 rounded-md shadow-[0_4px_14px_0_rgba(173,198,255,0.15)]"
                >
                  {savingPreferences ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Preferences
                </Button>
              </>
            )}
          </div>
        )}

        {/* Messages */}
        {error && (
          <p className="text-sm text-error-stitch bg-error-container/20 border border-error-container/30 rounded-md px-3 py-2 animate-panel-enter">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2 animate-panel-enter">
            {success}
          </p>
        )}
      </div>
    </div>
  );
}
