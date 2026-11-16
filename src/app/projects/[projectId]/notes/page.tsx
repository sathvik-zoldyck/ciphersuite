"use client";

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold, Italic, Link2, List, Code, Eye,
  Code2 as SplitIcon, Copy, CheckCheck, Minus,
  Quote, ListOrdered, Terminal, Heading2, Heading3,
  Plus, Trash2, FileText, ChevronDown, Pencil,
  Maximize2, Minimize2,
} from "@/components/icons";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/hooks/use-collection";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NoteColor = "default" | "red" | "orange" | "yellow" | "green" | "blue";
type ViewMode  = "edit" | "split" | "preview";
type SaveState = "idle" | "saving" | "saved";

interface ProjectNote {
  id:        string;
  projectId: string;
  title:     string;
  content:   string;
  color?:    NoteColor;
  createdAt: any;
  updatedAt: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color config — hex only, zero Tailwind dynamic classes
// ─────────────────────────────────────────────────────────────────────────────

const COLORS: Record<NoteColor, { label: string; hex: string }> = {
  default: { label: "Default",   hex: "#475569" },
  red:     { label: "Critical",  hex: "#ef4444" },
  orange:  { label: "Important", hex: "#f97316" },
  yellow:  { label: "Note",      hex: "#eab308" },
  green:   { label: "Done",      hex: "#22c55e" },
  blue:    { label: "Info",      hex: "#3b82f6" },
};

const COLOR_KEYS = Object.keys(COLORS) as NoteColor[];

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "engagement", label: "Engagement Notes",
    content: `## Engagement Overview\n\n**Target:** \n**Scope:** \n**Dates:** \n\n### Attack Surface\n- \n\n### Commands Run\n\`\`\`bash\n\n\`\`\`\n\n### Findings Drafts\n- \n\n### Follow-up\n- [ ] \n`,
  },
  {
    id: "recon", label: "Recon Notes",
    content: `## Reconnaissance\n\n### DNS & Infrastructure\n- **Nameservers:** \n- **MX Records:** \n- **TXT Records:** \n\n### Subdomains\n- \n\n### Tech Stack\n- \n`,
  },
  {
    id: "vuln", label: "Vulnerability Draft",
    content: `## Vulnerability: [Title]\n\n**CVSS:** \n**CWE:** \n\n### Steps to Reproduce\n1. \n2. \n3. \n\n### Impact\n\n\n### Remediation\n\n`,
  },
  {
    id: "meeting", label: "Meeting Notes",
    content: `## Meeting Notes\n\n**Date:** \n**Attendees:** \n\n### Agenda\n1. \n\n### Action Items\n- [ ] \n`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

function relTime(ts: any): string {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const ms = Date.now() - d.getTime();
    const m  = Math.floor(ms / 60_000);
    const h  = Math.floor(ms / 3_600_000);
    const dy = Math.floor(ms / 86_400_000);
    if (m  < 1)  return "just now";
    if (m  < 60) return `${m}m ago`;
    if (h  < 24) return `${h}h ago`;
    if (dy === 1) return "yesterday";
    return `${dy}d ago`;
  } catch { return "—"; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar helpers — operate on the real textarea DOM node
// ─────────────────────────────────────────────────────────────────────────────

function wrapSel(
  el: HTMLTextAreaElement,
  set: React.Dispatch<React.SetStateAction<string>>,
  before: string,
  after: string = before,
) {
  const s    = el.selectionStart;
  const e    = el.selectionEnd;
  const v    = el.value;
  const sel  = v.slice(s, e) || "text";
  const next = v.slice(0, s) + before + sel + after + v.slice(e);
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  nativeSet.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  set(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(s + before.length, s + before.length + sel.length);
  });
}

function prependLine(
  el: HTMLTextAreaElement,
  set: React.Dispatch<React.SetStateAction<string>>,
  prefix: string,
) {
  const s    = el.selectionStart;
  const v    = el.value;
  const ls   = v.lastIndexOf("\n", s - 1) + 1;
  const next = v.slice(0, ls) + prefix + v.slice(ls);
  const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  nativeSet.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  set(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(s + prefix.length, s + prefix.length);
  });
}

function insertDivider(
  el: HTMLTextAreaElement,
  set: React.Dispatch<React.SetStateAction<string>>,
) {
  const s    = el.selectionStart;
  const v    = el.value;
  const ins  = "\n\n---\n\n";
  const next = v.slice(0, s) + ins + v.slice(s);
  set(next);
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + ins.length, s + ins.length); });
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar config
// ─────────────────────────────────────────────────────────────────────────────

