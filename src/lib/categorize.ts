import { CategorizedStories, CategorizedStory, ShortcutStory } from './types';

const today = new Date();
today.setHours(0, 0, 0, 0);

const endOfToday = new Date();
endOfToday.setHours(23, 59, 59, 999);

const endOfWeek = new Date();
endOfWeek.setDate(endOfWeek.getDate() + 7);
endOfWeek.setHours(23, 59, 59, 999);

export function categorizeStories(
  stories: ShortcutStory[],
  memberMap: Record<string, string>
): CategorizedStories {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const result: CategorizedStories = {
    overdue: [],
    today: [],
    this_week: [],
    later: [],
    no_due_date: [],
    total: 0,
  };

  for (const story of stories) {
    if (story.completed) continue;

    const owners = story.owner_ids
      .map((id) => memberMap[id])
      .filter(Boolean);

    const categorized: CategorizedStory = {
      id: story.id,
      name: story.name,
      app_url: story.app_url,
      deadline: story.deadline,
      owners,
    };

    if (!story.deadline) {
      result.no_due_date.push(categorized);
    } else {
      const deadline = new Date(story.deadline);
      deadline.setHours(0, 0, 0, 0);

      if (deadline < todayStart) {
        result.overdue.push(categorized);
      } else if (deadline <= todayEnd) {
        result.today.push(categorized);
      } else if (deadline <= weekEnd) {
        result.this_week.push(categorized);
      } else {
        result.later.push(categorized);
      }
    }

    result.total++;
  }

  return result;
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
