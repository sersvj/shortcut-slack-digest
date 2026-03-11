import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { AppConfig, TeamConfig } from './types';

// Vercel's Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN
// Support both that and manual UPSTASH_* names
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const hasKV = REST_URL && REST_TOKEN;

const redis = hasKV
  ? new Redis({ url: REST_URL!, token: REST_TOKEN! })
  : null;

const KV_KEY = 'tg:digest:config';
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

function ensureDataDir() {
  const dir = path.dirname(LOCAL_CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function readConfig(): Promise<AppConfig> {
  if (redis) {
    try {
      const data = await redis.get<AppConfig>(KV_KEY);
      return data ?? { mappings: {} };
    } catch (err) {
      console.error('[config] KV read failed:', err);
      return { mappings: {} };
    }
  }
  // Local filesystem fallback
  try {
    ensureDataDir();
    if (!fs.existsSync(LOCAL_CONFIG_PATH)) return { mappings: {} };
    return JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf-8')) as AppConfig;
  } catch {
    return { mappings: {} };
  }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  if (redis) {
    try {
      await redis.set(KV_KEY, config);
    } catch (err) {
      console.error('[config] KV write failed:', err);
    }
    return;
  }
  // Local filesystem fallback
  try {
    ensureDataDir();
    fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[config] Filesystem write failed:', err);
  }
}

export async function updateTeamConfig(teamId: string, update: Partial<TeamConfig>): Promise<void> {
  const config = await readConfig();
  const existing = config.mappings[teamId] || {
    slackChannelId: '',
    slackChannelName: '',
    active: false,
    lastSentAt: null,
  };
  config.mappings[teamId] = { ...existing, ...update };
  await writeConfig(config);
}