type ToolbarItem = {
  Icon:     React.ElementType;
  label:    string;
  shortcut?: string;
  action:   (el: HTMLTextAreaElement, set: React.Dispatch<React.SetStateAction<string>>) => void;
};

const TOOLBAR: ToolbarItem[][] = [
  [
    { Icon: Heading2,    label: "H2",          action: (el, s) => prependLine(el, s, "## ")   },
    { Icon: Heading3,    label: "H3",          action: (el, s) => prependLine(el, s, "### ")  },
  ],
  [
    { Icon: Bold,        label: "Bold",        shortcut: "⌘B", action: (el, s) => wrapSel(el, s, "**")          },
    { Icon: Italic,      label: "Italic",      shortcut: "⌘I", action: (el, s) => wrapSel(el, s, "_")           },
    { Icon: Code,        label: "Inline Code",                  action: (el, s) => wrapSel(el, s, "`")           },
    { Icon: Link2,       label: "Link",        shortcut: "⌘K", action: (el, s) => wrapSel(el, s, "[", "](url)") },
  ],
  [
    { Icon: List,        label: "Bullet",      action: (el, s) => prependLine(el, s, "- ")   },
    { Icon: ListOrdered, label: "Numbered",    action: (el, s) => prependLine(el, s, "1. ")  },
    { Icon: Quote,       label: "Quote",       action: (el, s) => prependLine(el, s, "> ")   },
    { Icon: Terminal,    label: "Code Block",  action: (el, s) => wrapSel(el, s, "\n```\n", "\n```\n") },
    { Icon: Minus,       label: "Divider",     action: (el, s) => insertDivider(el, s)       },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// Markdown preview
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 bg-[#020304]">
        <Eye className="w-6 h-6 text-slate-800" strokeWidth={1.5} />
        <p className="text-[11px] font-sans text-slate-700">Nothing to preview yet</p>
      </div>
    );
  }
  return (
    <div className={cn(
      "h-full overflow-y-auto px-8 py-7 scrollbar-thin bg-[#020304]",
      "prose prose-invert prose-sm max-w-none",
      "prose-headings:font-display prose-headings:text-slate-100 prose-headings:font-bold",
      "prose-h1:text-2xl prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-3",
      "prose-h2:text-lg prose-h2:text-slate-200",
      "prose-h3:text-base prose-h3:text-slate-300",
      "prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-3 prose-p:font-sans prose-p:text-sm",
      "prose-code:text-violet-300 prose-code:bg-black/50 prose-code:border prose-code:border-slate-800",
      "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:font-mono",
      "prose-code:before:content-none prose-code:after:content-none",
      "prose-pre:bg-[#0A0B0D] prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:text-xs prose-pre:p-4",
      "prose-li:text-slate-300 prose-li:my-0.5 prose-li:font-sans prose-li:text-sm",
      "prose-ul:my-3 prose-ol:my-3",
      "prose-blockquote:border-l-2 prose-blockquote:border-violet-500/40 prose-blockquote:text-slate-500 prose-blockquote:not-italic",
      "prose-blockquote:bg-violet-500/[0.03] prose-blockquote:px-4 prose-blockquote:rounded-r-lg",
      "prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline",
      "prose-hr:border-slate-800/60 prose-hr:my-6",
      "prose-strong:text-slate-100 prose-strong:font-bold",
      "prose-em:text-slate-300 prose-em:italic",
    )}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Color picker — custom inline dropdown (avoids Radix z-index bugs in portals)
// ─────────────────────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Note colour"
        style={{
          width: 28, height: 28, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.08)",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          cursor: "pointer", transition: "background 0.12s",
        }}
      >
        <span style={{
          width: 12, height: 12, borderRadius: "50%",
          background: COLORS[value].hex, display: "block",
          boxShadow: `0 0 6px ${COLORS[value].hex}60`,
        }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -6,  scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              background: "#0D0F12", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: "10px 12px", zIndex: 99999,
              boxShadow: "0 16px 40px rgba(0,0,0,0.6)", minWidth: 180,
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>
              Note Colour
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {COLOR_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => { onChange(key); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: value === key ? "rgba(255,255,255,0.07)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (value !== key) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (value !== key) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: COLORS[key].hex, flexShrink: 0,
                    boxShadow: value === key ? `0 0 8px ${COLORS[key].hex}70` : "none",
                  }} />
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: value === key ? "#e2e8f0" : "#64748b", fontWeight: value === key ? 700 : 400 }}>
                    {COLORS[key].label}
                  </span>
                  {value === key && (
                    <span style={{ marginLeft: "auto", fontSize: 10, color: COLORS[key].hex }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template picker — inline dropdown
// ─────────────────────────────────────────────────────────────────────────────

function TemplatePicker({ onInsert }: { onInsert: (content: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 8, cursor: "pointer",
          background: open ? "rgba(139, 92, 246,0.15)" : "rgba(139, 92, 246,0.08)",
          border: "1px solid rgba(139, 92, 246,0.2)", color: "#a78bfa",
          fontFamily: "monospace", fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.1em",
          transition: "background 0.12s",
        }}
      >
        <Plus style={{ width: 12, height: 12 }} />
        Template
        <ChevronDown style={{ width: 12, height: 12, opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -6,  scale: 0.96 }}
            transition={{ duration: 0.14 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              background: "#0D0F12", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12, padding: 6, zIndex: 99999,
              boxShadow: "0 16px 40px rgba(0,0,0,0.6)", minWidth: 200,
            }}
            onClick={e => e.stopPropagation()}
          >
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => { onInsert(t.content); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "transparent", color: "#94a3b8",
                  fontFamily: "monospace", fontSize: 11, transition: "all 0.1s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#a78bfa";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
                }}
              >
                {t.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const params    = useParams();
  const projectId = params.projectId as string;
  const { isGuest } = useAuth();

  // ── Guest data ─────────────────────────────────────────────────────────────
  const lsKey = `cs:project-notes:${projectId}`;

  const [guestNotes, setGuestNotes] = useState<ProjectNote[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(lsKey);
      return raw ? JSON.parse(raw).map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        updatedAt: new Date(n.updatedAt),
      })) : [];
    } catch { return []; }
  });

  const guestRef = useRef(guestNotes);
  guestRef.current = guestNotes;

  const saveGuest = useCallback((updated: ProjectNote[]) => {
    setGuestNotes(updated);
    try { localStorage.setItem(lsKey, JSON.stringify(updated)); } catch {}
  }, [lsKey]);

  // ── Firestore ──────────────────────────────────────────────────────────────
  const fsQuery = useMemo(() => {
    if (isGuest || !projectId) return null;
    return query(collection(db, "projects", projectId, "notes"), orderBy("updatedAt", "desc"));
  }, [isGuest, projectId]);

  const { data: fsNotes, isLoading: fsLoading } = useCollection<ProjectNote>(fsQuery);

  const notes = useMemo<ProjectNote[]>(() => {
    if (isGuest) return [...guestNotes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return fsNotes ?? [];
  }, [isGuest, guestNotes, fsNotes]);

  const isLoading = isGuest ? false : fsLoading;

  // ── Editor state ───────────────────────────────────────────────────────────
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [localTitle,   setLocalTitle]   = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localColor,   setLocalColor]   = useState<NoteColor>("default");
  const [viewMode,     setViewMode]     = useState<ViewMode>("edit");
  const [saveState,    setSaveState]    = useState<SaveState>("idle");
  const [copied,       setCopied]       = useState(false);
  const [deleteConf,   setDeleteConf]   = useState<string | null>(null);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [isMounted,    setIsMounted]    = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const editorNoteId = useRef<string | null>(null);
  const deleteTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeNote = useMemo(() => notes.find(n => n.id === activeId), [notes, activeId]);

  // Sync editor when note changes
  useEffect(() => {
    editorNoteId.current = activeId;
    if (activeNote) {
      setLocalTitle(activeNote.title);
      setLocalContent(activeNote.content);
      setLocalColor(activeNote.color ?? "default");
      setSaveState("idle");
    } else {
      setLocalTitle(""); setLocalContent(""); setLocalColor("default");
    }
  }, [activeId]); // eslint-disable-line

  // Auto-select first note
  useEffect(() => {
    if (!isLoading && notes.length > 0 && !activeId) setActiveId(notes[0].id);
  }, [isLoading, notes.length]); // eslint-disable-line

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // ── Persist save ───────────────────────────────────────────────────────────
  const persistSave = useCallback(async (
    noteId: string, title: string, content: string, color: NoteColor,
  ) => {
    if (editorNoteId.current !== noteId) return;

    if (isGuest) {
      const cur = guestRef.current.find(n => n.id === noteId);
      if (cur && cur.title === title && cur.content === content && (cur.color ?? "default") === color) return;
    }

    setSaveState("saving");
    try {
      if (isGuest) {
        saveGuest(guestRef.current.map(n =>
          n.id === noteId ? { ...n, title, content, color, updatedAt: new Date() } : n
        ));
      } else {
        await updateDoc(doc(db, "projects", projectId, "notes", noteId), {
          title, content, color, updatedAt: serverTimestamp(),
        });
      }
      setSaveState("saved");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save note.");
      setSaveState("idle");
    }
  }, [isGuest, projectId, saveGuest]);

  const dbTitle   = useDebounce(localTitle,   1500);
  const dbContent = useDebounce(localContent, 1500);
  const dbColor   = useDebounce(localColor,    500);

  useEffect(() => {
    if (activeId) persistSave(activeId, dbTitle, dbContent, dbColor);
  }, [dbTitle, dbContent, dbColor, activeId, persistSave]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey;
    if (!activeId || !textareaRef.current) return;
    if (meta && e.key === "s") { e.preventDefault(); persistSave(activeId, localTitle, localContent, localColor); return; }
    if (meta && e.key === "b") { e.preventDefault(); TOOLBAR.flat().find(t => t.label === "Bold")!.action(textareaRef.current!, setLocalContent); }
    if (meta && e.key === "i") { e.preventDefault(); TOOLBAR.flat().find(t => t.label === "Italic")!.action(textareaRef.current!, setLocalContent); }
    if (meta && e.key === "k") { e.preventDefault(); TOOLBAR.flat().find(t => t.label === "Link")!.action(textareaRef.current!, setLocalContent); }
  }, [activeId, localTitle, localContent, localColor, persistSave]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const createNote = useCallback(async () => {
    if (isGuest) {
      const id  = `note_${Date.now()}`;
      const now = new Date();
      saveGuest([{ id, projectId, title: "", content: "", color: "default", createdAt: now, updatedAt: now }, ...guestRef.current]);
      setActiveId(id);
    } else {
      try {
        const ref = await addDoc(collection(db, "projects", projectId, "notes"), {
          projectId, title: "", content: "", color: "default",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        setActiveId(ref.id);
      } catch { toast.error("Failed to create note."); }
    }
  }, [isGuest, projectId, saveGuest]);

  const deleteNote = useCallback(async (id: string) => {
    if (isGuest) {
      const rem = guestRef.current.filter(n => n.id !== id);
      saveGuest(rem);
      if (activeId === id) setActiveId(rem[0]?.id ?? null);
    } else {
      try {
        await deleteDoc(doc(db, "projects", projectId, "notes", id));
        if (activeId === id) setActiveId(null);
      } catch { toast.error("Failed to delete note."); return; }
    }
    toast.success("Note deleted.");
  }, [isGuest, projectId, saveGuest, activeId]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deleteConf === id) {
      clearTimeout(deleteTimer.current);
      setDeleteConf(null);
      deleteNote(id);
    } else {
      setDeleteConf(id);
      deleteTimer.current = setTimeout(() => setDeleteConf(null), 3000);
    }
  }, [deleteConf, deleteNote]);

  const insertTemplate = useCallback((content: string) => {
    const el = textareaRef.current;
    if (el) {
      const s    = el.selectionStart;
      const e    = el.selectionEnd;
      const v    = el.value;
      const next = v.slice(0, s) + content + v.slice(e);
      setLocalContent(next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + content.length, s + content.length); });
    } else {
      setLocalContent(prev => prev + "\n" + content);
    }
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(localContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [localContent]);

  const wordCount = useMemo(() =>
    localContent.trim() ? localContent.trim().split(/\s+/).length : 0,
  [localContent]);

  // ── Shared style constants ─────────────────────────────────────────────────
  const panelBg = "#0A0B0D";
  const editorBg = "#020304";
  const border = "1px solid rgba(255,255,255,0.07)";

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-64 border-r border-slate-800 bg-[#0A0B0D] p-3 flex flex-col gap-2 shrink-0">
          {[80, 64, 72].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-800/50" style={{ height: h }} />
          ))}
        </div>
        <div className="flex-1 bg-[#020304] flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Editor panel JSX (reused both normally and in portal) ──────────────────
  const editorPanel = (
    <div style={{ flex: 1, minWidth: 0, background: editorBg, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      {!activeId ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>
          <FileText style={{ width: 40, height: 40, color: "#1e293b", marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#475569", fontFamily: "'Syne', sans-serif" }}>No note selected</p>
          <p style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", marginTop: 6, marginBottom: 16 }}>
            Select a note or create a new one.
          </p>
          <button onClick={createNote} className="btn-primary" style={{ height: 32, padding: "0 16px", fontSize: 11 }}>
            + New Note
          </button>
        </div>
      ) : (
        <>
          {/* ── Top toolbar ──────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 16px", borderBottom: border, background: panelBg, flexShrink: 0,
            gap: 8, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", alignItems: "center",
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, padding: 3, gap: 2,
              }}>
                {([
                  { id: "edit",    Icon: FileText,  label: "Write"   },
                  { id: "split",   Icon: SplitIcon, label: "Split"   },
                  { id: "preview", Icon: Eye,        label: "Preview" },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setViewMode(m.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: viewMode === m.id ? "rgba(255,255,255,0.08)" : "transparent",
                      color: viewMode === m.id ? "#e2e8f0" : "#475569",
                      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.1em",
                      transition: "all 0.12s",
                    }}
                  >
                    <m.Icon style={{ width: 12, height: 12 }} />
                    {m.label}
                  </button>
                ))}
              </div>
              <TemplatePicker onInsert={insertTemplate} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ColorPicker value={localColor} onChange={setLocalColor} />
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.07)" }} />
              <button
                onClick={handleCopy}
                title="Copy markdown"
                style={{
                  width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                  background: "transparent", color: copied ? "#34d399" : "#475569",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {copied ? <CheckCheck style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              </button>
              <button
                onClick={() => setFullscreen(v => !v)}
                title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
                  background: fullscreen ? "rgba(255,255,255,0.08)" : "transparent",
                  color: fullscreen ? "#a78bfa" : "#475569",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = fullscreen ? "rgba(255,255,255,0.08)" : "transparent")}
              >
                {fullscreen ? <Minimize2 style={{ width: 13, height: 13 }} /> : <Maximize2 style={{ width: 13, height: 13 }} />}
              </button>
            </div>
          </div>

          {/* ── Markdown toolbar ─────────────────────────────────────── */}
          {viewMode !== "preview" && (
            <div style={{
              display: "flex", alignItems: "center",
              padding: "5px 14px", borderBottom: border, background: panelBg,
              flexShrink: 0, overflowX: "auto", gap: 2,
            }}>
              {TOOLBAR.map((group, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.07)", margin: "0 4px", flexShrink: 0 }} />}
                  {group.map((item, ai) => (
                    <button
                      key={ai}
                      title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
                      onClick={() => { if (textareaRef.current) item.action(textareaRef.current, setLocalContent); }}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
                        background: "transparent", color: "#475569", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.1s",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "#475569";
                      }}
                    >
                      <item.Icon style={{ width: 13, height: 13 }} />
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ── Content area ─────────────────────────────────────────── */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
            {viewMode !== "preview" && (
              <div style={{
                display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0,
                flex: viewMode === "split" ? "0 0 50%" : 1,
                borderRight: viewMode === "split" ? border : "none",
              }}>
                <div style={{ padding: "24px 32px 12px", flexShrink: 0 }}>
                  <input
                    type="text"
                    value={localTitle}
                    onChange={e => setLocalTitle(e.target.value)}
                    placeholder="Note title"
                    style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                      color: "#f1f5f9", caretColor: "#a78bfa",
                    }}
                  />
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginTop: 10 }} />
                </div>
                <textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={e => setLocalContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Start typing… markdown is supported."
                  spellCheck={false}
                  className="scrollbar-thin"
                  style={{
                    flex: 1, minHeight: 0, resize: "none",
                    background: "transparent", border: "none", outline: "none",
                    padding: "8px 32px 24px",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                    color: "#94a3b8", lineHeight: 1.8, caretColor: "#a78bfa",
                  }}
                />
              </div>
            )}
            {viewMode !== "edit" && (
              <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                <MarkdownPreview content={localTitle ? `# ${localTitle}\n\n${localContent}` : localContent} />
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 16px", borderTop: border, background: panelBg, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 9, fontFamily: "monospace", color: "#1e293b" }}>
              <span>{wordCount} words</span>
              <span style={{ color: "#0f172a" }}>·</span>
              <span>{localContent.length} chars</span>
              <span style={{ color: "#0f172a" }}>·</span>
              <span>⌘S to save</span>
              {fullscreen && <span style={{ color: "#334155" }}>· Esc to exit fullscreen</span>}
            </div>
            <div style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}>
              {saveState === "saving" && (
                <span style={{ color: "#a78bfa", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: "pulse 1s infinite" }} />
                  Saving…
                </span>
              )}
              {saveState === "saved" && (
                <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                  Saved
                </span>
              )}
              {saveState === "idle" && <span style={{ color: "#1e293b" }}>● Ready</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Sidebar JSX ───────────────────────────────────────────────────────────
  const sidebarPanel = (
    <div style={{
      width: 240, flexShrink: 0,
      borderRight: border, background: panelBg,
      display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: border, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Pencil style={{ width: 12, height: 12, color: "#475569" }} />
          <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: "#64748b", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Notes
          </span>
          {notes.length > 0 && (
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "#334155", background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>
              {notes.length}
            </span>
          )}
        </div>
        <button
          onClick={createNote}
          title="New note"
          style={{
            width: 26, height: 26, borderRadius: 8, border: "1px solid rgba(139, 92, 246,0.2)",
            background: "rgba(139, 92, 246,0.08)", color: "#a78bfa", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.12s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(139, 92, 246,0.16)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(139, 92, 246,0.08)")}
        >
          <Plus style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
        {notes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "20px 16px", gap: 12 }}>
            <FileText style={{ width: 32, height: 32, color: "#1e293b" }} />
            <div>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", fontWeight: 600 }}>No notes yet</p>
              <p style={{ fontSize: 10, fontFamily: "monospace", color: "#334155", marginTop: 4, lineHeight: 1.6 }}>Create your first note to start documenting.</p>
            </div>
            <button onClick={createNote} className="btn-primary" style={{ height: 28, padding: "0 12px", fontSize: 10, marginTop: 4 }}>
              + New Note
            </button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notes.map(note => {
              const isActive = note.id === activeId;
              const isConf   = deleteConf === note.id;
              const color    = COLORS[note.color ?? "default"];
              const preview  = note.content.trim()
                ? note.content.replace(/[#*`_\->[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 60)
                : "Empty note";

              return (
                <motion.div
                  key={note.id}
                  layout="position"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setActiveId(note.id)}
                  style={{
                    position: "relative", cursor: "pointer",
                    padding: "11px 12px", borderRadius: 10, marginBottom: 6,
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: isActive ? "rgba(139, 92, 246,0.25)" : "rgba(255,255,255,0.06)",
                    borderLeftWidth: "3px",
                    borderLeftColor: isActive ? "#a78bfa" : color.hex,
                    background: isActive ? "rgba(139, 92, 246,0.05)" : "rgba(15,18,24,0.8)",
                    transition: "all 0.15s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "rgba(15,18,24,0.8)"; }}
                >
                  {note.color && note.color !== "default" && (
                    <div style={{ position: "absolute", top: 10, right: 10, width: 7, height: 7, borderRadius: "50%", background: color.hex }} />
                  )}
                  <div style={{ paddingRight: 14 }}>
                    <h3 style={{ fontSize: 12, fontWeight: 600, color: isActive ? "#f1f5f9" : "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                      {note.title || "Untitled Note"}
                    </h3>
                    <p style={{ fontSize: 10, fontFamily: "monospace", color: "#334155", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {preview}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "#1e293b" }}>
                      {relTime(note.updatedAt)}
                    </span>
                    <button
                      onClick={e => handleDeleteClick(e, note.id)}
                      title={isConf ? "Click again to confirm" : "Delete"}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: "none", cursor: "pointer",
                        background: isConf ? "rgba(239,68,68,0.15)" : "transparent",
                        color: isConf ? "#f87171" : "#334155",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: isConf ? 1 : 0, transition: "all 0.12s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                      onMouseLeave={e => { if (!isConf) (e.currentTarget as HTMLButtonElement).style.opacity = "0"; }}
                    >
                      <Trash2 style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                  {isConf && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(239,68,68,0.2)", borderRadius: "0 0 10px 10px" }}>
                      <div className="cs-delete-bar" style={{ height: "100%", background: "#ef4444", borderRadius: "inherit" }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes cs-shrink { from { width: 100%; } to { width: 0%; } }
        .cs-delete-bar { animation: cs-shrink 3s linear forwards; }
      `}</style>

      {/* Fullscreen — rendered into document.body via portal to escape all stacking contexts */}
      {isMounted && fullscreen && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          display: "flex", background: editorBg,
        }}>
          {editorPanel}
        </div>,
        document.body
      )}

      {/* Normal layout */}
      {!fullscreen && (
        <div style={{ display: "flex", flex: 1, minHeight: 0, height: "100%", width: "100%", overflow: "hidden" }}>
          {sidebarPanel}
          {editorPanel}
        </div>
      )}
    </>
  );
}
