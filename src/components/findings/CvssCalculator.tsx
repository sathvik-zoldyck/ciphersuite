'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CVSS_METRICS, DEFAULT_VECTOR, baseScore, formatVector, parseVector,
  type CvssVector, type MetricKey,
} from '@/lib/cvss';

interface Props {
  /** Current vector string, e.g. "CVSS:3.1/AV:N/AC:L/…". Empty when not set. */
  vector?: string;
  /** Called with the new vector string and its base score. */
  onChange: (vector: string, score: number) => void;
}

/**
 * CVSS v3.1 base-score builder. Pick one value per metric, or paste a full
 * vector string; the score is calculated with the official equations.
 */
export function CvssCalculator({ vector, onChange }: Props) {
  const [v, setV] = useState<CvssVector>(() => parseVector(vector ?? '') ?? DEFAULT_VECTOR);
  const [text, setText] = useState(vector ?? '');
  const [pasteError, setPasteError] = useState('');

  // Follow outside changes (e.g. a library writeup or opening another finding).
  useEffect(() => {
    const parsed = parseVector(vector ?? '');
    if (parsed) { setV(parsed); setText(vector ?? ''); }
  }, [vector]);

  const update = (next: CvssVector) => {
    setV(next);
    const s = formatVector(next);
    setText(s);
    setPasteError('');
    onChange(s, baseScore(next));
  };

  const pick = (key: MetricKey, value: string) => update({ ...v, [key]: value });

  const onPaste = (value: string) => {
    setText(value);
    if (!value.trim()) { setPasteError(''); return; }
    const parsed = parseVector(value);
    if (parsed) update(parsed);
    else setPasteError('Paste a full CVSS 3.1 vector, for example CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-black/30 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">CVSS 3.1 calculator</span>
        <span className="font-mono text-sm font-semibold text-slate-100">{baseScore(v).toFixed(1)}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CVSS_METRICS.map((m) => (
          <fieldset key={m.key}>
            <legend className="mb-1.5 text-[11px] text-slate-400">{m.label}</legend>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={m.label}>
              {m.options.map((o) => {
                const active = v[m.key] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pick(m.key, o.value)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] transition-colors',
                      active
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                        : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200',
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div>
        <label htmlFor="cvss-vector" className="mb-1.5 block text-[11px] text-slate-400">Vector</label>
        <input
          id="cvss-vector"
          value={text}
          onChange={(e) => onPaste(e.target.value)}
          placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
          spellCheck={false}
          className="h-9 w-full rounded-lg border border-slate-800 bg-[#0D0F12] px-3 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-violet-500/50 focus:outline-none"
        />
        {pasteError && <p className="mt-1.5 text-[11px] text-amber-400">{pasteError}</p>}
      </div>
    </div>
  );
}
