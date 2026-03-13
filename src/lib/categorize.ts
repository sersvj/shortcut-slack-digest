import { CategorizedStories, CategorizedStory, DueBucket, ShortcutStory } from './types';

export function categorizeStories(
  stories: ShortcutStory[],
  memberMap: Record<string, string>,
  stateMap: Record<number, string> = {},
  priorityFieldId?: string
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
    if (story.completed || story.archived) continue;

    const owners = story.owner_ids
      .map((id) => memberMap[id])
      .filter(Boolean);

    // Extract priority from custom_fields if we know the field ID
    let priority: string | undefined;
    if (priorityFieldId && story.custom_fields) {
      const field = story.custom_fields.find((f) => f.field_id === priorityFieldId);
      if (field?.value) priority = field.value;
    }

    let bucket: DueBucket;

    if (!story.deadline) {
      bucket = 'no_due_date';
    } else {
      const deadline = new Date(story.deadline);
      deadline.setHours(0, 0, 0, 0);

      if (deadline < todayStart) {
        bucket = 'overdue';
      } else if (deadline <= todayEnd) {
        bucket = 'today';
      } else if (deadline <= weekEnd) {
        bucket = 'this_week';
      } else {
        bucket = 'later';
      }
    }

    const categorized: CategorizedStory = {
      id: story.id,
      name: story.name,
      app_url: story.app_url,
      deadline: story.deadline,
      owners,
      state: stateMap[story.workflow_state_id],
      bucket,
      priority,
    };

    result[bucket].push(categorized);
    result.total++;
  }

  return result;
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
