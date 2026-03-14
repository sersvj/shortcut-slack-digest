'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ExternalLink,
  Clock,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  X,
} from 'lucide-react';
import { ShortcutGroup, CashboardProject, CashboardLineItem, MyStory } from '@/lib/types';

// ---- Types ----

interface TimeEntryForm {
  date: string;
  projectId: number | '';
  lineItemId: number | '';
  notes: string;
  hours: string;
}

type EntryKey = number | 'manual';

// ---- Helpers ----

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDeadline(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= 7) return `Due in ${diff}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function deadlineColor(d: string | null): string {
  if (!d) return 'var(--color-text-dim)';
  const date = new Date(d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'var(--color-danger)';
  if (diff === 0) return 'var(--color-warning)';
  if (diff <= 7) return 'var(--color-success)';
  return 'var(--color-text-dim)';
}


const WORK_TYPE_KEYWORDS = ['web development', 'software development', 'programming', 'web development & tech support', 'development'];

function bestLineItemMatch(items: CashboardLineItem[], projectId: number): CashboardLineItem | null {
  const forProject = items.filter((li) => li.project_id === projectId);
  if (!forProject.length) return null;

  // Score each line item by keyword preference order
  let best: CashboardLineItem | null = null;
  let bestScore = -1;

  for (const li of forProject) {
    const name = (li.name ?? '').toLowerCase();
    let score = 0;
    for (let i = 0; i < WORK_TYPE_KEYWORDS.length; i++) {
      if (name.includes(WORK_TYPE_KEYWORDS[i])) {
        // Higher score for earlier (more preferred) keywords
        score = WORK_TYPE_KEYWORDS.length - i;
        break;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = li;
    }
  }

  return best;
}

// ---- Searchable Select ----

interface SelectOption {
  id: number;
  label: string;
  group?: string;
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  options: SelectOption[];
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = query
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return o.label.toLowerCase().includes(q) || (o.group ?? '').toLowerCase().includes(q);
      })
    : options;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setQuery(''); }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[7px] bg-[var(--color-surface-base)] border text-[13px] text-left transition-colors disabled:opacity-40 ${
          open
            ? 'border-[var(--color-tg-orange)] ring-1 ring-[var(--color-tg-orange)]/20'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'
        }`}
      >
        <span className={selected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-dim)]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={13} className={`text-[var(--color-text-dim)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-[8px] bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]/50">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto custom-scrollbar">
            {value !== '' && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-2 text-[12px] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-3)] italic"
              >
                — Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[var(--color-text-dim)] text-center">No results</div>
            ) : (() => {
              let lastGroup: string | undefined;
              return filtered.map((o) => {
                const items = [];
                if (o.group && o.group !== lastGroup) {
                  lastGroup = o.group;
                  items.push(
                    <div key={`grp-${o.group}`} className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-dim)] bg-[var(--color-surface-3)]/40 border-t border-[var(--color-border)]/40 first:border-t-0">
                      {o.group}
                    </div>
                  );
                }
                items.push(
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--color-surface-3)] transition-colors ${
                      o.id === value
                        ? 'text-[var(--color-tg-orange)] font-medium bg-[var(--color-tg-orange)]/8'
                        : 'text-[var(--color-text-primary)]'
                    }`}
                  >
                    {o.label}
                  </button>
                );
                return items;
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Time Entry Form ----

