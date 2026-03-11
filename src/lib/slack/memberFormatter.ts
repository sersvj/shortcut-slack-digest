import { CategorizedStories, CategorizedStory, MemberDigest } from '../types';

function storyLines(stories: CategorizedStory[]): string {
  return stories
    .map((s) => {
      const owners = s.owners.length > 0 ? `_${s.owners.join(', ')}_` : '_Unassigned_';
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

function buildTabBlocks(label: string, stories: CategorizedStories): object[] {
  if (stories.total === 0) return [];
  const blocks: object[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${label}*` },
    },
  ];
  blocks.push(...sectionBlock('OVERDUE :this-is-fine-fire:', stories.overdue));
  blocks.push(...sectionBlock('DUE TODAY :skribblio_sweat:', stories.today));
  blocks.push(...sectionBlock('DUE THIS WEEK', stories.this_week));
  blocks.push(...sectionBlock('DUE LATER', stories.later));
  blocks.push(...sectionBlock('NO DUE DATE', stories.no_due_date));
  return blocks;
}

export function buildMemberSlackBlocks(digest: MemberDigest, date: Date = new Date()): object[] {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const totalOwned = digest.owned.total;
  const totalRequested = digest.requested.total;
  const total = totalOwned + totalRequested;

  const parts: string[] = [];
  const combined = {
    overdue: [...digest.owned.overdue, ...digest.requested.overdue],
    today: [...digest.owned.today, ...digest.requested.today],
    this_week: [...digest.owned.this_week, ...digest.requested.this_week],
    later: [...digest.owned.later, ...digest.requested.later],
    no_due_date: [...digest.owned.no_due_date, ...digest.requested.no_due_date],
  };
  if (combined.overdue.length) parts.push(`${combined.overdue.length} overdue`);
  if (combined.today.length) parts.push(`${combined.today.length} today`);
  if (combined.this_week.length) parts.push(`${combined.this_week.length} this week`);
  if (combined.later.length) parts.push(`${combined.later.length} later`);
  if (combined.no_due_date.length) parts.push(`${combined.no_due_date.length} no date`);

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${digest.name} — Personal Task Digest`,
        emoji: false,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: dateStr }],
    },
    { type: 'divider' },
  ];

  if (total === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: 'No open stories at this time.' },
    });
  } else {
    blocks.push(...buildTabBlocks('Owned Tasks', digest.owned));
    blocks.push(...buildTabBlocks('Requested Tasks', digest.requested));
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*${total} open ${total === 1 ? 'story' : 'stories'} total*${parts.length ? '   ·   ' + parts.join('   ·   ') : ''}   ·   ${totalOwned} owned · ${totalRequested} requested`,
      },
    ],
  });

  return blocks;
}
