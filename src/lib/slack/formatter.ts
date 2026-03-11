import { CategorizedStories, CategorizedStory } from '../types';

function storyLines(stories: CategorizedStory[]): string {
  return stories
    .map((s) => {
      const owners =
        s.owners.length > 0 ? `_${s.owners.join(', ')}_` : '_Unassigned_';
      const state = s.state ? `  ·  *${s.state}*` : '';
      const date = s.deadline
        ? `  ·  ${new Date(s.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : '';
      return `• <${s.app_url}|${s.name}>   ${owners}${state}${date}`;
    })
    .join('\n');
}

function sectionBlock(label: string, stories: CategorizedStory[]): object[] {
  if (stories.length === 0) return [];

  const count = stories.length;
  const noun = count === 1 ? 'story' : 'stories';

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${label}*   ·   ${count} ${noun}\n${storyLines(stories)}`,
      },
    },
    { type: 'divider' },
  ];
}

export function buildSlackBlocks(
  teamName: string,
  stories: CategorizedStories,
  date: Date = new Date()
): object[] {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Build the summary line for the footer
  const parts: string[] = [];
  if (stories.overdue.length) parts.push(`${stories.overdue.length} overdue`);
  if (stories.today.length) parts.push(`${stories.today.length} today`);
  if (stories.this_week.length) parts.push(`${stories.this_week.length} this week`);
  if (stories.later.length) parts.push(`${stories.later.length} later`);
  if (stories.no_due_date.length) parts.push(`${stories.no_due_date.length} no date`);

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${teamName} Task Digest`,
        emoji: false,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: dateStr,
        },
      ],
    },
    { type: 'divider' },
  ];

  if (stories.total === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No open stories at this time.',
      },
    });
  } else {
    blocks.push(...sectionBlock('OVERDUE :this-is-fine-fire:', stories.overdue));
    blocks.push(...sectionBlock('DUE TODAY :skribblio_sweat:', stories.today));
    blocks.push(...sectionBlock('DUE THIS WEEK', stories.this_week));
    blocks.push(...sectionBlock('DUE LATER', stories.later));
    blocks.push(...sectionBlock('NO DUE DATE', stories.no_due_date));
  }

  // Footer summary
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*${stories.total} open ${stories.total === 1 ? 'story' : 'stories'}*${parts.length ? '   ·   ' + parts.join('   ·   ') : ''}`,
      },
    ],
  });

  return blocks;
}