function TimeEntryFormPanel({
  entryKey,
  initialNotes,
  globalDate,
  projects,
  lineItems,
  onSubmit,
  onCancel,
}: {
  entryKey: EntryKey;
  initialNotes: string;
  globalDate: string;
  projects: CashboardProject[];
  lineItems: CashboardLineItem[];
  onSubmit: (key: EntryKey, form: TimeEntryForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TimeEntryForm>(() => ({
    date: globalDate,
    projectId: '',
    lineItemId: '',
    notes: initialNotes,
    hours: '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectOptions: SelectOption[] = [...projects]
    .sort((a, b) => (a.client_name ?? '').localeCompare(b.client_name ?? ''))
    .map((p) => ({ id: p.id, label: p.name, group: p.client_name ?? undefined }));
  const lineItemOptions: SelectOption[] = lineItems
    .filter((li) => form.projectId === '' || li.project_id === form.projectId)
    .map((li) => ({ id: li.id, label: li.name ?? String(li.id) }));

  function setProjectId(id: number | '') {
    const lineItemId = id ? (bestLineItemMatch(lineItems, id as number)?.id ?? '') : '';
    setForm((f) => ({ ...f, projectId: id, lineItemId }));
  }

  const quickHours = [0.25, 0.5, 1, 1.5, 2];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId || !form.lineItemId || !form.hours || !form.date) {
      setError('Please fill in all required fields.');
      return;
    }
    const hours = parseFloat(form.hours);
    if (isNaN(hours) || hours <= 0) {
      setError('Please enter a valid number of hours.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(entryKey, form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-4 rounded-[8px] bg-[var(--color-surface-1)] border border-[var(--color-border)] space-y-3">
      {/* Row 1: Date + Hours */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-text-dim)] mb-1 uppercase tracking-wider">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full px-3 py-2 rounded-[7px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-text-dim)] mb-1 uppercase tracking-wider">Hours</label>
          <input
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            placeholder="e.g. 1.5"
            className="w-full px-3 py-2 rounded-[7px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all"
          />
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {quickHours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setForm((f) => ({ ...f, hours: String(h) }))}
                className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium border transition-colors ${
                  form.hours === String(h)
                    ? 'bg-[var(--color-tg-orange)]/15 border-[var(--color-tg-orange)]/40 text-[var(--color-tg-orange)]'
                    : 'bg-[var(--color-surface-3)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)]'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Project */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-text-dim)] mb-1 uppercase tracking-wider">
          Project <span className="text-[var(--color-danger)]">*</span>
        </label>
        <SearchableSelect
          options={projectOptions}
          value={form.projectId}
          onChange={setProjectId}
          placeholder="Select a project…"
        />
      </div>

      {/* Row 3: Work Type */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-text-dim)] mb-1 uppercase tracking-wider">
          Work Type <span className="text-[var(--color-danger)]">*</span>
        </label>
        <SearchableSelect
          options={lineItemOptions}
          value={form.lineItemId}
          onChange={(id) => setForm((f) => ({ ...f, lineItemId: id }))}
          placeholder={form.projectId ? 'Select work type…' : 'Select a project first…'}
          disabled={!form.projectId}
        />
      </div>

      {/* Row 4: Notes */}
      <div>
        <label className="block text-[11px] font-medium text-[var(--color-text-dim)] mb-1 uppercase tracking-wider">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          placeholder="What did you work on?"
          className="w-full px-3 py-2 rounded-[7px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-[12px] text-[var(--color-danger)] bg-[var(--color-danger-dim)] px-3 py-2 rounded-[6px] border border-[var(--color-danger)]/20">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-[6px] text-[13px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[13px] font-bold transition-all disabled:opacity-50 shadow-md shadow-[var(--color-tg-orange)]/20"
        >
          {submitting ? <Loader2 size={13} className="animate-spin-fast" /> : <Clock size={13} />}
          {submitting ? 'Logging…' : 'Log Time'}
        </button>
      </div>
    </form>
  );
}

// ---- Main Component ----

interface Props {
  groups: ShortcutGroup[];
  refreshTrigger?: number;
  onCashboardLoadingChange?: (loading: boolean) => void;
  onCashboardRefreshed?: () => void;
}

const CB_CACHE_KEY = 'tt-cashboard-cache-v2';
const CB_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CashboardCache {
  projects: CashboardProject[];
  lineItems: CashboardLineItem[];
  personId: number | null;
  cachedAt: string;
}

function readCbCache(): CashboardCache | null {
  try {
    const raw = localStorage.getItem(CB_CACHE_KEY);
    if (!raw) return null;
    const parsed: CashboardCache = JSON.parse(raw);
    if (Date.now() - new Date(parsed.cachedAt).getTime() > CB_CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function writeCbCache(data: Omit<CashboardCache, 'cachedAt'>) {
  try {
    localStorage.setItem(CB_CACHE_KEY, JSON.stringify({ ...data, cachedAt: new Date().toISOString() }));
  } catch {}
}

export function TimeTrackerView({ groups, refreshTrigger = 0, onCashboardLoadingChange, onCashboardRefreshed }: Props) {
  const [stories, setStories] = useState<MyStory[]>([]);
  const [projects, setProjects] = useState<CashboardProject[]>([]);
  const [lineItems, setLineItems] = useState<CashboardLineItem[]>([]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [cashboardLoading, setCashboardLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<EntryKey | null>(null);
  // Map of entry key → array of dates logged (e.g. ["Mar 13", "Mar 14"])
  const [loggedDates, setLoggedDates] = useState<Map<EntryKey, string[]>>(new Map());
  const [globalDate, setGlobalDate] = useState<string>(today());

  // Keep stable refs to callbacks so they don't bust the load() useCallback
  const onLoadingChangeRef = useRef(onCashboardLoadingChange);
  const onRefreshedRef = useRef(onCashboardRefreshed);
  useEffect(() => { onLoadingChangeRef.current = onCashboardLoadingChange; }, [onCashboardLoadingChange]);
  useEffect(() => { onRefreshedRef.current = onCashboardRefreshed; }, [onCashboardRefreshed]);

  // Group id -> name lookup
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));

  const load = useCallback(async (force = false) => {
    setStoriesLoading(true);
    setLoadError(null);

    // Serve Cashboard data from cache immediately if fresh (skipped on force refresh)
    const cache = force ? null : readCbCache();
    if (cache) {
      setProjects(cache.projects);
      setLineItems(cache.lineItems);
      setPersonId(cache.personId);
      setCashboardLoading(false);
      onLoadingChangeRef.current?.(false);
    } else {
      setCashboardLoading(true);
      onLoadingChangeRef.current?.(true);
    }

    // Stories always fetch fresh, Cashboard fetches in parallel
    const qs = force ? '?refresh=1' : '';
    const storiesPromise = fetch('/api/shortcut/my-stories');
    const cashboardPromise = cache ? Promise.resolve(null) : Promise.all([
      fetch('/api/cashboard/me'),
      fetch(`/api/cashboard/projects${qs}`),
      fetch(`/api/cashboard/line-items${qs}`),
    ]);

    // Resolve stories first — show them as soon as they're ready
    try {
      const storiesRes = await storiesPromise;
      if (!storiesRes.ok) throw new Error('Failed to load your Shortcut stories.');
      setStories(await storiesRes.json());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load stories.');
    } finally {
      setStoriesLoading(false);
    }

    // Resolve Cashboard data (skipped if cache was fresh)
    if (!cache) {
      try {
        const results = await cashboardPromise as [Response, Response, Response];
        const [meRes, projectsRes, lineItemsRes] = results;
        if (!projectsRes.ok) throw new Error('Failed to load Cashboard projects.');
        if (!lineItemsRes.ok) throw new Error('Failed to load Cashboard work types.');
        const [meData, projectsData, lineItemsData] = await Promise.all([
          meRes.json(), projectsRes.json(), lineItemsRes.json(),
        ]);
        const pid = meData.personId ?? null;
        setPersonId(pid);
        setProjects(projectsData);
        setLineItems(lineItemsData);
        writeCbCache({ projects: projectsData, lineItems: lineItemsData, personId: pid });
        onRefreshedRef.current?.();
      } catch (e) {
        // Non-fatal — stories still show, form controls will be empty
        console.error('Cashboard load failed:', e);
      } finally {
        setCashboardLoading(false);
        onLoadingChangeRef.current?.(false);
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Force-refresh when parent increments refreshTrigger
  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      try { localStorage.removeItem(CB_CACHE_KEY); } catch {}
      load(true);
    }
  }, [refreshTrigger, load]);


  async function handleSubmit(key: EntryKey, form: TimeEntryForm) {
    if (!personId) {
      throw new Error('Could not find your Cashboard person ID. Check that MY_SLACK_EMAIL matches your Cashboard email.');
    }
    const minutes = Math.round(parseFloat(form.hours) * 60);
    const res = await fetch('/api/cashboard/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_item_id: form.lineItemId,
        person_id: personId,
        minutes,
        description: form.notes,
        date: form.date,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Cashboard returned ${res.status}`);
    }

    const label = new Date(form.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    setLoggedDates((prev) => {
      const next = new Map(prev);
      next.set(key, [...(next.get(key) ?? []), label]);
      return next;
    });
    setExpandedKey(null);
  }

  function toggleForm(key: EntryKey) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  // ---- Loading state (stories only — Cashboard loads in background) ----
  if (storiesLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--color-text-dim)]">
        <Loader2 size={28} className="animate-spin-fast text-[var(--color-tg-orange)]" />
        <span className="text-[13px]">Loading your stories…</span>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
        <AlertCircle size={28} className="text-[var(--color-danger)]" />
        <p className="text-[13px] text-[var(--color-danger)] text-center max-w-md">{loadError}</p>
        <button
          onClick={() => load()}
          className="px-4 py-2 rounded-[8px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-8 max-w-[900px] mx-auto w-full custom-scrollbar">

      {/* Global date + person ID warning */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <Calendar size={15} className="text-[var(--color-text-dim)]" />
          <div className="flex items-center gap-2">
            <label className="text-[12px] text-[var(--color-text-muted)] font-medium">Default date</label>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => setGlobalDate(e.target.value)}
              className="px-2.5 py-1 rounded-[6px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-tg-orange)] transition-all"
            />
          </div>
        </div>
        {cashboardLoading ? (
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-dim)]">
            <Loader2 size={12} className="animate-spin-fast" />
            Loading Cashboard projects…
          </div>
        ) : !personId && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-warning)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/25 px-3 py-1.5 rounded-[6px]">
            <AlertCircle size={12} />
            Could not auto-detect Cashboard person ID — time entries may fail.
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div className="mb-6 p-4 rounded-[10px] bg-[var(--color-surface-1)] border border-[var(--color-border)] border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Manual Entry</p>
            <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">Log time for work not tied to a specific story.</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {(loggedDates.get('manual') ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {(loggedDates.get('manual') ?? []).map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
                    <Check size={9} /> {d}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => toggleForm('manual')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors ${
                expandedKey === 'manual'
                  ? 'bg-[var(--color-surface-3)] border-[var(--color-border-light)] text-[var(--color-text-primary)]'
                  : 'bg-[var(--color-surface-3)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)]'
              }`}
            >
              {expandedKey === 'manual' ? <ChevronUp size={13} /> : <Plus size={13} />}
              {expandedKey === 'manual' ? 'Cancel' : 'Add Entry'}
            </button>
          </div>
        </div>

        {expandedKey === 'manual' && (
          <TimeEntryFormPanel
            entryKey="manual"
            initialNotes=""
            globalDate={globalDate}
            projects={projects}
            lineItems={lineItems}

            onSubmit={handleSubmit}
            onCancel={() => setExpandedKey(null)}
          />
        )}
      </div>

      {/* Stories list */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] uppercase tracking-widest font-semibold text-[var(--color-text-dim)]">
          My Open Stories ({stories.length})
        </h2>
      </div>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--color-text-dim)]">
          <Check size={28} className="text-[var(--color-success)]" />
          <p className="text-[13px]">No open stories assigned to you.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {stories.map((story) => {
            const groupName = story.group_id ? groupMap[story.group_id] : null;
            const dl = formatDeadline(story.deadline);
            const dlColor = deadlineColor(story.deadline);
            const isExpanded = expandedKey === story.id;
            const storyDates = loggedDates.get(story.id) ?? [];
            const isCompleted = story.completed;

            return (
              <div
                key={story.id}
                className={`rounded-[10px] border transition-colors ${
                  isCompleted
                    ? 'bg-[var(--color-surface-base)] opacity-75'
                    : 'bg-[var(--color-surface-1)]'
                } ${
                  isExpanded ? 'border-[var(--color-tg-orange)]/40' : 'border-[var(--color-border)]'
                }`}
              >
                {/* Story row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Team badge */}
                  {groupName && (
                    <span className="shrink-0 px-2 py-0.5 rounded-[4px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider whitespace-nowrap max-w-[100px] truncate">
                      {groupName}
                    </span>
                  )}

                  {/* Story name */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={story.app_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[13px] font-medium hover:text-[var(--color-tg-orange)] transition-colors inline-flex items-center gap-1.5 group ${
                        isCompleted ? 'text-[var(--color-text-dim)] line-through decoration-[var(--color-text-dim)]/40' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      <span className="truncate">{story.name}</span>
                      <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-3 mt-0.5">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-1.5 py-0.5 rounded-[4px]">
                          <Check size={9} /> Completed
                        </span>
                      ) : (
                        story.state && (
                          <span className="text-[11px] text-[var(--color-text-dim)]">{story.state}</span>
                        )
                      )}
                      {!isCompleted && dl && (
                        <span className="text-[11px] font-medium" style={{ color: dlColor }}>{dl}</span>
                      )}
                    </div>
                  </div>

                  {/* Logged date badges + Log Time button */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {storyDates.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {storyDates.map((d, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
                            <Check size={9} /> {d}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => toggleForm(story.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border transition-colors ${
                        isExpanded
                          ? 'bg-[var(--color-surface-3)] border-[var(--color-border-light)] text-[var(--color-text-primary)]'
                          : 'bg-[var(--color-surface-3)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-light)]'
                      }`}
                    >
                      {isExpanded ? <X size={12} /> : <Clock size={12} />}
                      {isExpanded ? 'Cancel' : 'Log Time'}
                    </button>
                  </div>
                </div>

                {/* Inline form */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <TimeEntryFormPanel
                      entryKey={story.id}
                      initialNotes={story.name}
                      globalDate={globalDate}
                      projects={projects}
                      lineItems={lineItems}

                      onSubmit={handleSubmit}
                      onCancel={() => setExpandedKey(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
