// Types shared across the app

export interface ShortcutGroup {
  id: string;
  name: string;
  mention_name: string;
  num_stories: number;
  color: string;
  description: string;
  archived: boolean;
}

export interface ShortcutMember {
  id: string;
  disabled: boolean;
  archived: boolean;
  profile: {
    name: string;
    mention_name: string;
  };
}

export interface ShortcutWorkflowState {
  id: number;
  name: string;
  type: string;
}

export interface ShortcutWorkflow {
  id: number;
  name: string;
  states: ShortcutWorkflowState[];
}

export interface ShortcutStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  owner_ids: string[];
  requested_by_id: string;
  workflow_state_id: number;
  group_id: string | null;
  completed: boolean;
  completed_at: string | null;
  archived: boolean;
  story_type: string;
  custom_fields?: Array<{ field_id: string; value: string }>;
}

export type DueBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_due_date';

export interface CategorizedStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  owners: string[];
  state?: string;
  bucket?: DueBucket;
  priority?: string;
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

export interface MemberConfig {
  slackUserId: string;    // Slack user ID — used directly as chat.postMessage channel
  slackUserName: string;  // Display name for the UI
  optedIn: boolean;       // Opted in to automatic Monday digest
  lastSentAt: string | null;
}

export interface MemberDigest {
  id: string;
  name: string;
  owned: CategorizedStories;
  requested: CategorizedStories;
}

export interface TeamlessRequester {
  id: string;
  name: string;
  stories: CategorizedStory[];
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
  memberMappings?: Record<string, MemberConfig>;
  cron?: CronConfig;
}

export interface ClientCardData {
  group: ShortcutGroup;
  config: TeamConfig | null;
  stories: CategorizedStories | null;
}

export interface SlackUser {
  id: string;
  name: string;
}

// ---- Cashboard types ----

export interface CashboardProject {
  id: number;
  name: string;
  client_name: string | null;
}

export interface CashboardLineItem {
  id: number;
  name: string;
  project_id: number;
}

// ---- My Stories (Time Tracker) ----

export interface MyStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  group_id: string | null;
  state?: string;
  completed: boolean;
  completed_at: string | null;
}
