'use client';

import { CategorizedStory } from '@/lib/types';

export function StoryLine({ story }: { story: CategorizedStory }) {
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

export function DigestSection({
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

export function DigestBody({ stories }: { stories: import('@/lib/types').CategorizedStories }) {
  if (stories.total === 0) {
    return (
      <p className="text-[var(--color-text-dim)] italic text-[12px]">
        No open stories at this time.
      </p>
    );
  }
  return (
    <>
      <DigestSection label="Overdue" color="var(--color-danger)" stories={stories.overdue} />
      <DigestSection label="Due Today" color="var(--color-warning)" stories={stories.today} />
      <DigestSection label="Due This Week" color="var(--color-success)" stories={stories.this_week} />
      <DigestSection label="Due Later" color="#818cf8" stories={stories.later} />
      <DigestSection label="No Due Date" color="var(--color-text-muted)" stories={stories.no_due_date} />
    </>
  );
}
