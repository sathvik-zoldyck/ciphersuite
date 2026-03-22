"use client";

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, addDoc, onSnapshot, deleteDoc,
  doc, updateDoc, serverTimestamp, query, orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { PersonalNote, NoteColor as PersonalNoteColor } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// NoteColor values MUST match types.ts exactly
type NoteColor  = "default" | "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink";
type FilterType = "all" | "pinned" | "reminders" | "archive" | "bin";
type ViewMode   = "write" | "preview" | "split";
type LayoutMode = "masonry" | "list";
type Theme      = "dark" | "light";

// ─────────────────────────────────────────────────────────────────────────────
// Color definitions — hex, no Tailwind dynamic classes
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_COLORS: Record<NoteColor, {
  label:      string;
  accent:     string;
  cardDark:   string;
  cardLight:  string;
  labelBg:    string;
  labelText:  string;
  dot:        string;
}> = {
  default: { label: "Default",   accent: "#71717a", cardDark: "#18181b", cardLight: "#f4f4f5", labelBg: "#27272a", labelText: "#a1a1aa", dot: "#71717a" },
  red:     { label: "Critical",  accent: "#f43f5e", cardDark: "#1f0a10", cardLight: "#fff1f2", labelBg: "#4c0519", labelText: "#fb7185", dot: "#f43f5e" },
  orange:  { label: "Important", accent: "#f97316", cardDark: "#1c0d05", cardLight: "#fff7ed", labelBg: "#431407", labelText: "#fb923c", dot: "#f97316" },
  yellow:  { label: "Note",      accent: "#eab308", cardDark: "#1c1407", cardLight: "#fefce8", labelBg: "#451a03", labelText: "#facc15", dot: "#eab308" },
  green:   { label: "Done",      accent: "#22c55e", cardDark: "#0f1a10", cardLight: "#f0fdf4", labelBg: "#14532d", labelText: "#4ade80", dot: "#22c55e" },
  teal:    { label: "Research",  accent: "#14b8a6", cardDark: "#051714", cardLight: "#f0fdfa", labelBg: "#042f2e", labelText: "#2dd4bf", dot: "#14b8a6" },
  blue:    { label: "Info",      accent: "#3b82f6", cardDark: "#0a1020", cardLight: "#eff6ff", labelBg: "#1e3a5f", labelText: "#60a5fa", dot: "#3b82f6" },
  purple:  { label: "Personal",  accent: "#a855f7", cardDark: "#130d24", cardLight: "#faf5ff", labelBg: "#3b0764", labelText: "#c084fc", dot: "#a855f7" },
  pink:    { label: "Idea",      accent: "#ec4899", cardDark: "#1a0720", cardLight: "#fdf2f8", labelBg: "#500724", labelText: "#f472b6", dot: "#ec4899" },
};

const COLOR_ORDER: NoteColor[] = ["default","red","orange","yellow","green","teal","blue","purple","pink"];

const DESTRUCT_PRESETS = [
  { label: "1h",  ms: 3_600_000     },
  { label: "6h",  ms: 21_600_000    },
  { label: "24h", ms: 86_400_000    },
  { label: "7d",  ms: 604_800_000   },
  { label: "30d", ms: 2_592_000_000 },
];

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

const BG_KEY    = (id: string) => `cs:note-bg:${id}`;
const LOCAL_KEY = "cs:local-notes";
const THEME_KEY = "cs:notes-theme";

const readBg          = (id: string): string | null => { try { return localStorage.getItem(BG_KEY(id)); } catch { return null; } };
const writeBg         = (id: string, v: string | null) => { try { v ? localStorage.setItem(BG_KEY(id), v) : localStorage.removeItem(BG_KEY(id)); } catch {} };
const readLocalNotes  = (): PersonalNote[] => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]"); } catch { return []; } };
const writeLocalNotes = (n: PersonalNote[]) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(n)); } catch {} };
const readTheme       = (): Theme | null => { try { return localStorage.getItem(THEME_KEY) as Theme | null; } catch { return null; } };
const writeTheme      = (t: Theme) => { try { localStorage.setItem(THEME_KEY, t); } catch {} };

/** Normalise any destructAt (Firestore Timestamp | Date | number | null) → number | null */
function toMs(val: any): number | null {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val?.toDate === "function") return (val as Timestamp).toDate().getTime();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown hook
// ─────────────────────────────────────────────────────────────────────────────

