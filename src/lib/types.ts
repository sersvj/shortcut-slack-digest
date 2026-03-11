// Types shared across the app

export interface ShortcutGroup {
  id: string;
  name: string;
  mention_name: string;
  num_stories: number;
  color: string;
  description: string;
}

export interface ShortcutMember {
  id: string;
  name: string;
  mention_name: string;
}

export interface ShortcutStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  owner_ids: string[];
  workflow_state_id: number;
  completed: boolean;
  archived: boolean;
  story_type: string;
}

export interface CategorizedStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  owners: string[];
  state?: string;
}

export interface CategorizedStories {
  overdue: CategorizedStory[];
  today: CategorizedStory[];
  this_week: CategorizedStory[];
  later: CategorizedStory[];
  no_due_date: CategorizedStory[];
  total: number;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export interface TeamConfig {
  slackChannelId: string;
  slackChannelName: string;
  active: boolean;
  lastSentAt: string | null;
}

export interface CronConfig {
  enabled: boolean;      // always false until manually activated in vercel.json
  hour: number;          // 0–23
  minute: number;        // 0 or 30
  days: number[];        // 0=Sun, 1=Mon ... 6=Sat
  timezone: string;      // e.g. "America/New_York"
}

export interface AppConfig {
  mappings: Record<string, TeamConfig>;
  cron?: CronConfig;
}

export interface ClientCardData {
  group: ShortcutGroup;
  config: TeamConfig | null;
  stories: CategorizedStories | null;
}
