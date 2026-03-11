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
  story_type: string;
}

export interface CategorizedStory {
  id: number;
  name: string;
  app_url: string;
  deadline: string | null;
  owners: string[];
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

export interface AppConfig {
  mappings: Record<string, TeamConfig>;
}

export interface ClientCardData {
  group: ShortcutGroup;
  config: TeamConfig | null;
  stories: CategorizedStories | null;
}
