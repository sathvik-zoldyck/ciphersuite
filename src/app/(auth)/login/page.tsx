"use client";

import { useState, useEffect, useRef } from "react";
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
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_LINES = [
  { text: "$ alcyone-secure init workspace",        delay: 0,    color: "#475569" },
  { text: "> loading security modules    [OK]",     delay: 500,  color: "#10b981" },
  { text: "> initializing findings engine [OK]",    delay: 1000, color: "#10b981" },
  { text: "> mounting encrypted vault    [OK]",     delay: 1500, color: "#10b981" },
  { text: "> connecting AI assistant     [OK]",     delay: 2000, color: "#10b981" },
  { text: "> CipherSuite v1.0 ready",               delay: 2600, color: "#22d3ee" },
  { text: "$ awaiting authentication...",           delay: 3200, color: "#475569" },
];

const FEATURES = [
  { icon: "⬡", label: "Findings Manager",  desc: "CVSS-scored vulnerability tracking",   color: "#f87171" },
  { icon: "◈", label: "Evidence Vault",    desc: "Screenshots, logs & PoC per finding",  color: "#a78bfa" },
  { icon: "⌬", label: "Log Analyzer",      desc: "Smart syntax-highlighted log viewer",  color: "#34d399" },
  { icon: "◎", label: "AI Assistant",      desc: "Draft professional findings instantly", color: "#22d3ee" },
];

// ─── Magnetic Button ─────────────────────────────────────────────────────────

function MagneticButton({ children, className, onClick, disabled }: { children: React.ReactNode, className?: string, onClick: () => void, disabled?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 14);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 14);
  };
  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy, ...JSON.parse(className || '{}') }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
    >
      {children}
    </motion.button>
  );
}

// ─── Floating Orbs ───────────────────────────────────────────────────────────

