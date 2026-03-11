'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  RefreshCw,
  Send,
  Loader2,
  AlertTriangle,
  LayoutGrid,
  Inbox,
  Search,
  LogOut,
  Clock,
} from 'lucide-react';
import { ShortcutGroup, CategorizedStories, SlackChannel, AppConfig, CronConfig } from '@/lib/types';
import { ClientCard } from '@/components/ClientCard';
import { CronSettingsModal } from '@/components/CronSettingsModal';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let toastId = 0;

export default function DashboardPage() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<ShortcutGroup[]>([]);
  const [config, setConfig] = useState<AppConfig>({ mappings: {} });
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [storiesMap, setStoriesMap] = useState<Record<string, CategorizedStories>>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingStoriesFor, setLoadingStoriesFor] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [showCronModal, setShowCronModal] = useState(false);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const fetchStoriesForGroup = useCallback(async (groupId: string) => {
    setLoadingStoriesFor((prev) => new Set([...prev, groupId]));
    try {
      const res = await fetch(`/api/shortcut/groups/${groupId}/stories`);
      if (!res.ok) throw new Error('Failed');
      const data: CategorizedStories = await res.json();
      setStoriesMap((prev) => ({ ...prev, [groupId]: data }));
    } catch {
      // silently fail per-card
    } finally {
      setLoadingStoriesFor((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, []);

  const CACHE_KEY = 'tg-digest-cache';

  const readCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        groups: ShortcutGroup[];
        storiesMap: Record<string, CategorizedStories>;
        cachedAt: string;
      };
    } catch {
      return null;
    }
  }, []);

  const writeCache = useCallback((groups: ShortcutGroup[], storiesMap: Record<string, CategorizedStories>) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ groups, storiesMap, cachedAt: new Date().toISOString() }));
    } catch {}
  }, []);

  const loadAllData = useCallback(async (forceRefresh = false) => {
    setError(null);

    // On first load, try to serve from cache immediately
    if (!forceRefresh) {
      const cache = readCache();
      if (cache) {
        setGroups(cache.groups);
        setStoriesMap(cache.storiesMap);
        setCachedAt(new Date(cache.cachedAt));
        // Still fetch config + channels fresh (fast calls)
        const [configRes, channelsRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/slack/channels'),
        ]);
        if (configRes.ok) setConfig(await configRes.json());
        if (channelsRes.ok) setSlackChannels(await channelsRes.json());
        setLoadingGroups(false);
        return;
      }
    }

    // Full refresh from Shortcut API
    setLoadingGroups(true);
    setStoriesMap({});

    try {
      const [groupsRes, configRes, channelsRes] = await Promise.all([
        fetch('/api/shortcut/groups'),
        fetch('/api/config'),
        fetch('/api/slack/channels'),
      ]);

      if (!groupsRes.ok) throw new Error('Failed to load Shortcut teams. Check your API token.');

      const groupsData: ShortcutGroup[] = await groupsRes.json();
      const configData: AppConfig = configRes.ok ? await configRes.json() : { mappings: {} };
      const channelsData: SlackChannel[] = channelsRes.ok ? await channelsRes.json() : [];

      setGroups(groupsData);
      setConfig(configData);
      setSlackChannels(channelsData);

      // Fetch stories for all groups in parallel — single pass, used for both state + cache
      const freshStoriesEntries = await Promise.all(
        groupsData.map(async (g) => {
          setLoadingStoriesFor((prev) => new Set([...prev, g.id]));
          try {
            const res = await fetch(`/api/shortcut/groups/${g.id}/stories`);
            if (!res.ok) return [g.id, null] as const;
            return [g.id, await res.json() as CategorizedStories] as const;
          } catch {
            return [g.id, null] as const;
          } finally {
            setLoadingStoriesFor((prev) => {
              const next = new Set(prev);
              next.delete(g.id);
              return next;
            });
          }
        })
      );
      const freshStoriesMap: Record<string, CategorizedStories> = {};
      for (const [id, data] of freshStoriesEntries) {
        if (data) freshStoriesMap[id] = data;
      }
      setStoriesMap(freshStoriesMap);
      writeCache(groupsData, freshStoriesMap);
      setCachedAt(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingGroups(false);
    }
  }, [readCache, writeCache]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const saveConfig = useCallback(async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
  }, []);

  const handleChannelChange = useCallback(
    (groupId: string, channelId: string, channelName: string) => {
      const existing = config.mappings[groupId] || {
        slackChannelId: '',
        slackChannelName: '',
        active: false,
        lastSentAt: null,
      };
      saveConfig({
        ...config,
        mappings: { ...config.mappings, [groupId]: { ...existing, slackChannelId: channelId, slackChannelName: channelName } },
      });
    },
    [config, saveConfig]
  );

  const handleToggleActive = useCallback(
    (groupId: string, active: boolean) => {
      const existing = config.mappings[groupId] || {
        slackChannelId: '',
        slackChannelName: '',
        active: false,
        lastSentAt: null,
      };
      saveConfig({
        ...config,
        mappings: { ...config.mappings, [groupId]: { ...existing, active } },
      });
    },
    [config, saveConfig]
  );

  const sendDigests = useCallback(
    async (teamIds: string[]) => {
      const teamNames: Record<string, string> = {};
      for (const g of groups) teamNames[g.id] = g.name;

      const res = await fetch('/api/slack/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds, teamNames }),
      });

      const data = await res.json();
      const newMappings = { ...config.mappings };
      for (const result of data.results || []) {
        if (result.success && newMappings[result.teamId]) {
          newMappings[result.teamId] = { ...newMappings[result.teamId], lastSentAt: new Date().toISOString() };
        }
      }
      setConfig({ ...config, mappings: newMappings });

      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const failCount = data.results?.filter((r: any) => !r.success).length || 0;
      if (successCount > 0) addToast('success', `${successCount} digest${successCount > 1 ? 's' : ''} sent to Slack`);
      if (failCount > 0) addToast('error', `${failCount} digest${failCount > 1 ? 's' : ''} failed to send`);
    },
    [config, groups, addToast]
  );

  const handleSendAll = useCallback(async () => {
    const activeIds = groups
      .filter((g) => config.mappings[g.id]?.active && config.mappings[g.id]?.slackChannelId)
      .map((g) => g.id);
    if (activeIds.length === 0) {
      addToast('error', 'No active teams with mapped channels');
      return;
    }
    setSendingAll(true);
    try {
      await sendDigests(activeIds);
    } finally {
      setSendingAll(false);
    }
  }, [groups, config, sendDigests, addToast]);

  const handleSendSingle = useCallback(
    async (groupId: string, groupName: string) => {
      await sendDigests([groupId]);
    },
    [sendDigests]
  );

  const handleSaveCron = useCallback(
    async (cron: CronConfig) => {
      const newConfig = { ...config, cron };
      setConfig(newConfig);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      addToast('success', 'Schedule settings saved');
    },
    [config, addToast]
  );

  const q = search.trim().toLowerCase();
  const filtered = (arr: ShortcutGroup[]) =>
    q ? arr.filter((g) => g.name.toLowerCase().includes(q)) : arr;

  const activeGroups = filtered(groups.filter((g) => config.mappings[g.id]?.active));
  const inactiveGroups = filtered(groups.filter((g) => !config.mappings[g.id]?.active));
  const activeWithChannel = groups
    .filter((g) => config.mappings[g.id]?.active && config.mappings[g.id]?.slackChannelId);

  const totalOpen = Object.values(storiesMap).reduce((s, st) => s + st.total, 0);
  const totalOverdue = Object.values(storiesMap).reduce((s, st) => s + st.overdue.length, 0);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-[var(--color-surface-1)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[var(--color-tg-orange)] flex items-center justify-center">
            <LayoutGrid size={15} className="text-white" />
          </div>
          <div>
            <span className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
              T/G Daily Digest
            </span>
            <span className="ml-2 text-[12px] text-[var(--color-text-dim)]">Shortcut × Slack</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search teams…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors w-48"
            />
          </div>
          <button
            onClick={() => setShowCronModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors"
            title="Schedule settings"
          >
            <Clock size={13} />
            Schedule
            {config.cron && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-tg-orange)]" />
            )}
          </button>
          <button
            onClick={() => loadAllData(true)}
            disabled={loadingGroups}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingGroups ? 'animate-spin-fast' : ''} />
            Refresh
          </button>
          {cachedAt && !loadingGroups && (
            <span className="text-[11px] text-[var(--color-text-dim)]">
              Updated {cachedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleSendAll}
            disabled={sendingAll || loadingGroups || activeWithChannel.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
          >
            {sendingAll ? <Loader2 size={13} className="animate-spin-fast" /> : <Send size={13} />}
            {sendingAll
              ? 'Sending…'
              : `Send Active${activeWithChannel.length > 0 ? ` (${activeWithChannel.length})` : ''}`}
          </button>
          {/* User avatar + sign out */}
          {session?.user && (
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-[var(--color-border)]">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-7 h-7 rounded-full border border-[var(--color-border)]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-muted)]">
                  {(session.user.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-1 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors"
                title="Sign out"
              >
                <LogOut size={12} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-6 max-w-[1400px] mx-auto w-full">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-[8px] bg-[var(--color-danger-dim)] border border-[var(--color-danger)]/25 text-[var(--color-danger)] text-[13px]">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Summary bar */}
        {!loadingGroups && (
          <div className="flex items-center gap-5 mb-6 px-5 py-3.5 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[10px]">
            <Stat value={groups.length} label="Teams" />
            <Divider />
            <Stat value={activeGroups.length} label="Active" />
            <Divider />
            <Stat value={totalOpen} label="Open Stories" />
            <Divider />
            <Stat value={totalOverdue} label="Overdue" highlight={totalOverdue > 0} />
          </div>
        )}

        {/* Loading skeletons */}
        {loadingGroups && (
          <div className="grid grid-cols-2 gap-6">
            {[0, 1].map((col) => (
              <div key={col} className="flex flex-col gap-3">
                <ColHeader active={col === 0} count={0} />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-36 rounded-[10px] skeleton-shimmer" />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Two-column grid */}
        {!loadingGroups && (
          <div className="grid grid-cols-2 gap-6 items-start">
            {/* Active */}
            <div className="flex flex-col gap-3">
              <ColHeader active={true} count={activeGroups.length} />
              {activeGroups.length === 0 ? (
                <EmptyState
                  icon={<Inbox size={28} className="text-[var(--color-text-dim)]" />}
                  text="No active teams. Move cards here to include them in bulk sends."
                />
              ) : (
                activeGroups.map((g) => (
                  <ClientCard
                    key={g.id}
                    group={g}
                    config={config.mappings[g.id] || null}
                    stories={storiesMap[g.id] || null}
                    loadingStories={loadingStoriesFor.has(g.id)}
                    slackChannels={slackChannels}
                    isActive={true}
                    onToggleActive={handleToggleActive}
                    onChannelChange={handleChannelChange}
                    onSendSingle={handleSendSingle}
                  />
                ))
              )}
            </div>

            {/* Inactive */}
            <div className="flex flex-col gap-3">
              <ColHeader active={false} count={inactiveGroups.length} />
              {inactiveGroups.length === 0 ? (
                <EmptyState
                  icon={<Send size={28} className="text-[var(--color-text-dim)]" />}
                  text="All teams are active."
                />
              ) : (
                inactiveGroups.map((g) => (
                  <ClientCard
                    key={g.id}
                    group={g}
                    config={config.mappings[g.id] || null}
                    stories={storiesMap[g.id] || null}
                    loadingStories={loadingStoriesFor.has(g.id)}
                    slackChannels={slackChannels}
                    isActive={false}
                    onToggleActive={handleToggleActive}
                    onChannelChange={handleChannelChange}
                    onSendSingle={handleSendSingle}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter flex items-center gap-2 px-4 py-3 rounded-[8px] shadow-xl text-[13px] border ${
              t.type === 'success'
                ? 'bg-[var(--color-surface-2)] border-[var(--color-success)]/35 text-[var(--color-success)]'
                : 'bg-[var(--color-surface-2)] border-[var(--color-danger)]/35 text-[var(--color-danger)]'
            }`}
          >
            {t.type === 'success' ? <Send size={13} /> : <AlertTriangle size={13} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Cron Settings Modal */}
      {showCronModal && (
        <CronSettingsModal
          config={config}
          onClose={() => setShowCronModal(false)}
          onSave={handleSaveCron}
        />
      )}
    </div>
  );
}

// ---- Small sub-components ----

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`text-[22px] font-bold leading-none ${highlight ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] font-medium">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-[var(--color-border)]" />;
}

function ColHeader({ active, count }: { active: boolean; count: number }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
      <div
        className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-dim)]'}`}
        style={active ? { boxShadow: '0 0 6px var(--color-success)' } : {}}
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--color-text-muted)]">
        {active ? 'Active' : 'Inactive'}
      </span>
      <span className="ml-auto bg-[var(--color-surface-3)] text-[var(--color-text-dim)] rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
        {count}
      </span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon}
      <p className="text-[12px] text-[var(--color-text-dim)] max-w-[200px]">{text}</p>
    </div>
  );
}
