'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Users, AlertCircle, Clock, Calendar, CalendarClock, CalendarDays, Search } from 'lucide-react';
import { ShortcutGroup, CategorizedStories, CategorizedStory, AppConfig } from '@/lib/types';

interface SummaryReportViewProps {
  groups: ShortcutGroup[];
  config: AppConfig;
  storiesMap: Record<string, CategorizedStories>;
  search: string;
}

export function SummaryReportView({ groups, config, storiesMap, search }: SummaryReportViewProps) {
  const q = search.trim().toLowerCase();
  const activeGroups = groups
    .filter((g) => config.mappings[g.id]?.active)
    .filter((g) => !q || g.name.toLowerCase().includes(q));

  return (
    <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-[1400px] mx-auto w-full custom-scrollbar">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Summary Report</h1>
        <p className="text-[var(--color-text-dim)] text-sm mt-1">
          Condensed view of tasks for all active teams.
        </p>
      </div>

      <div className="space-y-4">
        {activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-surface-1)] rounded-[12px] border border-[var(--color-border)] border-dashed">
            {q ? (
               <>
                 <Search size={48} className="text-[var(--color-text-dim)] mb-4 opacity-20" />
                 <p className="text-[var(--color-text-muted)] font-medium">No teams match &quot;{search}&quot;</p>
               </>
            ) : (
              <>
                <Users size={48} className="text-[var(--color-text-dim)] mb-4 opacity-20" />
                <p className="text-[var(--color-text-muted)] font-medium">No active teams selected.</p>
                <p className="text-[var(--color-text-dim)] text-sm mt-1">Move teams to &quot;Active&quot; in the Team Tasks panel to see them here.</p>
              </>
            )}
          </div>
        ) : (
          activeGroups.map((group) => (
            <TeamAccordion
              key={group.id}
              group={group}
              stories={storiesMap[group.id]}
            />
          ))
        )}
      </div>
    </main>
  );
}

function TeamAccordion({ group, stories }: { group: ShortcutGroup; stories?: CategorizedStories }) {
  const [isOpen, setIsOpen] = useState(false);
  const teamColor = group.color || '#e8622d';

  if (!stories) return null;

  return (
    <div className="rounded-[10px] bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors text-left"
      >
        <div
          className="w-1 h-6 rounded-full shrink-0"
          style={{ background: teamColor }}
        />
        {isOpen ? <ChevronDown size={18} className="text-[var(--color-text-dim)]" /> : <ChevronRight size={18} className="text-[var(--color-text-dim)]" />}
        <span className="text-[15px] font-bold text-[var(--color-text-primary)]">{group.name}</span>
        <span className="ml-auto text-[12px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-3)] px-2 py-0.5 rounded-full">
          {stories.total} Stories
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 animate-fade-in">
          {stories.total === 0 ? (
            <p className="text-[13px] text-[var(--color-text-dim)] italic py-2">No open stories.</p>
          ) : (
            <div className="space-y-6 mt-2">
              <SummarySection label="Overdue" color="var(--color-danger)" stories={stories.overdue} icon={<AlertCircle size={14} />} />
              <SummarySection label="Due Today" color="var(--color-warning)" stories={stories.today} icon={<Clock size={14} />} />
              <SummarySection label="Due This Week" color="var(--color-success)" stories={stories.this_week} icon={<CalendarClock size={14} />} />
              <SummarySection label="Due Later" color="#818cf8" stories={stories.later} icon={<CalendarDays size={14} />} />
              <SummarySection label="No Due Date" color="var(--color-text-muted)" stories={stories.no_due_date} icon={<Calendar size={14} />} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummarySection({ label, color, stories, icon }: { label: string; color: string; stories: CategorizedStory[]; icon: React.ReactNode }) {
  if (stories.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color }}>
        {icon}
        {label} ({stories.length})
      </div>
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              <th className="py-2 font-medium w-auto min-w-[300px]">Task / Story Name</th>
              <th className="py-2 font-medium w-64 px-4">Assignees</th>
              <th className="py-2 font-medium w-48 px-4">Status</th>
              <th className="py-2 font-medium w-32 text-right">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]/50">
            {stories.map((story) => (
              <tr key={story.id} className="group hover:bg-[var(--color-surface-2)] transition-colors">
                <td className="py-2.5 pr-6 text-[13px] truncate">
                  <a
                    href={story.app_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[var(--color-text-primary)] hover:text-[var(--color-tg-orange)] transition-colors"
                  >
                    <span className="truncate">{story.name}</span>
                    <ExternalLink size={10} className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                  </a>
                </td>
                <td className="py-2.5 px-4 text-[12px] text-[var(--color-text-muted)] truncate">
                  {story.owners.length > 0 ? story.owners.join(', ') : <span className="text-[var(--color-text-dim)] italic">Unassigned</span>}
                </td>
                <td className="py-2.5 px-4 truncate">
                  <span className="inline-block px-1.5 py-0.5 rounded-[4px] bg-[var(--color-surface-3)] text-[10px] font-bold text-[var(--color-text-muted)] border border-[var(--color-border)] truncate max-w-full">
                    {story.state || 'Unknown'}
                  </span>
                </td>
                <td className="py-2.5 text-[11px] text-[var(--color-text-dim)] text-right tabular-nums whitespace-nowrap" suppressHydrationWarning>
                  {story.deadline ? new Date(story.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view: Stacked cards */}
      <div className="md:hidden space-y-3">
        {stories.map((story) => (
          <div key={story.id} className="p-3 bg-[var(--color-surface-2)] rounded-[8px] border border-[var(--color-border)]/50">
            <a
              href={story.app_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[14px] font-bold text-[var(--color-text-primary)] hover:text-[var(--color-tg-orange)] transition-colors mb-2"
            >
              {story.name}
            </a>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--color-surface-3)] text-[10px] font-bold text-[var(--color-text-muted)] border border-[var(--color-border)]">
                {story.state || 'Unknown'}
              </span>
               {story.deadline && (
                  <span className="text-[11px] text-[var(--color-text-dim)] font-medium" suppressHydrationWarning>
                    Due {new Date(story.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
               )}
            </div>
            <div className="text-[12px] text-[var(--color-text-muted)] font-medium border-t border-[var(--color-border)] pt-2 mt-2">
              <span className="text-[var(--color-text-dim)] uppercase text-[10px] tracking-wider block mb-0.5">Assignees</span>
              {story.owners.length > 0 ? story.owners.join(', ') : <span className="italic opacity-50">Unassigned</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