function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Large cyan orb */}
      <motion.div
        animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", top: "10%", left: "8%",
          width: 500, height: 500,
          background: "radial-gradient(circle, rgba(6,182,212,0.13) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(1px)",
        }}
      />
      {/* Teal orb right */}
      <motion.div
        animate={{ x: [0, -25, 15, 0], y: [0, 30, -25, 0], scale: [1, 0.9, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        style={{
          position: "absolute", top: "30%", right: "5%",
          width: 380, height: 380,
          background: "radial-gradient(circle, rgba(20,184,166,0.09) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(1px)",
        }}
      />
      {/* Small accent orb bottom */}
      <motion.div
        animate={{ x: [0, 20, -30, 0], y: [0, -20, 10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        style={{
          position: "absolute", bottom: "15%", left: "30%",
          width: 260, height: 260,
          background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      {/* Dot grid */}
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(100,116,139,0.18) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 80% at 30% 50%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 30% 50%, black 0%, transparent 75%)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

// ─── Noise Texture ───────────────────────────────────────────────────────────

function NoiseOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
      }}
    />
  );
}

// ─── Terminal Window ─────────────────────────────────────────────────────────

function TerminalWindow() {
  const [visible, setVisible] = useState<number[]>([]);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((l, i) =>
      setTimeout(() => setVisible((p) => [...p, i]), l.delay)
    );
    const blink = setInterval(() => setCursor((c) => !c), 530);
    return () => { timers.forEach(clearTimeout); clearInterval(blink); };
  }, []);

  return (
    <div style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(2,3,4,0.85)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      overflow: "hidden",
      boxShadow: "0 32px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f56","#ffbd2e","#27c93f"].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", letterSpacing: "0.18em", textTransform: "uppercase", marginLeft: 8 }}>
          alcyone-secure — init
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#059669", textTransform: "uppercase", letterSpacing: "0.15em" }}>Live</span>
        </div>
      </div>
      {/* Lines */}
      <div style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: 11, lineHeight: 1.8, minHeight: 160 }}>
        {TERMINAL_LINES.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={visible.includes(i) ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
          >
            <span style={{ color: line.color }}>{line.text}</span>
            {i === TERMINAL_LINES.length - 1 && visible.includes(i) && (
              <span style={{
                display: "inline-block", width: 7, height: 13,
                background: "#22d3ee", marginLeft: 2, verticalAlign: "middle",
                borderRadius: 1, opacity: cursor ? 1 : 0, transition: "opacity 0.08s",
              }} />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Glass Input ─────────────────────────────────────────────────────────────

function GlassInput({ label, type, value, onChange, placeholder, icon, error }: {
  label: string; type: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string; icon: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;

  return (
    <div style={{ position: "relative" }}>
      <label style={{
        display: "block", fontFamily: "monospace", fontSize: 10, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6,
      }}>{label}</label>
      <motion.div
        animate={{
          boxShadow: focused
            ? "0 0 0 1px rgba(6,182,212,0.5), 0 0 20px rgba(6,182,212,0.1)"
            : error
            ? "0 0 0 1px rgba(248,113,113,0.4)"
            : "0 0 0 1px rgba(255,255,255,0.07)",
        }}
        style={{
          borderRadius: 12, overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px" }}>
          <span style={{ fontSize: 14, marginRight: 10, opacity: focused ? 0.7 : 0.3, transition: "opacity 0.2s" }}>
            {icon}
          </span>
          <input
            type={inputType}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              height: 44, fontFamily: "monospace", fontSize: 13, color: "#e2e8f0",
              caretColor: "#22d3ee",
            }}
          />
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.4, color: "#94a3b8", fontSize: 13 }}
            >
              {show ? "◉" : "○"}
            </button>
          )}
        </div>
      </motion.div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontFamily: "monospace", fontSize: 10, color: "#f87171", marginTop: 4 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Left Panel ───────────────────────────────────────────────────────────────

function LeftPanel({ mounted }: { mounted: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : -20 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "none",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "52%",
        padding: "56px 64px",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        position: "relative",
      }}
      className="lg-flex"
    >
      {/* Logo */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative" }}>
             <Image src="/logo.png" alt="CipherSuite Logo" width={62} height={62} priority />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                CipherSuite
              </span>
              <span style={{
                fontSize: 9, fontFamily: "monospace", color: "#475569",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4,
                padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.15em",
              }}>v1.0</span>
            </div>
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", marginTop: 3 }}>
              by <span style={{ color: "#64748b", fontWeight: 600 }}>Alcyone Secure</span>
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#059669", textTransform: "uppercase", letterSpacing: "0.2em" }}>
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Hero */}
      <div>
        <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(6,182,212,0.5)", textTransform: "uppercase", letterSpacing: "0.22em", marginBottom: 16 }}>
          Professional Cybersecurity Workspace
        </p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Your entire<br />
          <span style={{ backgroundImage: "linear-gradient(135deg, #22d3ee, #06b6d4, #0e7490)", WebkitBackgroundClip: "text", color: "transparent", backgroundClip: "text" }}>
            pentest workflow.
          </span><br />
          One workspace.
        </h1>
        <p style={{ fontSize: 13, fontFamily: "monospace", color: "#475569", lineHeight: 1.8, maxWidth: 340, marginBottom: 28 }}>
          From first recon to final report — document findings, manage evidence, analyse logs, and generate client-ready reports.
        </p>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : -10 }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.4, ease: "easeOut" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 16px", borderRadius: 14,
                border: `1px solid ${hovered === i ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
                background: hovered === i ? "rgba(255,255,255,0.03)" : "transparent",
                backdropFilter: hovered === i ? "blur(10px)" : "none",
                transform: hovered === i ? "translateX(4px)" : "translateX(0)",
                transition: "all 0.2s ease", cursor: "default",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: hovered === i ? `${f.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${hovered === i ? `${f.color}30` : "rgba(255,255,255,0.06)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, color: hovered === i ? f.color : "#475569",
                transition: "all 0.2s",
              }}>
                {f.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", color: "#cbd5e1" }}>{f.label}</p>
                <p style={{ fontSize: 11, fontFamily: "monospace", color: "#475569" }}>{f.desc}</p>
              </div>
              <span style={{ fontSize: 12, color: hovered === i ? "#475569" : "transparent", transition: "color 0.2s" }}>›</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ delay: 0.8 }}
        style={{ display: "flex", alignItems: "center", gap: 32 }}
      >
        {[["100%","Private"],["5min","Setup"],["Free","Forever"]].map(([v,l], i) => (
          <div key={i}>
            <p style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: "#f1f5f9" }}>{v as string}</p>
            <p style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 2 }}>{l as string}</p>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <span style={{ fontSize: 10 }}>⬡</span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "#334155" }}>Alcyone Secure © 2025</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Auth Panel ───────────────────────────────────────────────────────────────

