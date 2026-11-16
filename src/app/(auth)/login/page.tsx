"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Bug, Eye, EyeOff, FileBarChart2, Loader2, Paperclip, Target, Terminal,
} from "@/components/icons";

type Mode = "login" | "signup";
type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

// What the product does, in the order a tester uses it.
const WORKFLOW = [
  { icon: Terminal,      title: "Import tool output",  body: "Nmap, Nessus and Burp results become draft findings." },
  { icon: Bug,           title: "Write findings",      body: "Severity, CVSS, CWE and OWASP on every finding." },
  { icon: Paperclip,     title: "Attach evidence",     body: "Screenshots, requests and logs linked to the finding they prove." },
  { icon: FileBarChart2, title: "Ship the report",     body: "Executive, technical or bug bounty templates, exported to PDF or Word." },
];

// ─── Sample finding (left panel) ──────────────────────────────────────────────

function SampleFinding() {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0D0F12] p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-400">Critical</span>
        <span className="rounded-md border border-slate-700 px-2 py-0.5 text-slate-400">CWE-89</span>
        <span className="rounded-md border border-slate-700 px-2 py-0.5 text-slate-400">A03:2021</span>
        <span className="ml-auto font-mono text-red-400">CVSS 9.8</span>
      </div>
      <p className="mt-3 font-display text-lg font-semibold text-slate-100">SQL injection in order search</p>
      <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-500">
        <Target className="h-3.5 w-3.5" /> GET /api/v2/orders?q=
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        The <code className="rounded bg-slate-800 px-1 py-0.5 text-[12px] text-slate-300">q</code> parameter is
        concatenated into a SQL query, so an unauthenticated user can read every order.
      </p>
    </div>
  );
}

// ─── Form field ───────────────────────────────────────────────────────────────

function Field({
  id, label, type = "text", value, onChange, placeholder, error, autoComplete,
}: {
  id: string; label: string; type?: string; value: string; placeholder?: string;
  error?: string; autoComplete?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-300">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-[#0D0F12] px-3.5 text-sm text-slate-100 placeholder:text-slate-600",
            "transition-colors focus:outline-none focus:ring-2",
            isPassword && "pr-11",
            error
              ? "border-red-500/50 focus:ring-red-500/25"
              : "border-slate-700/70 focus:border-violet-500/60 focus:ring-violet-500/25",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginAsGuest, user } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const switchMode = (m: Mode) => { setMode(m); setErrors({}); };

  const handleGuestLogin = () => {
    loginAsGuest();
    router.push("/");
  };

  const handlePasswordReset = async () => {
    if (!form.email) {
      setErrors({ email: "Enter your email first, then choose Forgot password." });
      return;
    }
    setResetLoading(true);
    setErrors({});
    try {
      await sendPasswordResetEmail(auth, form.email);
      toast({
        title: "Reset email sent",
        description: `If ${form.email} has an account, a reset link is on its way.`,
      });
    } catch (error: any) {
      setErrors({ email: "Couldn't send the reset email. Check the address and try again." });
      toast({ variant: "destructive", title: "Reset email not sent", description: error?.message });
    } finally {
      setResetLoading(false);
    }
  };

  const validate = () => {
    const e: Errors = {};
    if (!form.email) e.email = "Enter your email.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "That doesn't look like an email address.";
    if (!form.password) e.password = "Enter your password.";
    else if (form.password.length < 6) e.password = "Use at least 6 characters.";
    if (mode === "signup") {
      if (!form.name) e.name = "Enter your name.";
      if (form.confirm !== form.password) e.confirm = "Passwords don't match.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        if (cred.user) await updateProfile(cred.user, { displayName: form.name });
      }
      // Redirect happens in the effect above once `user` is set.
    } catch (error: any) {
      const code = error?.code;
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErrors({ email: "Email or password is incorrect." });
      } else if (code === "auth/email-already-in-use") {
        setErrors({ email: "An account with this email already exists. Sign in instead." });
      } else {
        setErrors({ email: error?.message ?? "Something went wrong. Try again." });
      }
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080A0C] lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Left: what CipherSuite is ─────────────────────────────────────── */}
      <section className="hidden flex-col justify-between border-r border-slate-800/70 px-12 py-10 lg:flex xl:px-20">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={36} height={36} priority />
          <div>
            <p className="font-display text-lg font-semibold leading-none text-slate-100">CipherSuite</p>
            <p className="mt-1 text-xs text-slate-500">by Alcyone Secure</p>
          </div>
        </div>

        <div className="max-w-xl py-12">
          <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight text-slate-50">
            From first scan to client report, in one workspace.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
            An open-source workspace for penetration testers and bug bounty hunters.
          </p>

          <div className="mt-8"><SampleFinding /></div>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {WORKFLOW.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-600">
          Open source under the MIT license.
        </p>
      </section>

      {/* ── Right: sign in ────────────────────────────────────────────────── */}
      <section className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="" width={32} height={32} priority />
            <p className="font-display text-lg font-semibold text-slate-100">CipherSuite</p>
          </div>

          <h2 className="font-display text-[28px] font-semibold tracking-tight text-slate-50">
            {mode === "login" ? "Sign in" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-violet-400 hover:text-violet-300"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field id="name" label="Name" value={form.name} onChange={set("name")}
                placeholder="Jane Smith" autoComplete="name" error={errors.name} />
            )}
            <Field id="email" label="Email" type="email" value={form.email} onChange={set("email")}
              placeholder="you@company.com" autoComplete="email" error={errors.email} />
            <Field id="password" label="Password" type="password" value={form.password} onChange={set("password")}
              placeholder="At least 6 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"} error={errors.password} />
            {mode === "signup" && (
              <Field id="confirm" label="Confirm password" type="password" value={form.confirm} onChange={set("confirm")}
                autoComplete="new-password" error={errors.confirm} />
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="text-[13px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
                >
                  {resetLoading ? "Sending…" : "Forgot password?"}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-500 text-sm font-semibold text-white transition-colors hover:bg-violet-400 active:bg-violet-600 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-600">
            <span className="h-px flex-1 bg-slate-800" /> or <span className="h-px flex-1 bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-white/[0.03]"
          >
            Try it without an account <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            Guest mode keeps your projects in this browser only.
          </p>
        </div>
      </section>
    </main>
  );
}
