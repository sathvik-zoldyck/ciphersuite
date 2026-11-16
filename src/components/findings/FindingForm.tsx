
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronDown, Sparkles, LayoutTemplate,
  AlertTriangle, CheckCircle2, ChevronRight, Loader2,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { SeverityBadge } from './SeverityBadge';
import {
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  SEVERITIES_ORDERED,
  STATUSES_ORDERED,
  OWASP_CATEGORIES, FINDING_TEMPLATES,
} from '@/lib/types';
import type {
  Finding, FindingFormData,
  FindingSeverity, FindingStatus,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { aiDraftFinding, aiGenerateImpactAndRemediation } from '@/ai/flows';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY: FindingFormData = {
  title: '', severity: 'Medium', status: 'Open',
  target: '', description: '', stepsToReproduce: '',
  impact: '', remediation: '', cvss: undefined,
  cweId: '', owaspId: '',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FindingFormData) => Promise<void>;
  initial?: Finding | null;
}

type Tab = 'overview' | 'technical' | 'metadata';

interface FieldErrors {
  title?: string;
  target?: string;
  description?: string;
}

// ─── Tab completion check ─────────────────────────────────────────────────────

function tabIsComplete(tab: Tab, form: FindingFormData): boolean {
  if (tab === 'overview') return !!(form.title && form.target && form.description);
  if (tab === 'technical') return !!(form.stepsToReproduce && form.remediation);
  return true;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FindingForm({ open, onClose, onSubmit, initial }: FindingFormProps) {
  const isEdit = !!initial;
  const { toast } = useToast();
  const titleRef = useRef<HTMLInputElement>(null);

  const [form, setForm]               = useState<FindingFormData>(EMPTY);
  const [loading, setLoading]         = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab]     = useState<Tab>('overview');
  const [dirty, setDirty]             = useState(false);
  const [aiLoading, setAiLoading]     = useState<Partial<Record<'draft' | 'impact' | 'remediation', boolean>>>({});
  const [aiNotes, setAiNotes]         = useState('');

  // Reset on open/close
  useEffect(() => {
    if (!open) return;
    setForm(initial ? {
      title:            initial.title,
      severity:         initial.severity,
      status:           initial.status,
      target:           initial.target ?? '',
      description:      initial.description,
      stepsToReproduce: initial.stepsToReproduce,
      impact:           initial.impact,
      remediation:      initial.remediation,
      cvss:             initial.cvss,
      cweId:            initial.cweId ?? '',
      owaspId:          initial.owaspId ?? '',
    } : EMPTY);
    setFieldErrors({});
    setGlobalError('');
    setActiveTab('overview');
    setShowTemplates(false);
    setDirty(false);
    setAiNotes('');
    // Auto-focus title after animation settles
    setTimeout(() => titleRef.current?.focus(), 320);
  }, [open, initial]);

  const set = useCallback(<K extends keyof FindingFormData>(key: K, value: FindingFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    // Clear field error on change
    if (key in fieldErrors) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }, [fieldErrors]);

  // ── Template apply ─────────────────────────────────────────────────────────
  const applyTemplate = (key: string) => {
    const t = FINDING_TEMPLATES[key as keyof typeof FINDING_TEMPLATES];
    if (!t) return;
    setForm((prev) => ({
      ...prev,
      title:       t.title       ?? prev.title,
      severity:    t.severity    ?? prev.severity,
      description: t.description ?? prev.description,
      impact:      t.impact      ?? prev.impact,
      remediation: t.remediation ?? prev.remediation,
      cweId:       t.cweId       ?? prev.cweId,
      owaspId:     t.owaspId     ?? prev.owaspId,
      cvss:        t.cvss        ?? prev.cvss,
    }));
    setDirty(true);
    setShowTemplates(false);
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (!form.title.trim())       errors.title       = 'Title is required';
    if (!form.target?.trim())     errors.target      = 'Target is required';
    if (!form.description.trim()) errors.description = 'Description is required';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      // Jump to first failing tab
      if (errors.title || errors.target || errors.description) setActiveTab('overview');
      return false;
    }
    return true;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setGlobalError('');
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } catch {
      setGlobalError('Failed to save finding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Close guard ────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (dirty && !loading) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  };
  
  // -- AI Flows -------------------------------------------------------------
  const handleAiDraft = useCallback(async () => {
    if (!aiNotes.trim()) {
        toast.warning('Please provide some notes for the AI.');
        return;
    }
    setAiLoading(p => ({...p, draft: true}));
    try {
        const result = await aiDraftFinding({ notes: aiNotes, existingTitle: form.title });
        setForm(f => ({ ...f, ...result }));
        setDirty(true);
        toast.success("AI drafted the finding successfully.");
    } catch (e: any) {
        toast.error("AI drafting failed.", e.message);
    } finally {
        setAiLoading(p => ({...p, draft: false}));
    }
  }, [aiNotes, form.title, toast]);

  const handleAiGenerate = useCallback(async (field: 'impact' | 'remediation') => {
    if (!form.title || !form.description) {
      toast.warning("Please provide a title and description before using AI generation.");
      return;
    }
    setAiLoading(p => ({ ...p, [field]: true }));
    try {
      const result = await aiGenerateImpactAndRemediation({
        findingTitle: form.title,
        description: form.description,
        target: form.target ?? '',
        severity: form.severity,
        generate: field,
      });
      setForm(f => ({ ...f, [field]: result[field] }));
      setDirty(true);
      toast.success(`AI generated the ${field}.`);
    } catch(e: any) {
      toast.error(`AI ${field} generation failed.`, e.message);
    } finally {
      setAiLoading(p => ({ ...p, [field]: false }));
    }
  }, [form, toast]);


  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, dirty, loading]);

  const sevCfg = SEVERITY_CONFIG[form.severity];
  const stripeColor = sevCfg.dot; // e.g. "bg-red-400"

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* ── Drawer ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0A0B0D] border-l border-slate-800 z-50 flex flex-col"
          >
            {/* Severity accent line — top */}
            <div className={cn('absolute top-0 left-0 right-0 h-[2px] z-10', stripeColor)} />

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 pt-5 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Severity left bar */}
                <div className={cn('w-1 h-9 rounded-full flex-shrink-0', stripeColor)} />
                <div className="min-w-0">
                  <p className="text-[9px] font-sans font-bold tracking-[0.18em] text-slate-600 uppercase mb-0.5">
                    {isEdit ? 'Edit Finding' : 'New Finding'}
                  </p>
                  <h2 className="text-sm font-bold font-display text-slate-100 truncate leading-tight">
                    {form.title || <span className="text-slate-700 italic font-normal">Untitled Finding</span>}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Template picker */}
                {!isEdit && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-sans rounded-lg border transition-all',
                        showTemplates
                          ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-500 hover:border-violet-500/30 hover:text-violet-400'
                      )}
                    >
                      <LayoutTemplate className="w-3.5 h-3.5" />
                      Templates
                      <ChevronDown className={cn('w-3 h-3 transition-transform', showTemplates && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {showTemplates && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-[#0D0F12] border border-slate-700/60 rounded-xl shadow-2xl z-20 overflow-hidden"
                        >
                          <div className="px-3 py-2 border-b border-slate-800">
                            <span className="text-[9px] font-sans font-bold text-slate-600 uppercase tracking-widest">
                              Quick Templates
                            </span>
                          </div>
                          {Object.entries(FINDING_TEMPLATES).map(([key, t]) => (
                            <button
                              key={key}
                              onClick={() => applyTemplate(key)}
                              className="w-full flex items-center justify-between gap-3 px-3 py-3 hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
                                <span className="text-xs font-sans text-slate-300 truncate">{t.title}</span>
                              </div>
                              {t.severity && <SeverityBadge severity={t.severity} size="sm" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Close */}
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex gap-0 border-b border-slate-800 px-6 flex-shrink-0">
              {(['overview', 'technical', 'metadata'] as Tab[]).map((tab) => {
                const complete = tabIsComplete(tab, form);
                const hasError =
                  (tab === 'overview' && (fieldErrors.title || fieldErrors.target || fieldErrors.description));

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'relative flex items-center gap-2 px-4 py-3 text-[11px] font-sans font-semibold',
                      'uppercase tracking-wider border-b-2 transition-all',
                      activeTab === tab
                        ? 'border-violet-400 text-violet-400'
                        : 'border-transparent text-slate-600 hover:text-slate-300'
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {hasError ? (
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                    ) : complete && dirty ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* ── Form body ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">

              {/* OVERVIEW */}
              <TabPanel active={activeTab === 'overview'}>
                <Field label="Finding Title" required error={fieldErrors.title}>
                  <input
                    ref={titleRef}
                    type="text"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="e.g. SQL Injection in Login Endpoint"
                    className={cn(InputCls, fieldErrors.title && ErrorInputCls)}
                  />
                </Field>

                {/* Severity selector */}
                <Field label="Severity" required>
                  <div className="flex flex-wrap gap-2">
                    {SEVERITIES_ORDERED.map((s) => {
                      const cfg = SEVERITY_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => set('severity', s)}
                          className={cn(
                            'transition-all duration-150 rounded-md',
                            form.severity === s
                              ? `ring-2 ${cfg.ring} ring-offset-1 ring-offset-[#0A0B0D] scale-105`
                              : 'opacity-40 hover:opacity-75 hover:scale-105'
                          )}
                        >
                          <SeverityBadge severity={s} size="md" />
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Status selector — buttons, not a <select> */}
                <Field label="Status" required>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES_ORDERED.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => set('status', s)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-sans font-semibold transition-all',
                            form.status === s
                              ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                              : 'bg-transparent border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-400'
                          )}
                        >
                          <div className={cn('w-1.5 h-1.5 rounded-full', form.status === s ? cfg.dot : 'bg-slate-700')} />
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Target" required hint="URL, IP, hostname, or component" error={fieldErrors.target}>
                  <input
                    type="text"
                    value={form.target}
                    onChange={(e) => set('target', e.target.value)}
                    placeholder="https://target.com/api/login"
                    className={cn(InputCls, fieldErrors.target && ErrorInputCls)}
                  />
                </Field>

                <Field label="Description" required hint="What is the vulnerability?" error={fieldErrors.description}>
                  <AITextarea
                    value={form.description}
                    onChange={(v) => set('description', v)}
                    placeholder="Describe the vulnerability clearly and objectively..."
                    rows={4}
                    hasError={!!fieldErrors.description}
                  />
                </Field>

                <Field label="Impact" hint="What can an attacker achieve?">
                  <AITextarea
                    value={form.impact}
                    onChange={(v) => set('impact', v)}
                    onAiClick={() => handleAiGenerate('impact')}
                    aiLoading={aiLoading.impact}
                    placeholder="Describe the business and technical impact..."
                    rows={3}
                  />
                </Field>
              </TabPanel>

              {/* TECHNICAL */}
              <TabPanel active={activeTab === 'technical'}>
                <Field label="Steps to Reproduce" hint="Numbered steps an attacker would follow">
                  <textarea
                    value={form.stepsToReproduce}
                    onChange={(e) => set('stepsToReproduce', e.target.value)}
                    placeholder={
                      '1. Navigate to /api/login\n2. Intercept the POST request\n3. Modify the username parameter with a SQL payload...\n4. Observe the error response revealing DB structure'
                    }
                    rows={9}
                    className={cn(InputCls, 'font-sans text-xs resize-none leading-relaxed')}
                  />
                </Field>

                <Field label="Remediation" hint="How to fix this vulnerability">
                  <AITextarea
                    value={form.remediation}
                    onChange={(v) => set('remediation', v)}
                    onAiClick={() => handleAiGenerate('remediation')}
                    aiLoading={aiLoading.remediation}
                    placeholder="Detailed remediation steps and recommendations..."
                    rows={5}
                  />
                </Field>
              </TabPanel>

              {/* METADATA */}
              <TabPanel active={activeTab === 'metadata'}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="CVSS Score" hint="0.0 – 10.0">
                    <input
                      type="number"
                      min="0" max="10" step="0.1"
                      value={form.cvss ?? ''}
                      onChange={(e) => set('cvss', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g. 9.8"
                      className={InputCls}
                    />
                  </Field>

                  <Field label="CWE ID" hint="e.g. CWE-89">
                    <input
                      type="text"
                      value={form.cweId ?? ''}
                      onChange={(e) => set('cweId', e.target.value)}
                      placeholder="CWE-89"
                      className={InputCls}
                    />
                  </Field>
                </div>

                {/* CVSS visual band */}
                <div className="rounded-xl border border-slate-800 bg-black/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-semibold text-slate-600 uppercase tracking-wider">CVSS Severity Band</span>
                    {form.cvss !== undefined && (
                      <span className={cn(
                        'text-xs font-sans font-bold px-2 py-0.5 rounded-full',
                        form.cvss >= 9   ? 'text-red-400 bg-red-500/10'     :
                        form.cvss >= 7   ? 'text-orange-400 bg-orange-500/10' :
                        form.cvss >= 4   ? 'text-yellow-400 bg-yellow-500/10' :
                        'text-violet-400 bg-violet-500/10'
                      )}>
                        {form.cvss.toFixed(1)} — {
                          form.cvss >= 9 ? 'Critical' : form.cvss >= 7 ? 'High' : form.cvss >= 4 ? 'Medium' : 'Low'
                        }
                      </span>
                    )}
                  </div>

                  {/* Gradient band */}
                  <div className="relative h-3 rounded-full overflow-hidden"
                    style={{ background: 'linear-gradient(to right, #8b5cf6 0%, #eab308 40%, #f97316 70%, #ef4444 100%)' }}
                  >
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{ background: 'linear-gradient(to right, #8b5cf6 0%, #eab308 40%, #f97316 70%, #ef4444 100%)' }}
                    />
                    {form.cvss !== undefined && (
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full  border-2 border-slate-900"
                        initial={{ left: '0%' }}
                        animate={{ left: `calc(${(form.cvss / 10) * 100}% - 6px)` }}
                        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                      />
                    )}
                  </div>

                  <div className="flex justify-between text-[9px] font-sans text-slate-700 px-0.5">
                    <span>0.0 Low</span>
                    <span>4.0 Med</span>
                    <span>7.0 High</span>
                    <span>9.0 Crit</span>
                    <span>10</span>
                  </div>
                </div>

                {/* OWASP — styled select with category display */}
                <Field label="OWASP Category">
                  <div className="relative">
                    <select
                      value={form.owaspId ?? ''}
                      onChange={(e) => set('owaspId', e.target.value)}
                      className={cn(SelectCls, 'pr-8')}
                    >
                      <option value="">Select OWASP category…</option>
                      {OWASP_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  </div>
                </Field>

                {/* OWASP selection preview */}
                {form.owaspId && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-violet-500/[0.06] border border-violet-500/20"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    <span className="text-xs font-sans text-violet-300/80">
                      {OWASP_CATEGORIES.find((c) => c.id === form.owaspId)?.label ?? form.owaspId}
                    </span>
                  </motion.div>
                )}
              </TabPanel>
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="flex-shrink-0 border-t border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
              {/* Error / hint */}
              <AnimatePresence mode="wait">
                {globalError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-red-400 text-xs font-sans"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {globalError}
                  </motion.div>
                ) : (
                  <motion.p
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] font-sans text-slate-700"
                  >
                    {isEdit ? 'Editing existing finding' : '* Required · ⌘↩ to save'}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-sans text-slate-500 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 text-xs font-sans font-bold rounded-lg transition-all',
                    'bg-violet-500 hover:bg-violet-400 text-white',
                    'shadow-lg',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                    'hover:scale-[1.02] active:scale-[0.98]'
                  )}
                >
                  {loading && (
                    <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  )}
                  {loading ? 'Saving…' : isEdit ? 'Update Finding' : 'Add Finding'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── TabPanel ─────────────────────────────────────────────────────────────────

function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={cn(
      'px-6 py-5 space-y-5',
      !active && 'hidden'
    )}>
      {children}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, required, hint, error, children,
}: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-[0.12em]">
          {label}
          {required && <span className="text-violet-400 ml-1">*</span>}
        </label>
        {error ? (
          <span className="text-[10px] font-sans text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            {error}
          </span>
        ) : hint ? (
          <span className="text-[10px] font-sans text-slate-700">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ─── AITextarea ───────────────────────────────────────────────────────────────

function AITextarea({
  value, onChange, placeholder, rows = 4, hasError, onAiClick, aiLoading
}: {
  value: string; onChange: (v: string) => void;
  placeholder: string; rows?: number; hasError?: boolean;
  onAiClick?: () => void; aiLoading?: boolean;
}) {
  const charLimit = 10000;

  return (
    <div className="relative group">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={charLimit}
        className={cn(InputCls, 'resize-none pr-10 pb-6', hasError && ErrorInputCls)}
      />

      {onAiClick && (
        <button
          type="button"
          title="Improve with AI"
          onClick={onAiClick}
          disabled={aiLoading}
          className={cn(
            'absolute top-2 right-2 p-1.5 rounded-lg transition-all',
            'text-slate-700 hover:text-violet-400 hover:bg-violet-500/10',
            'opacity-0 group-hover:opacity-100',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" /> : <Sparkles className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Char count */}
      {value.length > charLimit * 0.1 && (
        <div className="absolute bottom-2 right-3 pointer-events-none">
          <span className={cn(
            'text-[9px] font-sans',
            value.length > charLimit * 0.9 ? 'text-amber-500' : 'text-slate-800'
          )}>
            {value.length}/{charLimit}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const InputCls = [
  'w-full px-3 py-2.5',
  'bg-[#0D0F12] border border-slate-700/60 rounded-lg',
  'text-sm text-slate-200 font-sans placeholder-slate-700',
  'focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20',
  'transition-colors',
].join(' ');

const ErrorInputCls = 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20';

const SelectCls = [
  'w-full px-3 py-2.5',
  'bg-[#0D0F12] border border-slate-700/60 rounded-lg',
  'text-sm text-slate-300 font-sans',
  'focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20',
  'transition-colors appearance-none cursor-pointer',
].join(' ');
