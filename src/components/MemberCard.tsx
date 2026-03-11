'use client';

import { useState, useCallback } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  Clock,
  CalendarClock,
  CalendarDays,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { MemberDigest, MemberConfig, CategorizedStories } from '@/lib/types';
import { DigestBody } from './digest-sections';

interface SlackUser {
  id: string;
  name: string;
}

interface MemberCardProps {
  digest: MemberDigest;
  config: MemberConfig | null;
  slackUsers: SlackUser[];
  onConfigChange: (memberId: string, config: Partial<MemberConfig>) => void;
  onSendDM: (memberId: string) => Promise<void>;
}

function ChipRow({ owned, requested }: { owned: CategorizedStories; requested: CategorizedStories }) {
  const combined = {
    overdue: owned.overdue.length + requested.overdue.length,
    today: owned.today.length + requested.today.length,
    this_week: owned.this_week.length + requested.this_week.length,
    later: owned.later.length + requested.later.length,
    no_due_date: owned.no_due_date.length + requested.no_due_date.length,
  };
  const total = owned.total + requested.total;
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {combined.overdue > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-danger-dim)] text-[var(--color-danger)] border border-[var(--color-danger)]/20">
          <AlertCircle size={10} /> {combined.overdue} overdue
        </span>
      )}
      {combined.today > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[var(--color-warning)]/20">
          <Clock size={10} /> {combined.today} today
        </span>
      )}
      {combined.this_week > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]/20">
          <CalendarClock size={10} /> {combined.this_week} this week
        </span>
      )}
      {combined.later > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-info-dim)] text-[var(--color-info)] border border-[var(--color-info)]/20">
          <CalendarDays size={10} /> {combined.later} later
        </span>
      )}
      {combined.no_due_date > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
          <Calendar size={10} /> {combined.no_due_date} no date
        </span>
      )}
    </div>
  );
}

function TabPanel({
  digest,
}: {
  digest: MemberDigest;
}) {
  const hasOwned = digest.owned.total > 0;
  const hasRequested = digest.requested.total > 0;
  const tabs = [
    ...(hasOwned ? [{ key: 'owned' as const, label: 'Owned Tasks', stories: digest.owned }] : []),
    ...(hasRequested ? [{ key: 'requested' as const, label: 'Requested Tasks', stories: digest.requested }] : []),
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? 'owned');
  const [isOpen, setIsOpen] = useState(false);

  if (tabs.length === 0) return null;

  const activeStories = tabs.find((t) => t.key === activeTab)?.stories;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-[12px] font-medium"
      >
        <span>Task Digest</span>
        <ChevronDown
          size={14}
          className={`ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[var(--color-border)]">
          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-[12px] font-medium transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-[var(--color-tg-orange)] text-[var(--color-tg-orange)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-60">({tab.stories.total})</span>
                </button>
              ))}
            </div>
          )}

          <div className="digest-preview-area p-4">
            {activeStories && <DigestBody stories={activeStories} />}
          </div>
        </div>
      )}
    </>
  );
}

export function MemberCard({
  digest,
  config,
  slackUsers,
  onConfigChange,
  onSendDM,
}: MemberCardProps) {
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const totalStories = digest.owned.total + digest.requested.total;
  const initial = digest.name.charAt(0).toUpperCase();

  const handleSend = useCallback(async () => {
    setSending(true);
    setSentSuccess(false);
    try {
      await onSendDM(digest.id);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 4000);
    } finally {
      setSending(false);
    }
  }, [digest.id, onSendDM]);

  const cardBorder = sentSuccess
    ? 'border-[var(--color-success)]/40'
    : 'border-[var(--color-border)]';

  return (
    <div
      className={`rounded-[10px] bg-[var(--color-surface-1)] border ${cardBorder} overflow-hidden transition-all duration-200 hover:border-[var(--color-border-light)] ${sending ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[var(--color-tg-orange)]/15 border border-[var(--color-tg-orange)]/30 flex items-center justify-center text-[14px] font-bold text-[var(--color-tg-orange)] shrink-0">
          {initial}
        </div>

        {/* Name + story count */}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">
            {digest.name}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {totalStories} open {totalStories === 1 ? 'story' : 'stories'}
            <span className="text-[var(--color-text-dim)]">
              {' '}· {digest.owned.total} owned · {digest.requested.total} requested
            </span>
          </div>
        </div>

        {/* Send DM button */}
        {config?.slackUserId && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={13} className="animate-spin-fast" /> : <Send size={13} />}
            {sending ? 'Sending' : 'Send DM'}
          </button>
        )}
      </div>

      {/* Chips */}
      <ChipRow owned={digest.owned} requested={digest.requested} />

      {/* Slack User Selector */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <span className="text-[11px] text-[var(--color-text-dim)] shrink-0 font-medium uppercase tracking-wide">
          Slack User
        </span>
        <select
          className="flex-1 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[12px] px-2.5 py-1.5 rounded-[6px] cursor-pointer focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors"
          value={config?.slackUserId || ''}
          onChange={(e) => {
            const selected = slackUsers.find((u) => u.id === e.target.value);
            onConfigChange(digest.id, {
              slackUserId: e.target.value,
              slackUserName: selected?.name || '',
            });
          }}
        >
          <option value="">— Select a Slack user —</option>
          {slackUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Opt-in toggle */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <label className="flex items-center gap-2 cursor-pointer group select-none">
          <div
            onClick={() => onConfigChange(digest.id, { optedIn: !config?.optedIn })}
            className={`relative w-8 h-4.5 rounded-full transition-colors ${
              config?.optedIn ? 'bg-[var(--color-tg-orange)]' : 'bg-[var(--color-surface-3)] border border-[var(--color-border)]'
            }`}
            style={{ width: '32px', height: '18px' }}
            role="checkbox"
            aria-checked={!!config?.optedIn}
          >
            <div
              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                config?.optedIn ? 'translate-x-[16px]' : 'translate-x-[2px]'
              }`}
            />
          </div>
          <span className="text-[12px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
            Include in Monday digest
          </span>
        </label>

        {config?.lastSentAt && (
          <span className="ml-auto text-[11px] text-[var(--color-text-dim)]">
            Sent {timeSince(config.lastSentAt)}
          </span>
        )}
      </div>

      {/* Collapsible digest tabs */}
      <TabPanel digest={digest} />
    </div>
  );
}

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
