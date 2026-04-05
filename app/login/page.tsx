"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
        // Auto sign in after register
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(isRegister ? "Account created but sign-in failed. Try logging in." : "Invalid email or password");
        setLoading(false);
        return;
      }

      router.push("/contacts");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-lg bg-surface-container border-0 shadow-2xl shadow-black/50">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-primary-stitch to-primary-container text-white font-bold text-xl shadow-lg shadow-primary-stitch/20">
            /
          </div>
          <div className="text-center">
            <h1 className="text-[20px] font-semibold text-white">Slash Invoices</h1>
            <p className="text-sm text-outline-stitch mt-1">
              {isRegister ? "Create an account to get started" : "Obsidian Ledger v4.0.2"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase text-outline-stitch tracking-wider font-medium">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-outline-variant/30 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch rounded-md"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase text-outline-stitch tracking-wider font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-outline-variant/30 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch rounded-md"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase text-outline-stitch tracking-wider font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={isRegister ? "Min 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isRegister ? 8 : undefined}
              className="bg-background border-outline-variant/30 focus-visible:ring-primary-stitch focus-visible:ring-offset-0 focus-visible:border-primary-stitch rounded-md"
            />
          </div>

          {error && (
            <p className="text-sm text-error-stitch bg-error-container/20 border border-error-container/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full bg-gradient-to-br from-primary-stitch to-primary-container text-white rounded-md border-0 hover:opacity-90 shadow-[0_4px_14px_0_rgba(173,198,255,0.15)] transition-all" disabled={loading}>
            {loading
              ? "Please wait..."
              : isRegister
              ? "Create Account"
              : "Sign In"}
          </Button>
        </form>

        <div className="text-center text-sm text-outline-stitch">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setIsRegister(false);
                  setError("");
                }}
                className="text-primary-stitch hover:text-white transition-colors font-medium underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to the ledger?{" "}
              <button
                onClick={() => {
                  setIsRegister(true);
                  setError("");
                }}
                className="text-primary-stitch hover:text-white transition-colors font-medium underline underline-offset-4"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
