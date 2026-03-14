import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';
import { CashboardProject, CashboardLineItem } from './types';

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = REST_URL && REST_TOKEN
  ? new Redis({ url: REST_URL, token: REST_TOKEN })
  : null;

const TTL_SECONDS = 60 * 60; // 1 hour

// ---- Projects ----

const PROJECTS_KEY = 'tg:cashboard:projects';
const PROJECTS_PATH = path.join(process.cwd(), 'data', 'cashboard-projects.json');

interface LocalCacheFile<T> { data: T; cachedAt: string; }

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function getCachedProjects(): Promise<CashboardProject[] | null> {
  if (redis) {
    try { return await redis.get<CashboardProject[]>(PROJECTS_KEY); } catch {}
  }
  try {
    if (!fs.existsSync(PROJECTS_PATH)) return null;
    const { data, cachedAt }: LocalCacheFile<CashboardProject[]> = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf-8'));
    if (Date.now() - new Date(cachedAt).getTime() > TTL_SECONDS * 1000) return null;
    return data;
  } catch { return null; }
}

export async function setCachedProjects(data: CashboardProject[]): Promise<void> {
  if (redis) {
    try { await redis.set(PROJECTS_KEY, data, { ex: TTL_SECONDS }); return; } catch {}
  }
  try {
    ensureDataDir();
    fs.writeFileSync(PROJECTS_PATH, JSON.stringify({ data, cachedAt: new Date().toISOString() }), 'utf-8');
  } catch {}
}

// ---- Line Items ----

const LINE_ITEMS_KEY = 'tg:cashboard:line-items';
const LINE_ITEMS_PATH = path.join(process.cwd(), 'data', 'cashboard-line-items.json');

export async function getCachedLineItems(): Promise<CashboardLineItem[] | null> {
  if (redis) {
    try { return await redis.get<CashboardLineItem[]>(LINE_ITEMS_KEY); } catch {}
  }
  try {
    if (!fs.existsSync(LINE_ITEMS_PATH)) return null;
    const { data, cachedAt }: LocalCacheFile<CashboardLineItem[]> = JSON.parse(fs.readFileSync(LINE_ITEMS_PATH, 'utf-8'));
    if (Date.now() - new Date(cachedAt).getTime() > TTL_SECONDS * 1000) return null;
    return data;
  } catch { return null; }
}

export async function setCachedLineItems(data: CashboardLineItem[]): Promise<void> {
  if (redis) {
    try { await redis.set(LINE_ITEMS_KEY, data, { ex: TTL_SECONDS }); return; } catch {}
  }
  try {
    ensureDataDir();
    fs.writeFileSync(LINE_ITEMS_PATH, JSON.stringify({ data, cachedAt: new Date().toISOString() }), 'utf-8');
  } catch {}
}
