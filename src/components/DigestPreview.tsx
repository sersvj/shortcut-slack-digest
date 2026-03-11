'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { CategorizedStories, CategorizedStory } from '@/lib/types';

interface DigestPreviewProps {
  teamName: string;
  stories: CategorizedStories;
}

function StoryLine({ story }: { story: CategorizedStory }) {
  const deadline = story.deadline
    ? new Date(story.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="flex items-baseline gap-2 py-0.5 pl-4 text-[var(--color-text-muted)]">
      <span className="text-[var(--color-text-dim)]">›</span>
      <a
        href={story.app_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#7dd3fc] hover:underline truncate max-w-[280px] shrink-0"
      >
        {story.name}
      </a>
      <span className="text-[var(--color-text-dim)] text-[11px] shrink-0">
        — {story.owners.length > 0 ? story.owners.join(', ') : 'Unassigned'}
        {story.state && ` [${story.state}]`}
        {deadline && ` (${deadline})`}
      </span>
    </div>
  );
}

function Section({
  label,
  color,
  stories,
}: {
  label: string;
  color: string;
  stories: CategorizedStory[];
}) {
  if (stories.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color }}>
        {label} <span className="opacity-50">({stories.length})</span>
      </div>
      {stories.map((s) => (
        <StoryLine key={s.id} story={s} />
      ))}
    </div>
  );
}

export function DigestPreview({ teamName, stories }: DigestPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-[12px] font-medium"
      >
        <ExternalLink size={13} />
        <span>Digest Preview</span>
        <ChevronDown
          size={14}
          className={`ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="digest-preview-area border-t border-[var(--color-border)] p-4 overflow-x-auto">
          <div className="flex items-baseline gap-3 mb-3 pb-3 border-b border-[var(--color-border)]">
            <span className="text-[13px] font-bold text-[var(--color-text-primary)]">
              {teamName} — Daily Digest
            </span>
            <span className="text-[11px] text-[var(--color-text-dim)]">{today}</span>
          </div>

          {stories.total === 0 ? (
            <p className="text-[var(--color-text-dim)] italic text-[12px]">
              No open stories at this time.
            </p>
          ) : (
            <>
              <Section label="Overdue" color="var(--color-danger)" stories={stories.overdue} />
              <Section label="Due Today" color="var(--color-warning)" stories={stories.today} />
              <Section label="Due This Week" color="var(--color-success)" stories={stories.this_week} />
              <Section label="Due Later" color="#818cf8" stories={stories.later} />
              <Section label="No Due Date" color="var(--color-text-muted)" stories={stories.no_due_date} />
            </>
          )}

          <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-dim)]">
            {stories.total} open {stories.total === 1 ? 'story' : 'stories'} total
          </div>
        </div>
      )}
    </>
  );
}