function AuthPanel({ mounted }: { mounted: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { loginAsGuest, user } = useAuth();
  
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", confirm: "" });
  const [errors, setErrors] = useState<any>({});
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef<HTMLDivElement>(null);

  const rotateX = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 });

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    rotateY.set(nx * 6);
    rotateX.set(-ny * 6);
    setMousePos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };
  const handleCardLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };
  
  const handleGuestLogin = () => {
    loginAsGuest();
    router.push("/");
  };

  const handlePasswordReset = async () => {
    if (!form.email) {
      setErrors({ email: "Please enter your email to reset your password." });
      return;
    }
    setResetLoading(true);
    setErrors({});
    try {
      await sendPasswordResetEmail(auth, form.email);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account for ${form.email} exists, instructions to reset your password have been sent.`,
      });
    } catch (error: any) {
      setErrors({ email: "Failed to send reset email. Please try again." });
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const validate = () => {
    const e: any = {};
    if (!form.email) e.email = "Email required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.password) e.password = "Password required";
    else if (form.password.length < 6) e.password = "Min 6 characters";
    if (mode === "signup") {
      if (!form.name) e.name = "Name required";
      if (form.confirm !== form.password) e.confirm = "Passwords don't match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: form.name });
        }
      }
      // No router.push here - useEffect will handle it
    } catch (error: any) {
      const errorCode = error.code;
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        setErrors({ email: 'Invalid email or password.' });
      } else if (errorCode === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered.' });
      } else {
         setErrors({ email: error.message });
      }
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error?.message ?? "An unexpected error occurred."
      })
      setLoading(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 16 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", flex: 1, padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Mobile logo */}
        <div className="mobile-logo" style={{ textAlign: "center", marginBottom: 32 }}>
           <Image src="/logo.png" alt="CipherSuite Logo" width={68} height={68} priority style={{borderRadius: 16, margin: "0 auto 12px", boxShadow: "0 8px 32px rgba(6,182,212,0.35)"}}/>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>CipherSuite</p>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: "#475569" }}>by Alcyone Secure</p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", marginBottom: 24,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: 4,
        }}>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setErrors({}); }}
              style={{
                flex: 1, height: 36, borderRadius: 9, border: "none", cursor: "pointer",
                fontFamily: "monospace", fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.12em",
                transition: "all 0.25s ease",
                background: mode === m
                  ? "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.1))"
                  : "transparent",
                color: mode === m ? "#22d3ee" : "#475569",
                boxShadow: mode === m ? "0 0 16px rgba(6,182,212,0.12), inset 0 1px 0 rgba(6,182,212,0.15)" : "none",
              }}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Card */}
        <motion.div
          ref={cardRef}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d", perspective: 1000 }}
          onMouseMove={handleCardMove}
          onMouseLeave={handleCardLeave}
        >
          <div style={{
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            overflow: "hidden",
            boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
            position: "relative",
          }}>
            {/* Mouse-follow shimmer */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 24, zIndex: 1,
              background: `radial-gradient(300px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(6,182,212,0.06) 0%, transparent 70%)`,
            }} />

            {/* Top glow line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1, zIndex: 2,
              background: "linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.8) 50%, transparent 95%)",
            }} />

            <AnimatePresence mode="wait">
              <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  style={{ padding: "32px 32px 28px", position: "relative", zIndex: 2 }}
                >
                  {/* Header */}
                  <div style={{ marginBottom: 28 }}>
                    <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(6,182,212,0.5)", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 8 }}>
                      {mode === "login" ? "— Authentication" : "— Create Account"}
                    </p>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 6 }}>
                      {mode === "login" ? "Sign in to workspace" : "Join CipherSuite"}
                    </h2>
                    <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
                      {mode === "login"
                        ? "Access your security findings and projects"
                        : "Create your professional security workspace"}
                    </p>
                  </div>

                  {/* Form fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {mode === "signup" && (
                      <GlassInput label="Full Name" type="text" value={form.name} onChange={set("name")}
                        placeholder="Jane Smith" icon="◈" error={errors.name} />
                    )}
                    <GlassInput label="Email Address" type="email" value={form.email} onChange={set("email")}
                      placeholder="you@company.com" icon="⬡" error={errors.email} />
                    <GlassInput label="Password" type="password" value={form.password} onChange={set("password")}
                      placeholder="••••••••" icon="⌬" error={errors.password} />
                    {mode === "signup" && (
                      <GlassInput label="Confirm Password" type="password" value={form.confirm} onChange={set("confirm")}
                        placeholder="••••••••" icon="◎" error={errors.confirm} />
                    )}
                  </div>

                  {mode === "login" && (
                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <button
                        onClick={handlePasswordReset}
                        disabled={resetLoading}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: "#475569",
                          textDecoration: "underline",
                          textDecorationColor: "rgba(71,85,105,0.4)",
                          opacity: resetLoading ? 0.5 : 1,
                        }}
                      >
                        {resetLoading ? "Sending..." : "Forgot password?"}
                      </button>
                    </div>
                  )}

                  {/* Submit */}
                  <MagneticButton
                    onClick={handleSubmit}
                    disabled={loading}
                    className={JSON.stringify({
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      width: "100%", height: 48, marginTop: 24, borderRadius: 14,
                      background: loading
                        ? "rgba(6,182,212,0.3)"
                        : "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)",
                      border: "1px solid rgba(6,182,212,0.3)",
                      color: loading ? "rgba(255,255,255,0.5)" : "#000",
                      fontFamily: "monospace", fontSize: 13, fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: loading ? "none" : "0 8px 32px rgba(6,182,212,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                      transition: "all 0.2s",
                      position: "relative", overflow: "hidden",
                    })}
                  >
                    {/* Shimmer */}
                    {!loading && (
                      <motion.div
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.5 }}
                        style={{
                          position: "absolute", inset: 0,
                          background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.6)", borderRadius: "50%" }}
                        />
                        <span>Authenticating…</span>
                      </>
                    ) : (
                      <span>{mode === "login" ? "Sign In →" : "Create Account →"}</span>
                    )}
                  </MagneticButton>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: "#334155" }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                  </div>

                  {/* Guest */}
                  <button
                    onClick={handleGuestLogin}
                    style={{
                      width: "100%", height: 42, borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "rgba(255,255,255,0.02)",
                      backdropFilter: "blur(10px)",
                      color: "#475569", fontFamily: "monospace", fontSize: 12,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.target as HTMLElement).style.color = "#94a3b8"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.target as HTMLElement).style.color = "#475569"; }}
                  >
                    ○ Continue as Guest
                  </button>

                  {/* Warning */}
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 14px", borderRadius: 10, marginTop: 16,
                    background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)",
                  }}>
                    <span style={{ fontSize: 11, color: "rgba(245,158,11,0.5)", marginTop: 1 }}>⚠</span>
                    <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(245,158,11,0.45)", lineHeight: 1.6 }}>
                      Guest mode stores data locally only. Sign in to sync across devices.
                    </p>
                  </div>

                  {/* Trust row */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20 }}>
                    {[["🔒","E2E Encrypted"],["🛡","Zero Data Sharing"],["⚡","Firebase Secured"]].map(([ic,lb], i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, opacity: 0.4 }}>{ic}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#334155" }}>{lb as string}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Terminal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          style={{ marginTop: 16 }}
        >
          <TerminalWindow />
        </motion.div>

        <p style={{ textAlign: "center", fontFamily: "monospace", fontSize: 10, color: "#1e293b", marginTop: 16 }}>
          CipherSuite · A product of <span style={{ color: "#334155" }}>Alcyone Secure</span>
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080A0C; }
        ::placeholder { color: #334155 !important; font-family: monospace; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0A0B0D inset !important; -webkit-text-fill-color: #e2e8f0 !important; }
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
          .mobile-logo { display: none !important; }
        }
      `}</style>

      <div style={{ position: "relative", minHeight: "100vh", background: "#080A0C", display: "flex", overflow: "hidden" }}>
        <NoiseOverlay />
        <FloatingOrbs />
        <LeftPanel mounted={mounted} />
        <AuthPanel mounted={mounted} />
      </div>
    </>
  );
}