function useCountdown(destructAt?: number | null): string | null {
  const [display, setDisplay] = useState<string | null>(null);
  useEffect(() => {
    if (!destructAt) { setDisplay(null); return; }
    const tick = () => {
      const diff = destructAt - Date.now();
      if (diff <= 0) { setDisplay("Expired"); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000)  / 60_000);
      const s = Math.floor((diff % 60_000)      / 1_000);
      setDisplay(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [destructAt]);
  return display;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────

function tok(theme: Theme) {
  const dk = theme === "dark";
  return {
    pageBg:          dk ? "#0a0a0b" : "#f4f4f5",
    sidebarBg:       dk ? "#111113" : "#ffffff",
    sidebarBorder:   dk ? "#27272a" : "#e4e4e7",
    headerBg:        dk ? "#111113" : "#ffffff",
    headerBorder:    dk ? "#27272a" : "#e4e4e7",
    toolbarBg:       dk ? "#18181b" : "#f9f9f9",
    toolbarBorder:   dk ? "#27272a" : "#d4d4d8",
    tagBarBg:        dk ? "#0f0f10" : "#fafafa",
    footerBg:        dk ? "#111113" : "#ffffff",
    cardBorder:      dk ? "#27272a" : "#e4e4e7",
    cardHoverBorder: dk ? "#52525b" : "#71717a",
    divider:         dk ? "#27272a" : "#e4e4e7",
    textPrimary:     dk ? "#fafafa" : "#09090b",
    textSecondary:   dk ? "#a1a1aa" : "#52525b",
    textMuted:       dk ? "#52525b" : "#a1a1aa",
    textPlaceholder: dk ? "#3f3f46" : "#d4d4d8",
    navActiveBg:     dk ? "#fafafa" : "#18181b",
    navActiveText:   dk ? "#09090b" : "#fafafa",
    navHoverBg:      dk ? "#1f1f23" : "#f4f4f5",
    tagBg:           dk ? "#27272a" : "#e4e4e7",
    tagText:         dk ? "#a1a1aa" : "#52525b",
    tagHoverBg:      dk ? "#3f1a1e" : "#ffe4e6",
    tagHoverText:    dk ? "#fb7185" : "#be123c",
    popupBg:         dk ? "#18181b" : "#ffffff",
    popupBorder:     dk ? "#3f3f46" : "#d4d4d8",
    presetBorder:    dk ? "#3f3f46" : "#d4d4d8",
    presetText:      dk ? "#a1a1aa" : "#52525b",
    scrollThumb:     dk ? "#3f3f46" : "#d4d4d8",
    themeBtnBg:      dk ? "#27272a" : "#e4e4e7",
    editorBorder:    dk ? "#27272a" : "#d4d4d8",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor state
// ─────────────────────────────────────────────────────────────────────────────

interface EditorState {
  id?:        string;
  title:      string;
  content:    string;
  color:      NoteColor;
  tags:       string[];
  isPinned:   boolean;
  isArchived: boolean;
  isTrashed:  boolean;
  localOnly:  boolean;
  destructAt: number | null;
  bgImage?:   string | null;
}

const BLANK: EditorState = {
  title: "", content: "", color: "default", tags: [],
  isPinned: false, isArchived: false, isTrashed: false,
  localOnly: false, destructAt: null, bgImage: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Timer popup — rendered via Portal to escape overflow:hidden clipping
// ─────────────────────────────────────────────────────────────────────────────

function TimerPopup({
  anchorRef,
  destructAt,
  accent,
  T,
  onSet,
  onClear,
  onClose,
}: {
  anchorRef:  React.RefObject<HTMLButtonElement | null>;
  destructAt: number | null;
  accent:     string;
  T:          ReturnType<typeof tok>;
  onSet:      (ms: number) => void;
  onClear:    () => void;
  onClose:    () => void;
}) {
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Calculate position from anchor button on mount
  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({
      top:   r.bottom + window.scrollY + 6,
      right: window.innerWidth - r.right,
    });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Don't close if click is on anchor button
      if (anchorRef.current && anchorRef.current.contains(e.target as Node)) return;
      // Don't close if click is inside the popup
      if (popupRef.current && popupRef.current.contains(e.target as Node)) return;
      // Otherwise, close
      onClose();
    };
    // Small delay so the button click that opened this doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [anchorRef, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{   opacity: 0, y: -8,  scale: 0.96 }}
      transition={{ type: "spring", damping: 28, stiffness: 380 }}
      style={{
        position: "fixed",
        top:   pos.top,
        right: pos.right,
        zIndex: 9999,
        background:   T.popupBg,
        border:       `2px solid ${T.popupBorder}`,
        boxShadow:    "0 20px 60px rgba(0,0,0,0.5)",
        padding:      "16px",
        minWidth:     "290px",
        borderRadius: "2px",
      }}
    >
      {/* Section label */}
      <div style={{
        fontSize: "8px", fontWeight: 700, letterSpacing: "0.22em",
        textTransform: "uppercase", color: T.textMuted,
        fontFamily: "'IBM Plex Mono', monospace", marginBottom: "12px",
      }}>
        Delete after…
      </div>

      {/* Preset buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "6px", marginBottom: "14px" }}>
        {DESTRUCT_PRESETS.map(p => {
          const isActive = destructAt
            ? Math.abs(destructAt - Date.now() - p.ms) < 60_000 * 5
            : false;
          return (
            <button key={p.label}
              onClick={() => { onSet(Date.now() + p.ms); onClose(); }}
              style={{
                padding: "9px 4px",
                fontSize: "10px", fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                background:   isActive ? "#ef4444" : "transparent",
                border:       `1.5px solid ${isActive ? "#ef4444" : T.presetBorder}`,
                color:        isActive ? "#fff" : T.presetText,
                cursor:       "pointer",
                transition:   "all 0.12s",
                borderRadius: "1px",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background   = "#ef4444";
                  e.currentTarget.style.color        = "#fff";
                  e.currentTarget.style.borderColor  = "#ef4444";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background   = "transparent";
                  e.currentTarget.style.color        = T.presetText;
                  e.currentTarget.style.borderColor  = T.presetBorder;
                }
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: T.divider, marginBottom: "14px" }} />

      {/* Calendar date picker */}
      <Calendar
        mode="single"
        selected={destructAt ? new Date(destructAt) : undefined}
        onSelect={date => {
          if (!date) return;
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          onSet(end.getTime());
          onClose();
        }}
        disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
      />

      {/* Clear timer */}
      {destructAt && (
        <button
          onClick={() => { onClear(); onClose(); }}
          style={{
            width: "100%", marginTop: "12px", padding: "8px",
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em",
            textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace",
            background: "transparent", border: `1.5px solid #ef444450`,
            color: "#ef4444", cursor: "pointer", borderRadius: "1px",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#ef4444"; }}
        >
          ✕ Remove timer
        </button>
      )}

      {/* Current timer display */}
      {destructAt && (
        <div style={{
          marginTop: "10px", textAlign: "center",
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
          fontFamily: "'IBM Plex Mono', monospace", color: "#ef4444",
        }}>
          ◷ Set for: {new Date(destructAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </motion.div>,
    document.body
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Note editor modal
// ─────────────────────────────────────────────────────────────────────────────

function NoteEditor({
  initial, onSave, onClose, theme,
}: {
  initial: EditorState;
  onSave:  (s: EditorState) => Promise<void>;
  onClose: () => void;
  theme:   Theme;
}) {
  const [s,          setS]          = useState<EditorState>({ ...initial });
  const sRef         = useRef(s);
  sRef.current       = s;

  const [viewMode,   setViewMode]   = useState<ViewMode>("write");
  const [saving,     setSaving]     = useState(false);
  const [tagInput,   setTagInput]   = useState("");
  const [showTimer,  setShowTimer]  = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fileRef    = useRef<HTMLInputElement>(null);
  const timerBtnRef = useRef<HTMLButtonElement>(null);
  const T = tok(theme);

  const upd = useCallback(<K extends keyof EditorState>(k: K, v: EditorState[K]) => {
    setS(prev => ({ ...prev, [k]: v }));
  }, []);

  const cfg = NOTE_COLORS[s.color] ?? NOTE_COLORS.default;

  // ── Tags ──
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !sRef.current.tags.includes(t))
      setS(prev => ({ ...prev, tags: [...prev.tags, t] }));
    setTagInput("");
  };
  const removeTag = (t: string) =>
    setS(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

  // ── Background image ──
  const handleBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Image too large.", "Max 2 MB."); return; }
    const r = new FileReader();
    r.onload = () => upd("bgImage", r.result as string);
    r.readAsDataURL(f);
    e.target.value = "";
  };

  // ── Save ──
  const save = useCallback(async (overrides?: Partial<EditorState>) => {
    const current = { ...sRef.current, ...overrides };
    if (!current.title.trim() && !current.content.trim()) { onClose(); return; }
    setSaving(true);
    try {
      await onSave(current);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  }, [onClose, onSave]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
      if (e.key === "Escape" && !fullscreen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, onClose, fullscreen]);

  const words = s.content.split(/\s+/).filter(Boolean).length;

  const editorBgStyle: React.CSSProperties = s.bgImage
    ? {
        backgroundImage: `linear-gradient(${theme === "dark" ? "rgba(0,0,0,0.83)" : "rgba(255,255,255,0.89)"},${theme === "dark" ? "rgba(0,0,0,0.83)" : "rgba(255,255,255,0.89)"}),url(${s.bgImage})`,
        backgroundSize: "cover", backgroundPosition: "center",
      }
    : { backgroundColor: theme === "dark" ? cfg.cardDark : cfg.cardLight };

  const tbtn = (active: boolean, activeColor?: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "5px",
    padding: "0 12px", height: "100%",
    border: "none", cursor: "pointer",
    borderRight: `1px solid ${T.toolbarBorder}`,
    background:  active ? (activeColor ? `${activeColor}20` : T.navActiveBg) : "transparent",
    color:       active ? (activeColor ?? T.navActiveText) : T.textSecondary,
    fontFamily:  "'IBM Plex Mono', monospace",
    fontSize: "9px", fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase",
    transition: "background 0.12s, color 0.12s",
    whiteSpace: "nowrap",
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: fullscreen ? "0" : "20px",
        backgroundColor: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0,  opacity: 1, scale: 1    }}
        exit={{   y: 20,  opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", damping: 32, stiffness: 400 }}
        style={{
          display: "flex", flexDirection: "column",
          width: "100%", maxWidth: fullscreen ? "none" : "800px",
          ...(fullscreen
            ? { position: "fixed", inset: "10px", maxHeight: "none" }
            : { maxHeight: "88vh" }
          ),
          ...editorBgStyle,
          border:      `1px solid ${T.editorBorder}`,
          borderTop:   `3.5px solid ${cfg.accent}`,
          boxShadow:   "0 32px 80px rgba(0,0,0,0.6)",
          // CRITICAL FIX: overflow visible on root so timer portal works,
          // inner sections handle their own overflow
          overflow: "visible",
        }}
      >
        {/* ── Toolbar — no overflow:hidden here ── */}
        <div style={{
          display: "flex", alignItems: "stretch", height: "44px", flexShrink: 0,
          background: T.toolbarBg, borderBottom: `1px solid ${T.toolbarBorder}`,
          // Clip only the toolbar itself
          overflow: "hidden",
          position: "relative", zIndex: 10,
        }}>
          {/* Color swatches */}
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "0 12px", borderRight: `1px solid ${T.toolbarBorder}`,
          }}>
            {COLOR_ORDER.map(id => {
              const c      = NOTE_COLORS[id];
              const active = s.color === id;
              return (
                <button key={id} onClick={() => upd("color", id)} title={c.label}
                  style={{
                    width: active ? "15px" : "11px", height: active ? "15px" : "11px",
                    borderRadius: "50%", background: c.dot, border: "none",
                    cursor: "pointer", flexShrink: 0, transition: "all 0.14s",
                    outline:       active ? `2px solid ${T.textPrimary}` : "none",
                    outlineOffset: "2px",
                    boxShadow:     active ? `0 0 0 3px ${c.dot}30` : "none",
                  }}
                />
              );
            })}
          </div>

          {/* View mode */}
          {(["write","split","preview"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={tbtn(viewMode === m)}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "stretch", marginLeft: "auto" }}>
            <button onClick={() => setS(prev => ({ ...prev, isPinned: !prev.isPinned }))}
              style={tbtn(s.isPinned)} title={s.isPinned ? "Unpin" : "Pin"}>
              ◈ {s.isPinned ? "Pinned" : "Pin"}
            </button>

            <button onClick={() => setS(prev => ({ ...prev, localOnly: !prev.localOnly }))}
              style={tbtn(s.localOnly, "#d97706")} title="Toggle local-only / cloud sync">
              {s.localOnly ? "⬡ Local" : "☁ Cloud"}
            </button>

            {/* Timer button — ref for portal positioning */}
            <button
              ref={timerBtnRef}
              onClick={() => setShowTimer(v => !v)}
              style={tbtn(!!s.destructAt, "#ef4444")} title="Self-destruct timer"
            >
              ◷ {s.destructAt ? "Timed" : "Timer"}
            </button>

            {/* Background image */}
            <button onClick={() => fileRef.current?.click()}
              style={{ ...tbtn(!!s.bgImage), color: s.bgImage ? cfg.accent : T.textSecondary }}
              title="Background image (stored locally only)">
              ⊞ Bg
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBg} />
            {s.bgImage && (
              <button onClick={() => upd("bgImage", null)}
                style={{ ...tbtn(false), color: "#ef4444", padding: "0 8px" }}>✕</button>
            )}

            {/* Fullscreen */}
            <button onClick={() => setFullscreen(v => !v)}
              style={{ ...tbtn(false), fontSize: "13px", padding: "0 10px" }}>
              {fullscreen ? "⊠" : "⊡"}
            </button>

            {/* Close */}
            <button onClick={onClose}
              style={{ ...tbtn(false), borderRight: "none", color: T.textMuted }}
              onMouseEnter={e => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Title ── */}
        <input
          value={s.title}
          onChange={e => upd("title", e.target.value)}
          placeholder="Untitled"
          autoFocus
          className="np-title-input"
          style={{
            padding: "20px 26px 8px", fontSize: "26px", fontWeight: 900,
            fontFamily: "'Syne', system-ui, sans-serif",
            letterSpacing: "-0.03em", lineHeight: 1.2,
            color: T.textPrimary, background: "transparent",
            border: "none", outline: "none", flexShrink: 0,
          }}
        />

        {/* ── Write / Split / Preview ── */}
        <div style={{
          display: "flex", flex: 1, minHeight: 0, overflow: "hidden",
          borderTop: `1px solid ${T.divider}30`,
        }}>
          {(viewMode === "write" || viewMode === "split") && (
            <textarea
              value={s.content}
              onChange={e => upd("content", e.target.value)}
              placeholder="Start writing…   Markdown supported."
              className="np-textarea np-scrollbar"
              style={{
                flex: 1, minHeight: 0, padding: "16px 26px",
                resize: "none", fontSize: "12.5px", lineHeight: 2,
                fontFamily: "'IBM Plex Mono', monospace",
                color: T.textSecondary, background: "transparent",
                border: "none",
                borderRight: viewMode === "split" ? `1px solid ${T.divider}` : "none",
                outline: "none",
              }}
            />
          )}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className="np-scrollbar" style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              padding: "16px 26px",
              ...(viewMode === "split" ? { maxWidth: "50%" } : {}),
            }}>
              {s.content
                ? <div className="np-prose" style={{ color: T.textSecondary }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                  </div>
                : <p style={{ fontSize: "12px", fontStyle: "italic", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>
                    Nothing to preview yet.
                  </p>
              }
            </div>
          )}
        </div>

        {/* ── Tag bar ── */}
        <div style={{
          padding: "7px 16px", borderTop: `1px solid ${T.toolbarBorder}`,
          display: "flex", alignItems: "center", gap: "5px",
          flexWrap: "wrap", background: T.tagBarBg, flexShrink: 0, minHeight: "38px",
        }}>
          <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: T.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}>#</span>
          {s.tags.map(t => (
            <span key={t}
              onClick={() => removeTag(t)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                fontFamily: "'IBM Plex Mono', monospace",
                padding: "3px 8px", background: T.tagBg, color: T.tagText,
                cursor: "pointer", transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.tagHoverBg; e.currentTarget.style.color = T.tagHoverText; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.tagBg; e.currentTarget.style.color = T.tagText; }}
            >
              {t} <span style={{ opacity: 0.6 }}>×</span>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); }
              if (e.key === "Backspace" && !tagInput && sRef.current.tags.length > 0)
                setS(prev => ({ ...prev, tags: prev.tags.slice(0, -1) }));
            }}
            placeholder="add tag, press Enter"
            className="np-search"
            style={{
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              fontFamily: "'IBM Plex Mono', monospace",
              color: T.textSecondary, background: "transparent", border: "none", outline: "none",
              minWidth: "130px",
            }}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "9px 16px", borderTop: `1px solid ${T.toolbarBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.footerBg, flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "14px",
            fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
            fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted,
          }}>
            <span>{words} words</span>
            {s.localOnly  && <span style={{ color: "#d97706" }}>⬡ Local</span>}
            {s.destructAt && <span style={{ color: "#ef4444" }}>◷ Timed</span>}
            <span style={{ opacity: 0.35 }}>⌘S · Esc</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {(["Cancel","Archive","Bin"] as const).map(label => (
              <button key={label}
                onClick={() => {
                  if (label === "Cancel")  onClose();
                  if (label === "Archive") save({ isArchived: true });
                  if (label === "Bin")     save({ isTrashed: true });
                }}
                style={{
                  padding: "8px 11px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.13em",
                  textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: label === "Bin" ? "#ef444660" : T.textMuted,
                  transition: "color 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = label === "Bin" ? "#ef4444" : T.textPrimary)}
                onMouseLeave={e => (e.currentTarget.style.color = label === "Bin" ? "#ef444660" : T.textMuted)}
              >
                {label}
              </button>
            ))}

            <button
              onClick={() => save()}
              disabled={saving}
              style={{
                padding: "8px 20px", marginLeft: "6px",
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase",
                fontFamily: "'IBM Plex Mono', monospace",
                background: cfg.accent, color: "#fff",
                border: "none", cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.55 : 1, transition: "opacity 0.12s",
              }}
            >
              {saving ? "Saving…" : "Save →"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Timer popup rendered via portal — escapes overflow:hidden */}
      <AnimatePresence>
        {showTimer && (
          <TimerPopup
            anchorRef={timerBtnRef}
            destructAt={s.destructAt}
            accent={cfg.accent}
            T={T}
            onSet={ms  => setS(prev => ({ ...prev, destructAt: ms }))}
            onClear={() => setS(prev => ({ ...prev, destructAt: null }))}
            onClose={() => setShowTimer(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Note card
// ─────────────────────────────────────────────────────────────────────────────

function NoteCard({ note, index, onEdit, theme, onRestore, onDeletePermanently }: {
  note:   PersonalNote;
  index:  number;
  onEdit: (n: PersonalNote) => void;
  theme:  Theme;
  onRestore?: (id: string) => void;
  onDeletePermanently?: (id: string) => void;
}) {
  const destructMs = toMs(note.destructAt);
  const countdown  = useCountdown(destructMs);
  const bgImage    = readBg(note.id);
  const cfg        = NOTE_COLORS[(note.color as NoteColor)] ?? NOTE_COLORS.default;
  const expiring   = destructMs ? destructMs - Date.now() < 3_600_000 : false;
  const body       = (note.content?.slice(0, 200) ?? "") + ((note.content?.length ?? 0) > 200 ? "…" : "");
  const T          = tok(theme);

  return (
    <motion.article
      layoutId={note.id}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{   opacity: 0, y: -6,  scale: 0.97 }}
      whileHover={{ y: -3, transition: { duration: 0.14 } }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.022, 0.28) }}
      onClick={() => !note.isTrashed && onEdit(note)}
      style={{
        position: "relative",
        cursor: note.isTrashed ? "default" : "pointer",
        overflow: "hidden",
        backgroundColor: bgImage ? undefined : (theme === "dark" ? cfg.cardDark : cfg.cardLight),
        backgroundImage: bgImage
          ? `linear-gradient(${theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.87)"},${theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.87)"}),url(${bgImage})`
          : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        border: `1px solid ${expiring ? "#ef4444" : T.cardBorder}`,
        borderTop: `3px solid ${cfg.accent}`,
        boxShadow: expiring ? `0 0 0 1px #ef444430` : "none",
        transition: "box-shadow 0.14s, border-color 0.14s",
      }}
    >
      <div style={{
        padding: "12px 14px",
        opacity: note.isTrashed ? 0.2 : 1,
        transition: "opacity 0.2s"
      }}>
        {/* Label row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "8px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            fontSize: "7px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            fontFamily: "'IBM Plex Mono', monospace",
            padding: "2px 7px", background: cfg.labelBg, color: cfg.labelText,
          }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
            {cfg.label}
          </span>
          <div style={{ display: "flex", gap: "3px" }}>
            {note.isPinned && (
              <span style={{ fontSize: "7px", fontWeight: 700, padding: "2px 5px", fontFamily: "'IBM Plex Mono', monospace", background: theme === "dark" ? "#fafafa" : "#18181b", color: theme === "dark" ? "#09090b" : "#fafafa" }}>◈</span>
            )}
            {note.localOnly && (
              <span style={{ fontSize: "7px", fontWeight: 700, padding: "2px 5px", fontFamily: "'IBM Plex Mono', monospace", background: "#d97706", color: "#fff" }}>⬡</span>
            )}
          </div>
        </div>

        {/* Title */}
        {note.title && (
          <h3 style={{
            fontSize: "14px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.3,
            fontFamily: "'Syne', system-ui, sans-serif",
            color: T.textPrimary, marginBottom: "6px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {note.title}
          </h3>
        )}

        {/* Body */}
        {body && (
          <p style={{
            fontSize: "11px", lineHeight: 1.7,
            fontFamily: "'IBM Plex Mono', monospace",
            color: T.textSecondary,
            display: "-webkit-box", WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical", overflow: "hidden",
            marginBottom: "8px",
          }}>
            {body}
          </p>
        )}

        {/* Tags */}
        {(note.tags?.length ?? 0) > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
            {note.tags.slice(0, 4).map(t => (
              <span key={t} style={{
                fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: "'IBM Plex Mono', monospace",
                padding: "2px 6px", border: `1px solid ${T.divider}`, color: T.textMuted,
              }}>#{t}</span>
            ))}
            {(note.tags?.length ?? 0) > 4 && (
              <span style={{ fontSize: "8px", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>
                +{note.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Countdown */}
        {countdown && (
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            fontFamily: "'IBM Plex Mono', monospace",
            color: expiring ? "#ef4444" : T.textMuted,
            borderTop: `1px solid ${T.divider}`, paddingTop: "8px", marginTop: "4px",
          }}>
            ◷ {countdown}
          </div>
        )}
      </div>

      {note.isTrashed && (
        <div style={{
          position: 'absolute', inset: 0,
          background: theme === 'dark' ? 'rgba(10, 10, 11, 0.8)' : 'rgba(244, 244, 245, 0.8)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', padding: '12px'
        }}>
          <p style={{
            fontSize: "9px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
            color: T.textMuted, letterSpacing: "0.1em", textTransform: 'uppercase'
          }}>
            In Bin
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onRestore?.(note.id); }}
              style={{
                background: T.navActiveBg,
                color: T.navActiveText,
                border: 'none',
                padding: '6px 12px',
                fontSize: '9px',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Restore
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeletePermanently?.(note.id); }}
              style={{
                background: 'transparent',
                border: `1px solid #ef444480`,
                color: '#ef4444',
                padding: '6px 12px',
                fontSize: '9px',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444' }}
            >
              Delete Forever
            </button>
          </div>
        </div>
      )}
    </motion.article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PersonalNotesPage() {
  const router = useRouter();
  const { user, isGuest, loading: authLoading } = useAuth();

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return readTheme() ?? "dark";
  });

  const [notes,     setNotes]     = useState<PersonalNote[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editor,    setEditor]    = useState<EditorState | null>(null);
  const [search,    setSearch]    = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [filter,    setFilter]    = useState<FilterType>("all");
  const [layout,    setLayout]    = useState<LayoutMode>("masonry");

  const T = tok(theme);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    writeTheme(next);
  };

  // ── Purge expired notes ──
  const purge = useCallback((list: PersonalNote[]): PersonalNote[] => {
    const now  = Date.now();
    const dead = list.filter(n => {
      const updMs  = n.updatedAt ? new Date(n.updatedAt as any).getTime() : 0;
      const destMs = toMs(n.destructAt);
      return (n.isTrashed && updMs && now - updMs > 30 * 86_400_000) ||
             (destMs !== null && destMs <= now);
    });
    if (!dead.length) return list;
    dead.forEach(n => {
      writeBg(n.id, null);
      if (!n.localOnly && user && !isGuest)
        deleteDoc(doc(db, "users", user.uid, "personal_notes", n.id)).catch(() => {});
    });
    const sdCount = dead.filter(n => { const d = toMs(n.destructAt); return d !== null && d <= now; }).length;
    if (sdCount) toast.success(`${sdCount} note${sdCount > 1 ? "s" : ""} self-destructed.`);
    return list.filter(n => !dead.some(d => d.id === n.id));
  }, [user, isGuest]);

  // ── Subscription ──
  useEffect(() => {
    if (authLoading) return;

    const local = purge(readLocalNotes());
    writeLocalNotes(local);

    if (isGuest || !user) {
      setNotes(local);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "personal_notes"),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(q, snap => {
      const cloud      = purge(snap.docs.map(d => ({ ...d.data(), id: d.id } as PersonalNote)));
      const freshLocal = purge(readLocalNotes()).filter(n => n.localOnly);
      const cloudIds   = new Set(cloud.map(n => n.id));
      setNotes([...freshLocal.filter(n => !cloudIds.has(n.id)), ...cloud]);
      setLoading(false);
    }, err => {
      console.error("Notes snapshot:", err);
      setLoading(false);
    });

    return unsub;
  }, [user, isGuest, authLoading, purge]);

  // ── Save ──
  const saveNote = useCallback(async (s: EditorState) => {
    const isNew = !s.id;
    if (s.bgImage !== undefined) writeBg(s.id ?? `local_${Date.now()}`, s.bgImage ?? null);

    const basePayload = {
      title:      s.title.trim(),
      content:    s.content,
      color:      (s.color || "default") as PersonalNoteColor,
      tags:       s.tags ?? [],
      isPinned:   !!s.isPinned,
      localOnly:  !!s.localOnly,
      isArchived: !!s.isArchived,
      isTrashed:  !!s.isTrashed,
    };

    if (s.localOnly || isGuest) {
      const now      = new Date();
      // For local notes, destructAt should be a number (millisecond timestamp)
      const payload = { ...basePayload, destructAt: s.destructAt };

      const existing = readLocalNotes();
      const updated: PersonalNote[] = isNew
        ? [{ ...payload, id: `local_${Date.now()}`, ownerId: "local", createdAt: now, updatedAt: now } as unknown as PersonalNote, ...existing]
        : existing.map(n => n.id === s.id ? ({ ...n, ...payload, updatedAt: now } as PersonalNote) : n);
      writeLocalNotes(updated);
      setNotes(readLocalNotes());
      return;
    }

    if (!user) return;

    // For Firestore, destructAt should be a Date object to be stored as a Timestamp
    const firestorePayload = {
        ...basePayload,
        destructAt: s.destructAt ? new Date(s.destructAt) : null,
    };

    if (isNew) {
      await addDoc(collection(db, "users", user.uid, "personal_notes"), {
        ...firestorePayload, ownerId: user.uid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "users", user.uid, "personal_notes", s.id!), {
        ...firestorePayload, updatedAt: serverTimestamp(),
      });
    }
  }, [isGuest, user, setNotes]);

  const handleRestore = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    if (note.localOnly || isGuest) {
      const updatedNotes = readLocalNotes().map(n => 
        n.id === noteId ? { ...n, isTrashed: false, updatedAt: new Date() } : n
      );
      writeLocalNotes(updatedNotes);
      setNotes(updatedNotes);
    } else if (user) {
      await updateDoc(doc(db, "users", user.uid, "personal_notes", noteId), {
        isTrashed: false,
        updatedAt: serverTimestamp(),
      });
    }
    toast.success("Note restored.");
  }, [notes, isGuest, user]);

  const handlePermanentDelete = useCallback(async (noteId: string) => {
    if (typeof window !== 'undefined' && !window.confirm("Are you sure you want to permanently delete this note? This action cannot be undone.")) {
      return;
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Clean up local background image
    writeBg(noteId, null);

    if (note.localOnly || isGuest) {
      const updatedNotes = readLocalNotes().filter(n => n.id !== noteId);
      writeLocalNotes(updatedNotes);
      setNotes(updatedNotes);
    } else if (user) {
      await deleteDoc(doc(db, "users", user.uid, "personal_notes", noteId));
    }
    toast.destructive("Note permanently deleted.");
  }, [notes, isGuest, user]);

  // ── Filtering ──
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter(n => {
      if (q && !n.title?.toLowerCase().includes(q) &&
               !n.content?.toLowerCase().includes(q) &&
               !n.tags?.some(t => t.includes(q))) return false;
      if (activeTag && !n.tags?.includes(activeTag)) return false;
      switch (filter) {
        case "all":       return !n.isArchived && !n.isTrashed;
        case "pinned":    return  n.isPinned   && !n.isTrashed;
        case "reminders": return !!n.destructAt && !n.isTrashed;
        case "archive":   return  n.isArchived  && !n.isTrashed;
        case "bin":       return  n.isTrashed;
      }
    });
  }, [notes, search, activeTag, filter]);

  const pinned  = useMemo(() => visible.filter(n =>  n.isPinned && !n.isArchived && !n.isTrashed), [visible]);
  const rest    = useMemo(() => visible.filter(n => !n.isPinned || n.isArchived  ||  n.isTrashed), [visible]);
  const allTags = useMemo(() => [...new Set(notes.flatMap(n => n.tags ?? []))].sort(), [notes]);

  const counts: Record<FilterType, number> = {
    all:       notes.filter(n => !n.isArchived && !n.isTrashed).length,
    pinned:    notes.filter(n =>  n.isPinned   && !n.isTrashed).length,
    reminders: notes.filter(n => !!n.destructAt && !n.isTrashed).length,
    archive:   notes.filter(n =>  n.isArchived  && !n.isTrashed).length,
    bin:       notes.filter(n =>  n.isTrashed).length,
  };

  const NAV: { id: FilterType; label: string }[] = [
    { id: "all",       label: "All"     },
    { id: "pinned",    label: "Pinned"  },
    { id: "reminders", label: "Timers"  },
    { id: "archive",   label: "Archive" },
    { id: "bin",       label: "Bin"     },
  ];

  const openNote = (n: PersonalNote) => {
    setEditor({
      id:         n.id,
      title:      n.title      ?? "",
      content:    n.content    ?? "",
      color:      (n.color as NoteColor) ?? "default",
      tags:       n.tags       ?? [],
      isPinned:   !!n.isPinned,
      isArchived: !!n.isArchived,
      isTrashed:  !!n.isTrashed,
      localOnly:  !!n.localOnly,
      destructAt: toMs(n.destructAt),
      bgImage:    readBg(n.id),
    });
  };

  const sectionDivider = (label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
      <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "1px", background: T.divider }} />
    </div>
  );

  const masonryStyle: React.CSSProperties = { columnCount: 4, columnGap: "14px" };
  const listStyle:    React.CSSProperties = { display: "flex", flexDirection: "column", gap: "10px", maxWidth: "720px" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .np-root*,.np-root *::before,.np-root *::after{box-sizing:border-box;margin:0;padding:0}
        .np-root{font-family:'DM Sans',system-ui,sans-serif}
        .np-title-input::placeholder{color:${T.textPlaceholder}!important}
        .np-textarea::placeholder{color:${T.textPlaceholder}!important}
        .np-search::placeholder{color:${T.textMuted}}
        .np-scrollbar::-webkit-scrollbar{width:3px}
        .np-scrollbar::-webkit-scrollbar-track{background:transparent}
        .np-scrollbar::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px}
        .np-noscroll::-webkit-scrollbar{display:none}
        .np-noscroll{-ms-overflow-style:none;scrollbar-width:none}
        .np-masonry-item{break-inside:avoid;margin-bottom:14px;display:inline-block;width:100%}
        .np-prose h1,.np-prose h2,.np-prose h3{font-family:'Syne',system-ui,sans-serif!important;font-weight:900;margin:14px 0 6px}
        .np-prose p{margin-bottom:10px;line-height:1.7;font-size:13px}
        .np-prose code{font-family:'IBM Plex Mono',monospace!important;font-size:11px;padding:1px 5px;background:${T.tagBg};border-radius:2px}
        .np-prose ul,.np-prose ol{padding-left:18px;margin-bottom:10px}
        .np-prose li{margin-bottom:4px;font-size:13px;line-height:1.6}
        .np-prose a{color:#22d3ee;text-decoration:underline}
        @media(max-width:1200px){.np-m4{column-count:3!important}}
        @media(max-width:900px){.np-m4{column-count:2!important}}
        @media(max-width:600px){.np-m4{column-count:1!important}}
        @keyframes np-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
      `}</style>

      <div className="np-root" style={{ display: "flex", height: "100vh", background: T.pageBg, overflow: "hidden" }}>

        {/* ══════════ SIDEBAR ══════════ */}
        <aside style={{
          width: "210px", flexShrink: 0,
          background: T.sidebarBg, borderRight: `3px solid ${T.sidebarBorder}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Brand */}
          <div style={{ padding: "18px", borderBottom: `3px solid ${T.sidebarBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Image src="/logo.png" alt="Alcyone" width={24} height={24} style={{ borderRadius: "4px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: 900, fontFamily: "'Syne', system-ui, sans-serif", letterSpacing: "-0.01em", color: T.textPrimary, lineHeight: 1.1 }}>Notes</div>
                <div style={{ fontSize: "7.5px", fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em", color: T.textMuted, marginTop: "2px" }}>by Alcyone Secure</div>
              </div>
            </div>
          </div>

          {/* New note */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.divider}` }}>
            <button
              onClick={() => setEditor({ ...BLANK })}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 14px", background: T.navActiveBg, color: T.navActiveText,
                border: "none", cursor: "pointer",
                fontFamily: "'Syne', system-ui, sans-serif",
                fontSize: "9px", fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase",
                transition: "opacity 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.82")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <span>New Note</span>
              <span style={{ fontSize: "18px", fontWeight: 300, lineHeight: 1 }}>+</span>
            </button>
          </div>

          {/* Nav */}
          <nav style={{ borderBottom: `3px solid ${T.sidebarBorder}` }}>
            {NAV.map(({ id, label }) => {
              const active = filter === id && !activeTag;
              return (
                <button key={id}
                  onClick={() => { setFilter(id); setActiveTag(null); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 18px",
                    background: active ? T.navActiveBg : "transparent",
                    color:      active ? T.navActiveText : T.textSecondary,
                    border: "none", cursor: "pointer",
                    fontFamily: "'Syne', system-ui, sans-serif",
                    fontSize: "9px", fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase",
                    borderBottom: `1px solid ${T.divider}`,
                    transition: "background 0.1s, color 0.1s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.navHoverBg; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span>{label}</span>
                  {counts[id] > 0 && (
                    <span style={{ fontSize: "8px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: active ? `${T.navActiveText}70` : T.textMuted }}>
                      {counts[id]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Labels */}
          {allTags.length > 0 && (
            <div style={{ flex: 1, overflowY: "auto" }} className="np-noscroll">
              <div style={{ padding: "12px 18px 6px" }}>
                <span style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>Labels</span>
              </div>
              {allTags.map(tag => {
                const active = activeTag === tag;
                return (
                  <button key={tag}
                    onClick={() => { setActiveTag(active ? null : tag); setFilter("all"); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 18px",
                      background: active ? T.navActiveBg : "transparent",
                      color:      active ? T.navActiveText : T.textSecondary,
                      border: "none", cursor: "pointer",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontSize: "11px", fontWeight: 500,
                      borderBottom: `1px solid ${T.divider}20`,
                      transition: "background 0.1s, color 0.1s",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.navHoverBg; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: active ? T.navActiveText : T.textMuted, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tag}</span>
                  </button>
                );
              })}
            </div>
          )}
          {allTags.length === 0 && <div style={{ flex: 1 }} />}

          {/* Sidebar footer */}
          <div style={{ borderTop: `3px solid ${T.sidebarBorder}` }}>
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>
                {theme === "dark" ? "Dark" : "Light"}
              </span>
              <button
                onClick={toggleTheme}
                style={{ display: "flex", alignItems: "center", background: T.themeBtnBg, border: "none", cursor: "pointer", borderRadius: "12px", padding: "2px", transition: "background 0.2s" }}
              >
                {(["dark","light"] as Theme[]).map(t => (
                  <span key={t} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "22px", height: "18px", borderRadius: "10px", fontSize: "10px",
                    background: theme === t ? (t === "dark" ? "#27272a" : "#ffffff") : "transparent",
                    transition: "background 0.2s",
                    boxShadow: theme === t ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                  }}>{t === "dark" ? "◑" : "○"}</span>
                ))}
              </button>
            </div>
            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 18px", background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "8px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
                color: T.textMuted, transition: "color 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.textPrimary)}
              onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              <span>Workspaces</span>
            </button>
          </div>
        </aside>

        {/* ══════════ MAIN ══════════ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <header style={{ flexShrink: 0, display: "flex", alignItems: "stretch", background: T.headerBg, borderBottom: `3px solid ${T.headerBorder}`, height: "52px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 24px", borderRight: `1px solid ${T.divider}`, minWidth: "200px" }}>
              <h1 style={{ fontSize: "11px", fontWeight: 900, fontFamily: "'Syne', system-ui, sans-serif", letterSpacing: "0.18em", textTransform: "uppercase", color: T.textPrimary, whiteSpace: "nowrap" }}>
                {filter === "all" && !activeTag ? "All Notes" :
                 filter === "pinned"    ? "Pinned"  :
                 filter === "reminders" ? "Timers"  :
                 filter === "archive"   ? "Archive" :
                 filter === "bin"       ? "Bin"     : `#${activeTag}`}
              </h1>
              <span style={{ fontSize: "9px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>{visible.length}</span>
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 16px 0 38px", borderRight: `1px solid ${T.divider}`, position: "relative" }}>
              <span style={{ position: "absolute", left: "14px", color: T.textMuted, fontSize: "16px", pointerEvents: "none" }}>⌕</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="np-search"
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: "12px", fontWeight: 500, fontFamily: "'DM Sans', system-ui, sans-serif", color: T.textPrimary }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "12px", padding: "0 4px" }}>✕</button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "stretch", borderRight: `1px solid ${T.divider}` }}>
              {(["masonry","list"] as LayoutMode[]).map((l, i) => (
                <button key={l} onClick={() => setLayout(l)}
                  style={{
                    padding: "0 14px",
                    background: layout === l ? T.navActiveBg : "transparent",
                    color:      layout === l ? T.navActiveText : T.textMuted,
                    border: "none", cursor: "pointer",
                    borderLeft: i > 0 ? `1px solid ${T.divider}` : "none",
                    fontSize: "14px", transition: "background 0.1s, color 0.1s",
                  }}>
                  {l === "masonry" ? "⊞" : "≡"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setEditor({ ...BLANK })}
              style={{
                padding: "0 22px", background: T.navActiveBg, color: T.navActiveText,
                border: "none", cursor: "pointer",
                fontFamily: "'Syne', system-ui, sans-serif",
                fontSize: "9px", fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase",
                whiteSpace: "nowrap", transition: "opacity 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >+ New</button>
          </header>

          {/* Color legend bar */}
          <div style={{ flexShrink: 0, background: T.sidebarBg, borderBottom: `1px solid ${T.divider}`, padding: "6px 24px", display: "flex", alignItems: "center", gap: "6px", overflowX: "auto" }} className="np-noscroll">
            <span style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted, flexShrink: 0, marginRight: "4px" }}>Color</span>
            {COLOR_ORDER.map(id => {
              const c = NOTE_COLORS[id];
              return (
                <span key={id} style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  fontSize: "7px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: "2px 7px", background: c.labelBg, color: c.labelText, flexShrink: 0,
                }}>
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: c.dot }} />
                  {c.label}
                </span>
              );
            })}
          </div>

          {/* Notes area */}
          <main style={{ flex: 1, overflowY: "auto", padding: "22px" }} className="np-scrollbar">
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "80px" }}>
                <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "'Syne', system-ui, sans-serif", color: T.textMuted, animation: "np-pulse 1.5s ease-in-out infinite" }}>
                  Loading…
                </span>
              </div>
            ) : visible.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "80px", gap: "14px" }}
              >
                <span style={{ fontSize: "52px", lineHeight: 1, color: T.textMuted, opacity: 0.2, userSelect: "none" }}>◇</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>
                  {search ? "No results found" : "Nothing here yet"}
                </span>
                {filter === "all" && !search && (
                  <button
                    onClick={() => setEditor({ ...BLANK })}
                    style={{ marginTop: "8px", padding: "10px 28px", background: T.navActiveBg, color: T.navActiveText, border: "none", cursor: "pointer", fontFamily: "'Syne', system-ui, sans-serif", fontSize: "9px", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", transition: "opacity 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    + Create your first note
                  </button>
                )}
              </motion.div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div style={{ marginBottom: "26px" }}>
                    {sectionDivider("◈ Pinned")}
                    <div className={layout === "masonry" ? "np-m4" : undefined} style={layout === "masonry" ? masonryStyle : listStyle}>
                      <AnimatePresence>
                        {pinned.map((n, i) => (
                          <div key={n.id} className={layout === "masonry" ? "np-masonry-item" : undefined}>
                            <NoteCard note={n} index={i} theme={theme} onEdit={openNote} onRestore={handleRestore} onDeletePermanently={handlePermanentDelete} />
                          </div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
                {rest.length > 0 && (
                  <div>
                    {pinned.length > 0 && sectionDivider("Other notes")}
                    <div className={layout === "masonry" ? "np-m4" : undefined} style={layout === "masonry" ? masonryStyle : listStyle}>
                      <AnimatePresence>
                        {rest.map((n, i) => (
                          <div key={n.id} className={layout === "masonry" ? "np-masonry-item" : undefined}>
                            <NoteCard note={n} index={i + pinned.length} theme={theme} onEdit={openNote} onRestore={handleRestore} onDeletePermanently={handlePermanentDelete} />
                          </div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {editor && (
          <NoteEditor
            initial={editor}
            onSave={saveNote}
            onClose={() => setEditor(null)}
            theme={theme}
          />
        )}
      </AnimatePresence>
    </>
  );
}
