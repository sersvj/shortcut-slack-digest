'use client';

import { useState, useCallback } from 'react';
import {
  Send,
  ArrowDown,
  ArrowUp,
  Clock,
  AlertCircle,
  CalendarClock,
  Calendar,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { ShortcutGroup, CategorizedStories, SlackChannel, TeamConfig } from '@/lib/types';
import { DigestPreview } from './DigestPreview';

interface ClientCardProps {
  group: ShortcutGroup;
  config: TeamConfig | null;
  stories: CategorizedStories | null;
  loadingStories: boolean;
  slackChannels: SlackChannel[];
  isActive: boolean;
  onToggleActive: (groupId: string, active: boolean) => void;
  onChannelChange: (groupId: string, channelId: string, channelName: string) => void;
  onSendSingle: (groupId: string, groupName: string) => Promise<void>;
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

export function ClientCard({
  group,
  config,
  stories,
  loadingStories,
  slackChannels,
  isActive,
  onToggleActive,
  onChannelChange,
  onSendSingle,
}: ClientCardProps) {
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const teamColor = group.color || '#e8622d';

  const handleSend = useCallback(async () => {
    if (!config?.slackChannelId) return;
    setSending(true);
    setSentSuccess(false);
    try {
      await onSendSingle(group.id, group.name);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 4000);
    } finally {
      setSending(false);
    }
  }, [config, group, onSendSingle]);

  const hasChannel = !!config?.slackChannelId;

  const cardBorder = sentSuccess
    ? 'border-[var(--color-success)]/40'
    : isActive
    ? 'border-[var(--color-tg-orange)]/25'
    : 'border-[var(--color-border)]';

  return (
    <div
      className={`rounded-[10px] bg-[var(--color-surface-1)] border ${cardBorder} overflow-hidden transition-all duration-200 hover:border-[var(--color-border-light)] ${sending ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Color swatch */}
        <div
          className="w-1 h-9 rounded-full shrink-0"
          style={{ background: teamColor }}
        />

        {/* Team name + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">
            {group.name}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {loadingStories ? (
              <span className="flex items-center gap-1">
                <Loader2 size={10} className="animate-spin-fast" /> Loading…
              </span>
            ) : stories ? (
              `${stories.total} open ${stories.total === 1 ? 'story' : 'stories'}`
            ) : (
              'No data'
            )}
          </div>
        </div>

        {/* Send button */}
        {hasChannel && (
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[12px] font-medium transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={13} className="animate-spin-fast" /> : <Send size={13} />}
            {sending ? 'Sending' : 'Send'}
          </button>
        )}
      </div>

      {/* Bucket chips */}
      {stories && stories.total > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {stories.overdue.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-danger-dim)] text-[var(--color-danger)] border border-[var(--color-danger)]/20">
              <AlertCircle size={10} /> {stories.overdue.length} overdue
            </span>
          )}
          {stories.today.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[var(--color-warning)]/20">
              <Clock size={10} /> {stories.today.length} today
            </span>
          )}
          {stories.this_week.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]/20">
              <CalendarClock size={10} /> {stories.this_week.length} this week
            </span>
          )}
          {stories.later.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-info-dim)] text-[var(--color-info)] border border-[var(--color-info)]/20">
              <CalendarDays size={10} /> {stories.later.length} later
            </span>
          )}
          {stories.no_due_date.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-3)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
              <Calendar size={10} /> {stories.no_due_date.length} no date
            </span>
          )}
        </div>
      )}

      {/* Channel Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 pb-3">
        <span className="text-[11px] text-[var(--color-text-dim)] shrink-0 font-medium uppercase tracking-wide">
          Channel
        </span>
        <select
          className="w-full sm:flex-1 bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[12px] px-2.5 py-1.5 rounded-[6px] cursor-pointer focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors"
          value={config?.slackChannelId || ''}
          onChange={(e) => {
            const selected = slackChannels.find((c) => c.id === e.target.value);
            onChannelChange(group.id, e.target.value, selected?.name || '');
          }}
        >
          <option value="">— Select a channel —</option>
          {slackChannels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Digest Preview (collapsible) */}
      {stories && <DigestPreview teamName={group.name} stories={stories} />}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[var(--color-border)] bg-black/10">
        <button
          onClick={() => onToggleActive(group.id, !isActive)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {isActive ? (
            <>
              <ArrowDown size={12} /> Move to Inactive
            </>
          ) : (
            <>
              <ArrowUp size={12} className="text-[var(--color-success)]" />
              <span className="text-[var(--color-success)]">Move to Active</span>
            </>
          )}
        </button>
        {config?.lastSentAt && (
          <span className="ml-auto text-[11px] text-[var(--color-text-dim)]">
            Sent {timeSince(config.lastSentAt)}
          </span>
        )}
      </div>
    </div>
  );
}
