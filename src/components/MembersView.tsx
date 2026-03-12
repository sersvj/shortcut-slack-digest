'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { AlertTriangle, Send, Users } from 'lucide-react';
import { MemberDigest, MemberConfig, AppConfig, SlackUser } from '@/lib/types';
import { MemberCard } from './MemberCard';

export interface MembersViewHandle {
  sendAll: () => Promise<void>;
}

interface MembersViewProps {
  config: AppConfig;
  onConfigChange: (newConfig: AppConfig) => Promise<void>;
  /** Controlled search string, from the shared header bar */
  search: string;
  /** Increment to trigger a fresh data fetch, from the shared Refresh button */
  refreshKey: number;
  /** Called whenever stats change so the header bar can update its labels */
  onStatsChange: (stats: { loading: boolean; optedInCount: number; total: number }) => void;
}

export const MembersView = forwardRef<MembersViewHandle, MembersViewProps>(function MembersView(
  { config, onConfigChange, search, refreshKey, onStatsChange },
  ref
) {
  const [digests, setDigests] = useState<MemberDigest[]>([]);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [digestsRes, usersRes] = await Promise.all([
        fetch('/api/shortcut/members/stories'),
        fetch('/api/slack/users'),
      ]);
      if (!digestsRes.ok) throw new Error('Failed to load member digests');
      setDigests(await digestsRes.json());
      if (usersRes.ok) setSlackUsers(await usersRes.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever refreshKey increments
  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  // Report stats upward whenever relevant values change
  const optedInCount = Object.values(config.memberMappings ?? {}).filter(
    (mc) => mc.optedIn && mc.slackUserId
  ).length;

  useEffect(() => {
    onStatsChange({ loading, optedInCount, total: digests.length });
  }, [loading, optedInCount, digests.length, onStatsChange]);

  const handleConfigChange = useCallback(
    async (memberId: string, update: Partial<MemberConfig>) => {
      const existing = config.memberMappings?.[memberId] ?? {
        slackUserId: '',
        slackUserName: '',
        optedIn: false,
        lastSentAt: null,
      };
      await onConfigChange({
        ...config,
        memberMappings: {
          ...config.memberMappings,
          [memberId]: { ...existing, ...update },
        },
      });
    },
    [config, onConfigChange]
  );

  const handleSendDM = useCallback(
    async (memberId: string) => {
      const res = await fetch('/api/slack/send-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: [memberId] }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.success) {
        showToast('success', 'DM sent successfully');
      } else {
        showToast('error', result?.error || 'Failed to send DM');
      }
    },
    [showToast]
  );

  const sendAll = useCallback(async () => {
    const optedInIds = Object.entries(config.memberMappings ?? {})
      .filter(([, mc]) => mc.optedIn && mc.slackUserId)
      .map(([id]) => id);

    if (optedInIds.length === 0) {
      showToast('error', 'No opted-in members with a Slack user mapped');
      return;
    }

    const res = await fetch('/api/slack/send-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: optedInIds }),
    });
    const data = await res.json();
    const successCount = data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
    const failCount = data.results?.filter((r: { success: boolean }) => !r.success).length ?? 0;
    if (successCount > 0) showToast('success', `${successCount} DM${successCount > 1 ? 's' : ''} sent`);
    if (failCount > 0) showToast('error', `${failCount} DM${failCount > 1 ? 's' : ''} failed`);
  }, [config, showToast]);

  // Expose sendAll to the parent via ref
  useImperativeHandle(ref, () => ({ sendAll }), [sendAll]);

  const q = search.trim().toLowerCase();
  const filtered = q ? digests.filter((d) => d.name.toLowerCase().includes(q)) : digests;

  const totalOpen = digests.reduce((s, d) => s + d.owned.total + d.requested.total, 0);
  const totalOverdue = digests.reduce(
    (s, d) => s + d.owned.overdue.length + d.requested.overdue.length,
    0
  );

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <main className={`flex-1 ${isMobile ? '' : 'overflow-hidden'} flex flex-col px-4 sm:px-6 pt-4 sm:pt-6 pb-2 max-w-[900px] mx-auto w-full`}>
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-[8px] bg-[var(--color-danger-dim)] border border-[var(--color-danger)]/25 text-[var(--color-danger)] text-[13px]">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Summary bar */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-6 px-5 py-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[10px] shadow-sm">
          <StatItem value={digests.length} label="Members" />
          <DividerBar />
          <StatItem value={totalOpen} label="Open Stories" />
          <DividerBar />
          <StatItem value={totalOverdue} label="Overdue" highlight={totalOverdue > 0} />
          <DividerBar />
          <StatItem value={optedInCount} label="Opted-In" />
        </div>
      )}

      {/* Cards */}
      <div className={`flex-1 min-h-0 ${isMobile ? '' : 'overflow-y-auto pr-3'} pb-8 custom-scrollbar`}>
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 rounded-[10px] skeleton-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users size={28} className="text-[var(--color-text-dim)]" />
            <p className="text-[12px] text-[var(--color-text-dim)] max-w-[200px]">
              {search ? 'No members match your search.' : 'No members with open stories found.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((digest) => (
              <MemberCard
                key={digest.id}
                digest={digest}
                config={config.memberMappings?.[digest.id] ?? null}
                slackUsers={slackUsers}
                onConfigChange={handleConfigChange}
                onSendDM={handleSendDM}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-[8px] shadow-xl text-[13px] border toast-enter z-50 ${
            toast.type === 'success'
              ? 'bg-[var(--color-surface-2)] border-[var(--color-success)]/35 text-[var(--color-success)]'
              : 'bg-[var(--color-surface-2)] border-[var(--color-danger)]/35 text-[var(--color-danger)]'
          }`}
        >
          {toast.type === 'success' ? <Send size={13} /> : <AlertTriangle size={13} />}
          {toast.message}
        </div>
      )}
    </main>
  );
});

function StatItem({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-[22px] font-bold leading-none ${highlight ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] font-medium">
        {label}
      </span>
    </div>
  );
}

function DividerBar() {
  return <div className="w-px h-8 bg-[var(--color-border)]" />;
}
