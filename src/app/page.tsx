'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  Send,
  Loader2,
  AlertTriangle,
  Inbox,
  Search,
  LogOut,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
} from 'lucide-react';
import { ShortcutGroup, CategorizedStories, SlackChannel, AppConfig, CronConfig, TeamlessRequester } from '@/lib/types';
import { ClientCard } from '@/components/ClientCard';
import { CronSettingsModal } from '@/components/CronSettingsModal';
import { MembersView, MembersViewHandle } from '@/components/MembersView';
import { SummaryReportView } from '@/components/SummaryReportView';
import { TimeTrackerView } from '@/components/TimeTrackerView';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

let toastId = 0;

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const { data: session } = useSession();
  const [groups, setGroups] = useState<ShortcutGroup[]>([]);
  const [config, setConfig] = useState<AppConfig>({ mappings: {} });
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [storiesMap, setStoriesMap] = useState<Record<string, CategorizedStories>>({});
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingStoriesFor, setLoadingStoriesFor] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [showCronModal, setShowCronModal] = useState(false);

  // ---- Responsive state ----
  const [isMobile, setIsMobile] = useState(false);
  const [activeExpanded, setActiveExpanded] = useState(true);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // ---- URL-based view routing ----
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<'teams' | 'members' | 'summary' | 'timetracker'>('teams');
  const [isTimeTrackerAllowed, setIsTimeTrackerAllowed] = useState(false);
  const [ttRefreshTrigger, setTtRefreshTrigger] = useState(0);
  const [ttCashboardLoading, setTtCashboardLoading] = useState(false);
  const [ttLastRefreshed, setTtLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'members') setActiveView('members');
    else if (v === 'summary') setActiveView('summary');
    else if (v === 'timetracker') setActiveView('timetracker');
    else setActiveView('teams');
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/cashboard/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.allowed !== true) return;
        setIsTimeTrackerAllowed(true);

        // Prefetch Cashboard data into localStorage cache so the Time Tracker
        // tab loads instantly when the user clicks it.
        const CACHE_KEY = 'tt-cashboard-cache-v2';
        const TTL = 60 * 60 * 1000;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Date.now() - new Date(parsed.cachedAt).getTime() < TTL) return;
          }
        } catch {}

        Promise.all([
          fetch('/api/cashboard/projects').then((r) => r.json()),
          fetch('/api/cashboard/line-items').then((r) => r.json()),
        ]).then(([projects, lineItems]) => {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            projects,
            lineItems,
            personId: d.personId ?? null,
            cachedAt: new Date().toISOString(),
          }));
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  const switchView = useCallback((view: 'teams' | 'members' | 'summary' | 'timetracker') => {
    setActiveView(view);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('view', view);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // ---- Members view state (lifted for header bar) ----
  const membersViewRef = useRef<MembersViewHandle>(null);
  const [summarySearch, setSummarySearch] = useState('');
  const [membersSearch, setMembersSearch] = useState('');
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [membersStats, setMembersStats] = useState({ loading: true, optedInCount: 0, total: 0 });
  const [sendingAllMembers, setSendingAllMembers] = useState(false);

  // ---- Teamless stories state ----
  const [teamlessRequesters, setTeamlessRequesters] = useState<TeamlessRequester[] | null>(null);
  const [teamlessLoading, setTeamlessLoading] = useState(false);
  const [teamlessLoaded, setTeamlessLoaded] = useState(false);
  const [teamlessLastRefreshedAt, setTeamlessLastRefreshedAt] = useState<Date | null>(null);

  const handleSendAllMembers = useCallback(async () => {
    setSendingAllMembers(true);
    try {
      await membersViewRef.current?.sendAll();
    } finally {
      setSendingAllMembers(false);
    }
  }, []);

  // ---- Fetch teamless stories (lazy, on first summary view visit) ----
  const loadTeamlessStories = useCallback(async (forceRefresh = false) => {
    if (teamlessLoaded && !forceRefresh) return;
    setTeamlessLoading(true);
    try {
      const res = await fetch('/api/shortcut/teamless-stories');
      if (res.ok) {
        setTeamlessRequesters(await res.json());
        setTeamlessLastRefreshedAt(new Date());
      }
    } catch {
      // silent fail
    } finally {
      setTeamlessLoading(false);
      setTeamlessLoaded(true);
    }
  }, [teamlessLoaded]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);


  const CACHE_KEY = 'tg-digest-cache-v2';

  const readCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        groups: ShortcutGroup[];
        storiesMap: Record<string, CategorizedStories>;
        cachedAt: string;
      };
    } catch {
      return null;
    }
  }, []);

  const writeCache = useCallback((groups: ShortcutGroup[], storiesMap: Record<string, CategorizedStories>) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ groups, storiesMap, cachedAt: new Date().toISOString() }));
    } catch {}
  }, []);

  const loadAllData = useCallback(async (forceRefresh = false) => {
    setError(null);

    // On first load, try to serve from cache immediately
    if (!forceRefresh) {
      const cache = readCache();
      if (cache) {
        setGroups(cache.groups);
        setStoriesMap(cache.storiesMap);
        setCachedAt(new Date(cache.cachedAt));
        // Still fetch config + channels fresh (fast calls)
        const [configRes, channelsRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/slack/channels'),
        ]);
        if (configRes.ok) setConfig(await configRes.json());
        if (channelsRes.ok) setSlackChannels(await channelsRes.json());
        setLoadingGroups(false);
        return;
      }
    }

    // Full refresh from Shortcut API
    setLoadingGroups(true);
    setStoriesMap({});

    try {
      const [groupsRes, configRes, channelsRes] = await Promise.all([
        fetch('/api/shortcut/groups'),
        fetch('/api/config'),
        fetch('/api/slack/channels'),
      ]);

      if (!groupsRes.ok) throw new Error('Failed to load Shortcut teams. Check your API token.');

      const groupsData: ShortcutGroup[] = await groupsRes.json();
      const configData: AppConfig = configRes.ok ? await configRes.json() : { mappings: {} };
      const channelsData: SlackChannel[] = channelsRes.ok ? await channelsRes.json() : [];

      setGroups(groupsData);
      setConfig(configData);
      setSlackChannels(channelsData);

      // Fetch stories for all groups in parallel — single pass, used for both state + cache
      const freshStoriesEntries = await Promise.all(
        groupsData.map(async (g) => {
          setLoadingStoriesFor((prev) => new Set([...prev, g.id]));
          try {
            const res = await fetch(`/api/shortcut/groups/${g.id}/stories`);
            if (!res.ok) return [g.id, null] as const;
            return [g.id, await res.json() as CategorizedStories] as const;
          } catch {
            return [g.id, null] as const;
          } finally {
            setLoadingStoriesFor((prev) => {
              const next = new Set(prev);
              next.delete(g.id);
              return next;
            });
          }
        })
      );
      const freshStoriesMap: Record<string, CategorizedStories> = {};
      for (const [id, data] of freshStoriesEntries) {
        if (data) freshStoriesMap[id] = data;
      }
      setStoriesMap(freshStoriesMap);
      writeCache(groupsData, freshStoriesMap);
      setCachedAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoadingGroups(false);
    }
  }, [readCache, writeCache]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const saveConfig = useCallback(async (newConfig: AppConfig) => {
    setConfig(newConfig);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
  }, []);

  const handleChannelChange = useCallback(
    (groupId: string, channelId: string, channelName: string) => {
      const existing = config.mappings[groupId] || {
        slackChannelId: '',
        slackChannelName: '',
        active: false,
        lastSentAt: null,
      };
      saveConfig({
        ...config,
        mappings: { ...config.mappings, [groupId]: { ...existing, slackChannelId: channelId, slackChannelName: channelName } },
      });
    },
    [config, saveConfig]
  );

  const handleToggleActive = useCallback(
    (groupId: string, active: boolean) => {
      const existing = config.mappings[groupId] || {
        slackChannelId: '',
        slackChannelName: '',
        active: false,
        lastSentAt: null,
      };
      saveConfig({
        ...config,
        mappings: { ...config.mappings, [groupId]: { ...existing, active } },
      });
    },
    [config, saveConfig]
  );

  const sendDigests = useCallback(
    async (teamIds: string[]) => {
      const teamNames: Record<string, string> = {};
      for (const g of groups) teamNames[g.id] = g.name;

      const res = await fetch('/api/slack/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds, teamNames }),
      });

      const data = await res.json();
      const newMappings = { ...config.mappings };
      for (const result of data.results || []) {
        if (result.success && newMappings[result.teamId]) {
          newMappings[result.teamId] = { ...newMappings[result.teamId], lastSentAt: new Date().toISOString() };
        }
      }
      setConfig({ ...config, mappings: newMappings });

      const successCount = data.results?.filter((r: { success: boolean }) => r.success).length ?? 0;
    const failCount = data.results?.filter((r: { success: boolean }) => !r.success).length ?? 0;
      if (successCount > 0) addToast('success', `${successCount} digest${successCount > 1 ? 's' : ''} sent to Slack`);
      if (failCount > 0) addToast('error', `${failCount} digest${failCount > 1 ? 's' : ''} failed to send`);
    },
    [config, groups, addToast]
  );

  const handleSendAll = useCallback(async () => {
    const activeIds = groups
      .filter((g) => config.mappings[g.id]?.active && config.mappings[g.id]?.slackChannelId)
      .map((g) => g.id);
    if (activeIds.length === 0) {
      addToast('error', 'No active teams with mapped channels');
      return;
    }
    setSendingAll(true);
    try {
      await sendDigests(activeIds);
    } finally {
      setSendingAll(false);
    }
  }, [groups, config, sendDigests, addToast]);

  const handleSendSingle = useCallback(
    async (groupId: string) => {
      await sendDigests([groupId]);
    },
    [sendDigests]
  );

  const handleSaveCron = useCallback(
    async (cron: CronConfig) => {
      const newConfig = { ...config, cron };
      setConfig(newConfig);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      addToast('success', 'Schedule settings saved');
    },
    [config, addToast]
  );

  const q = search.trim().toLowerCase();
  const filtered = (arr: ShortcutGroup[]) =>
    q ? arr.filter((g) => g.name.toLowerCase().includes(q)) : arr;

  const activeGroups = filtered(groups.filter((g) => config.mappings[g.id]?.active));
  const inactiveGroups = filtered(groups.filter((g) => !config.mappings[g.id]?.active));
  const activeWithChannel = groups
    .filter((g) => config.mappings[g.id]?.active && config.mappings[g.id]?.slackChannelId);

  const totalOpen = Object.values(storiesMap).reduce((s, st) => s + st.total, 0);
  const totalOverdue = Object.values(storiesMap).reduce((s, st) => s + st.overdue.length, 0);

  return (
    <div className={`flex flex-col ${isMobile ? 'min-h-screen' : 'h-screen overflow-hidden'} bg-[var(--color-surface-base)] relative`}>
      {/* Header */}
      <header className="lg:sticky top-0 z-50 bg-[var(--color-surface-1)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        {/* Top Bar: Logo & User */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 py-3 md:h-14 border-b border-[var(--color-border)]/50 gap-4 md:gap-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-3">
              <svg width="28" height="17" viewBox="0 0 23 14" version="1.1" xmlns="http://www.w3.org/2000/svg" className="w-7 h-[17px]">
                <title>logo-tg-header</title>
                <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                  <g id="logo-tg-header" transform="translate(0, 0.1141)" fill="#F37057" fillRule="nonzero">
                    <path d="M22.96,8.5845926 C23,8.48192593 23,8.40725926 23,8.29525926 C23,8.15525926 22.96,8.00592593 22.96,7.9685926 C22.69,7.5765926 22.03,7.14725926 22,6.89525926 C21.96,6.10192593 22.12,5.27125926 22.12,4.4125926 C22.12,3.9085926 22.04,3.4045926 21.77,2.86325926 C21.65,2.61125926 21.23,2.10725926 21,2.06992593 C20.46,1.92992593 19.38,1.85525926 19.26,1.85525926 C17.99,1.85525926 16.79,1.96725926 15.48,1.96725926 C15.33,1.96725926 14.36,2.1445926 14.21,2.1445926 C12.86,2.1445926 11.01,2.06992593 9.62,1.7525926 C9.26,1.63125926 8.8,1.45392593 8.49,1.45392593 C8.18,1.45392593 7.56,1.63125926 7.14,1.63125926 C6.48,1.63125926 5.79,1.5285926 5.48,1.37925926 C5.33,1.31392593 5.4,1.1645926 5.4,1.1645926 C5.55,0.987259256 5.75,0.875259259 5.75,0.660592593 C5.75,0.585925926 5.71,0.371259259 5.48,0.371259259 C5.33,0.371259259 4.79,0.585925926 4.63,0.585925926 C4.59,0.585925926 4.59,0.585925926 4.48,0.585925926 C4.32,0.371259259 4.13,0.0165925928 3.55,0.0165925928 C3.47,0.0165925928 3.13,0.0912592588 2.82,0.193925926 C2.59,0.193925926 2.36,0.193925926 2.32,0.193925926 C2.17,0.193925926 1.93,0.193925926 1.86,0.156592593 C1.75,0.156592593 1.59,0.0165925928 1.47,0.0165925928 C1.47,0.0165925928 1.32,-0.0207407409 1.28,0.0165925928 C1.16,0.0912592588 1.28,0.268592593 1.28,0.268592593 C1.24,0.408592593 1.63,0.697925926 1.82,0.735259259 C2.05,0.809925926 2.36,0.772592593 2.59,0.847259259 C2.55,1.0245926 2.2,1.20192593 2.12,1.31392593 C1.97,1.5285926 1.74,1.85525926 1.47,2.10725926 C0.81,2.71392593 0,3.1805926 0,3.36725926 C0,3.4325926 0.12,3.61925926 0.15,3.7965926 C0.23,3.97392593 0.27,4.1605926 0.38,4.26325926 C0.53,4.37525926 0.84,4.37525926 1.15,4.40325926 C1.54,4.4405926 1.92,4.51525926 2,4.51525926 C2.15,4.51525926 2.46,4.4405926 2.62,4.4405926 C3.31,4.4405926 3.82,4.6925926 4.16,5.0565926 C4.47,5.38325926 4.7,5.8125926 5.01,6.24192593 C5.16,6.49392593 5.36,6.7085926 5.55,6.9605926 C5.74,7.24992593 6.01,7.6045926 6.05,7.89392593 C6.09,8.1085926 6.05,8.32325926 6.17,8.50992593 C6.32,8.7245926 6.36,8.87392593 6.63,8.93925926 C6.82,8.9765926 7.02,8.90192593 7.17,8.93925926 C7.25,8.9765926 7.32,8.9765926 7.32,9.04192593 C7.4,9.18192593 7.32,9.3685926 7.32,9.54592593 C7.36,9.79792593 7.47,10.1899259 7.55,10.5539259 C7.63,10.8805926 7.59,11.2352592 7.59,11.3099259 C7.59,11.7392592 7.59,12.1779259 7.28,12.5699259 C7.2,12.6819259 6.89,12.8219259 6.62,12.9992592 C6.39,13.1392592 6.23,13.2885926 6.23,13.4285926 C6.23,13.6059259 6.85,13.5685926 7.08,13.5685926 C7.39,13.5685926 7.66,13.5685926 7.74,13.4285926 C7.82,13.3539259 7.78,13.2885926 7.9,13.1392592 C7.98,13.0645926 8.09,12.9619259 8.25,12.8872592 C8.21,12.5232592 8.21,12.0939259 8.25,11.7672592 C8.25,11.6272592 8.56,10.3672592 8.98,10.3672592 C9.13,10.3672592 9.1,10.4045926 9.1,10.4045926 C9.14,10.6939259 9.25,11.1979259 9.25,11.3379259 C9.25,11.8045926 9.1,12.3085926 8.83,12.6352592 C8.68,12.8499259 8.1,13.0645926 8.1,13.1765926 C8.1,13.3165926 8.18,13.2885926 8.18,13.3539259 C8.29,13.3912592 8.41,13.4285926 8.57,13.4285926 C8.72,13.4285926 9.46,13.3539259 9.84,13.2885926 C9.92,13.1485926 9.95,12.8965926 10.07,12.7472592 C10.15,12.6072592 10.34,12.5699259 10.42,12.4205926 C10.54,12.2432592 10.3,11.8792592 10.27,11.7392592 C10.23,10.9832592 10.35,10.2272592 10.46,9.47125926 C10.5,9.21925926 10.81,8.81792593 11.12,8.78992593 C11.35,8.7525926 11.66,8.71525926 11.85,8.71525926 C12.27,8.71525926 13.7,9.10725926 14.36,9.10725926 C14.51,9.10725926 14.51,9.0325926 14.63,9.0325926 C14.75,9.0325926 15.09,9.1725926 15.09,9.20992593 C15.32,9.4245926 15.59,9.63925926 15.78,9.7885926 C15.82,9.7885926 15.86,9.7885926 15.86,9.86325926 C15.97,10.0405926 16.09,10.2645926 16.25,10.2645926 C16.4,10.2272592 16.44,10.0125926 16.6,9.97525923 C16.6,9.97525923 16.91,9.93792593 16.95,9.97525923 C17.07,10.0499259 17.18,10.3019259 17.34,10.3019259 C17.49,10.3019259 17.57,10.1619259 17.57,10.0499259 C17.57,10.0125926 17.65,9.97525923 17.68,9.93792593 C17.72,9.90059263 17.76,9.86325926 17.83,9.86325926 C17.98,9.86325926 18.1,9.93792593 18.1,10.0032592 C18.25,10.3952592 17.91,11.0112592 17.64,11.4032592 C17.52,11.5805926 17.49,11.9445926 17.37,12.0845926 C17.18,12.3739259 16.91,12.6259259 16.64,12.8032592 C16.56,12.8405926 16.45,12.9152592 16.37,12.9805926 C16.29,13.0552592 16.25,13.1579259 16.25,13.2325926 C16.25,13.2325926 16.29,13.2699259 16.56,13.2699259 L17.52,13.3072592 C17.71,13.3072592 17.98,13.1299259 18.02,13.0552592 C18.06,12.9525926 18.02,12.8405926 18.06,12.7285926 C18.21,12.6539259 18.45,12.4765926 18.52,12.2992592 C18.75,11.6832592 18.83,10.5725926 19.56,9.60192593 C19.56,9.60192593 19.6,9.5645926 19.64,9.5645926 C19.68,9.5645926 19.72,9.60192593 19.72,9.60192593 C20.11,10.1432592 20.38,10.7219259 20.38,11.3285926 C20.38,11.4685926 20.3,12.2245926 20.19,12.6259259 C20.15,12.7379259 20.04,12.9152592 19.92,12.9899259 C19.77,13.1019259 19.57,13.2045926 19.46,13.3165926 C19.34,13.3912592 19.23,13.4939259 19.23,13.5685926 C19.23,13.6712592 19.65,13.7459259 19.81,13.7459259 L20.89,13.7085926 C21.32,13.6712592 21.28,13.2419259 21.24,12.9152592 C21.2,12.8779259 21.2,12.7752592 21.24,12.7379259 C21.28,12.6632592 21.43,12.6259259 21.43,12.5979259 C21.43,12.0939259 21.32,11.6272592 21.32,11.1232592 C21.28,10.6565926 21.36,10.1899259 21.4,9.71392593 C21.48,9.34992593 21.71,8.84592593 21.71,8.70592593 C21.71,8.59392593 21.48,8.37925926 21.33,8.12725926 C21.21,7.94992593 21.17,7.76325926 21.17,7.62325926 C21.17,7.5205926 21.36,6.9045926 21.48,6.43792593 C21.56,5.97125926 21.67,5.5045926 21.67,5.03792593 C21.82,5.28992593 21.59,6.29792593 21.59,6.40992593 C21.63,6.54992593 21.55,6.7365926 21.47,6.95125926 C21.24,7.56725926 21.89,8.2485926 22.05,8.6405926 C22.17,8.92992593 22.13,9.29392593 22.2,9.54592593 C22.28,9.72325926 22.55,9.90992593 22.7,9.90992593 C22.85,9.90992593 22.82,9.90992593 22.85,9.83525926 C22.73,9.6205926 22.7,9.33125926 22.73,9.04192593 C22.77,8.87392593 22.88,8.73392593 22.96,8.5845926 Z" />
                  </g>
                </g>
              </svg>
              <div>
                <span className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)] whitespace-nowrap">
                  T/G Task Digest
                </span>
                <span className="ml-2 text-[12px] text-[var(--color-text-dim)] hidden xs:inline whitespace-nowrap">Shortcut × Slack</span>
              </div>
            </div>
            {/* Nav tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
              <button
                onClick={() => switchView('teams')}
                suppressHydrationWarning
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                  activeView === 'teams'
                    ? 'bg-[var(--color-tg-orange)]/15 text-[var(--color-tg-orange)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                Team Tasks
              </button>
              <button
                onClick={() => switchView('members')}
                suppressHydrationWarning
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                  activeView === 'members'
                    ? 'bg-[var(--color-tg-orange)]/15 text-[var(--color-tg-orange)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                Team Members
              </button>
              <button
                onClick={() => switchView('summary')}
                suppressHydrationWarning
                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                  activeView === 'summary'
                    ? 'bg-[var(--color-tg-orange)]/15 text-[var(--color-tg-orange)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                Summary Report
              </button>
              {isTimeTrackerAllowed && (
                <button
                  onClick={() => switchView('timetracker')}
                  suppressHydrationWarning
                  className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors whitespace-nowrap ${
                    activeView === 'timetracker'
                      ? 'bg-[var(--color-tg-orange)]/15 text-[var(--color-tg-orange)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  Time Tracker
                </button>
              )}
            </div>
          </div>

          {session?.user && (
            <div className="flex items-center justify-between sm:justify-end gap-3 border-t md:border-t-0 md:pt-0 pt-3 md:mt-0 mt-1 border-[var(--color-border)]/30">
              <div className="flex items-center gap-2 pr-3 md:border-r border-[var(--color-border)]">
                <span className="text-[12px] text-[var(--color-text-muted)] font-medium hidden sm:inline">
                  {session.user.name}
                </span>
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full border border-[var(--color-border)] shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-[12px] font-bold text-[var(--color-text-muted)] border border-[var(--color-border)]">
                    {(session.user.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] hover:bg-[var(--color-danger-dim)] text-[var(--color-text-dim)] hover:text-[var(--color-danger)] text-[12px] font-medium transition-all group"
                title="Sign out"
              >
                <LogOut size={14} className="group-hover:translate-x-0.5 transition-transform" />
                <span className="hidden xs:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Contextual Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-4 sm:px-6 py-3 lg:h-14 bg-[var(--color-surface-2)]/80 border-b border-[var(--color-border)]/50 gap-4 lg:gap-6">

          {activeView === 'timetracker' ? (
            <div className="flex items-center gap-3 order-2 lg:order-1 lg:min-w-[200px]">
              <button
                onClick={() => setTtRefreshTrigger((n) => n + 1)}
                disabled={ttCashboardLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw size={14} className={ttCashboardLoading ? 'animate-spin-fast' : ''} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
              {ttLastRefreshed && !ttCashboardLoading && (
                <span className="text-[11px] text-[var(--color-text-dim)] font-medium tabular-nums whitespace-nowrap" suppressHydrationWarning>
                  Updated {ttLastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ) : activeView === 'summary' ? (
            <>
              {/* Summary: Refresh + timestamp */}
              <div className="flex items-center gap-3 order-2 lg:order-1 lg:min-w-[200px]">
                <button
                  onClick={() => loadTeamlessStories(true)}
                  suppressHydrationWarning
                  disabled={teamlessLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw size={14} className={teamlessLoading ? 'animate-spin-fast' : ''} />
                  <span className="hidden xs:inline">Refresh</span>
                </button>
                {teamlessLastRefreshedAt && !teamlessLoading && (
                  <span className="text-[11px] text-[var(--color-text-dim)] font-medium tabular-nums whitespace-nowrap" suppressHydrationWarning>
                    Updated {teamlessLastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Summary: Search (Active Teams tab only) */}
              <div className="flex-1 flex justify-center w-full lg:max-w-2xl order-1 lg:order-2">
                <div className="relative group w-full max-w-xl">
                  <Search
                    size={14}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                      summarySearch ? 'text-[var(--color-tg-orange)]' : 'text-[var(--color-text-dim)]'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Filter active teams…"
                    value={summarySearch}
                    onChange={(e) => setSummarySearch(e.target.value)}
                    suppressHydrationWarning
                    className="w-full pl-9 pr-9 py-2 rounded-[8px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[14px] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all shadow-inner"
                  />
                  {summarySearch && (
                    <button
                      onClick={() => setSummarySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--color-surface-3)] text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Summary: right spacer (balances layout so search stays centered) */}
              <div className="flex items-center gap-2 order-3 lg:order-3 lg:min-w-[200px] lg:justify-end" />
            </>
          ) : activeView === 'teams' ? (
            <>
              {/* Team Tasks: Refresh + timestamp */}
              <div className="flex items-center gap-3 order-2 lg:order-1 lg:min-w-[200px]">
                <button
                  onClick={() => loadAllData(true)}
                  suppressHydrationWarning
                  disabled={loadingGroups}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw size={14} className={loadingGroups ? 'animate-spin-fast' : ''} />
                  <span className="hidden xs:inline">Refresh</span>
                </button>
                {cachedAt && !loadingGroups && (
                  <span className="text-[11px] text-[var(--color-text-dim)] font-medium tabular-nums whitespace-nowrap" suppressHydrationWarning>
                    Updated {cachedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Team Tasks: Search */}
              <div className="flex-1 flex justify-center w-full lg:max-w-2xl order-1 lg:order-2">
                <div className="relative group w-full max-w-xl">
                  <Search
                    size={14}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                      search ? 'text-[var(--color-tg-orange)]' : 'text-[var(--color-text-dim)]'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Search teams or clients…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    suppressHydrationWarning
                    className="w-full pl-9 pr-9 py-2 rounded-[8px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[14px] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all shadow-inner"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--color-surface-3)] text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Team Tasks: Schedule + Send Active */}
              <div className="flex items-center gap-2 order-3 lg:order-3 lg:min-w-[200px] lg:justify-end">
                <button
                  onClick={() => setShowCronModal(true)}
                  suppressHydrationWarning
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors shadow-sm relative flex-1 sm:flex-none justify-center"
                  title="Schedule settings"
                >
                  <Clock size={14} />
                  <span>Schedule</span>
                  {config.cron && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--color-tg-orange)] border-2 border-[var(--color-surface-2)] shadow-sm" />
                  )}
                </button>
                <button
                  onClick={handleSendAll}
                  disabled={sendingAll || loadingGroups || activeWithChannel.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[13px] font-bold transition-all disabled:opacity-50 shadow-md shadow-[var(--color-tg-orange)]/20 flex-1 sm:flex-none justify-center"
                >
                  {sendingAll ? <Loader2 size={14} className="animate-spin-fast" /> : <Send size={14} />}
                  <span className="whitespace-nowrap">
                    {sendingAll ? 'Sending…' : `Send Active${activeWithChannel.length > 0 ? ` (${activeWithChannel.length})` : ''}`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Team Members: Refresh */}
              <div className="flex items-center gap-3 order-2 lg:order-1 lg:min-w-[200px]">
                <button
                  onClick={() => setMembersRefreshKey((k) => k + 1)}
                  suppressHydrationWarning
                  disabled={membersStats.loading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] hover:border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[13px] font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw size={14} className={membersStats.loading ? 'animate-spin-fast' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Team Members: Search */}
              <div className="flex-1 flex justify-center w-full lg:max-w-2xl order-1 lg:order-2">
                <div className="relative group w-full max-w-xl">
                  <Search
                    size={14}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                      membersSearch ? 'text-[var(--color-tg-orange)]' : 'text-[var(--color-text-dim)]'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Search members…"
                    value={membersSearch}
                    onChange={(e) => setMembersSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 rounded-[8px] bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[14px] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-tg-orange)] focus:ring-1 focus:ring-[var(--color-tg-orange)]/20 transition-all shadow-inner"
                  />
                  {membersSearch && (
                    <button
                      onClick={() => setMembersSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--color-surface-3)] text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Team Members: Send Monday DMs */}
              <div className="flex items-center gap-2 order-3 lg:order-3 lg:min-w-[200px] lg:justify-end">
                <button
                  onClick={handleSendAllMembers}
                  disabled={sendingAllMembers || membersStats.loading || membersStats.optedInCount === 0}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[13px] font-bold transition-all disabled:opacity-50 shadow-md shadow-[var(--color-tg-orange)]/20 flex-1 sm:flex-none justify-center"
                >
                  {sendingAllMembers ? <Loader2 size={14} className="animate-spin-fast" /> : <Send size={14} />}
                  <span className="whitespace-nowrap">
                    {sendingAllMembers
                      ? 'Sending…'
                      : `Send Monday DMs${membersStats.optedInCount > 0 ? ` (${membersStats.optedInCount})` : ''}`}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      {activeView === 'timetracker' ? (
        <TimeTrackerView
          groups={groups}
          refreshTrigger={ttRefreshTrigger}
          onCashboardLoadingChange={setTtCashboardLoading}
          onCashboardRefreshed={() => setTtLastRefreshed(new Date())}
        />
      ) : activeView === 'summary' ? (
        <SummaryReportView
          groups={groups}
          config={config}
          storiesMap={storiesMap}
          search={summarySearch}
          teamlessRequesters={teamlessRequesters}
          teamlessLoading={teamlessLoading}
          onMount={loadTeamlessStories}
        />
      ) : activeView === 'members' ? (
        <MembersView
          ref={membersViewRef}
          config={config}
          onConfigChange={saveConfig}
          search={membersSearch}
          refreshKey={membersRefreshKey}
          onStatsChange={setMembersStats}
        />
      ) : (
        <main className={`flex-1 ${isMobile ? '' : 'overflow-hidden'} flex flex-col px-4 sm:px-6 pt-4 sm:pt-6 pb-2 max-w-[1500px] mx-auto w-full`}>
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-[8px] bg-[var(--color-danger-dim)] border border-[var(--color-danger)]/25 text-[var(--color-danger)] text-[13px]">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Summary bar */}
        {!loadingGroups && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-6 px-5 py-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[10px] shadow-sm">
            <Stat value={groups.length} label="Teams" />
            <Divider />
            <Stat value={activeGroups.length} label="Active" />
            <Divider />
            <Stat value={totalOpen} label="Open Stories" />
            <Divider />
            <Stat value={totalOverdue} label="Overdue" highlight={totalOverdue > 0} />
          </div>
        )}

        {/* Two-column grid / Skeletons */}
        <div className="flex-1 min-h-0">
          {loadingGroups ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {[0, 1].map((col) => {
                const isColActive = col === 0;
                const expanded = isColActive ? activeExpanded : inactiveExpanded;
                return (
                  <div key={col} className={`flex flex-col h-full overflow-hidden ${col === 1 && !isMobile ? 'hidden lg:flex' : ''}`}>
                    <ColHeader
                      active={isColActive}
                      count={0}
                      isMobile={isMobile}
                      expanded={expanded}
                      onToggle={() => isColActive ? setActiveExpanded(!activeExpanded) : setInactiveExpanded(!inactiveExpanded)}
                    />
                    {(!isMobile || expanded) && (
                      <div className="flex-1 lg:overflow-y-auto pr-2 space-y-3 mt-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-36 rounded-[10px] skeleton-shimmer" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8 h-full">
              {/* Active */}
              <div className="flex flex-col h-full overflow-hidden">
                <ColHeader
                  active={true}
                  count={activeGroups.length}
                  isMobile={isMobile}
                  expanded={activeExpanded}
                  onToggle={() => setActiveExpanded(!activeExpanded)}
                />
                {(!isMobile || activeExpanded) && (
                  <div className="flex-1 lg:overflow-y-auto pr-1 sm:pr-3 mt-4 pb-8 custom-scrollbar">
                    <div className="flex flex-col gap-4">
                      {activeGroups.length === 0 ? (
                        <EmptyState
                          icon={<Inbox size={28} className="text-[var(--color-text-dim)]" />}
                          text="No active teams. Move cards here to include them in bulk sends."
                        />
                      ) : (
                        activeGroups.map((g) => (
                          <ClientCard
                            key={g.id}
                            group={g}
                            config={config.mappings[g.id] || null}
                            stories={storiesMap[g.id] || null}
                            loadingStories={loadingStoriesFor.has(g.id)}
                            slackChannels={slackChannels}
                            isActive={true}
                            onToggleActive={handleToggleActive}
                            onChannelChange={handleChannelChange}
                            onSendSingle={handleSendSingle}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Inactive */}
              <div className="flex flex-col h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-[var(--color-border)]/30 pt-6 lg:pt-0 lg:pl-8 mt-6 lg:mt-0">
                <ColHeader
                  active={false}
                  count={inactiveGroups.length}
                  isMobile={isMobile}
                  expanded={inactiveExpanded}
                  onToggle={() => setInactiveExpanded(!inactiveExpanded)}
                />
                {(!isMobile || inactiveExpanded) && (
                  <div className="flex-1 lg:overflow-y-auto pr-1 sm:pr-3 mt-4 pb-8 custom-scrollbar">
                    <div className="flex flex-col gap-4">
                      {inactiveGroups.length === 0 ? (
                        <EmptyState
                          icon={<Send size={28} className="text-[var(--color-text-dim)]" />}
                          text="All teams are active."
                        />
                      ) : (
                        inactiveGroups.map((g) => (
                          <ClientCard
                            key={g.id}
                            group={g}
                            config={config.mappings[g.id] || null}
                            stories={storiesMap[g.id] || null}
                            loadingStories={loadingStoriesFor.has(g.id)}
                            slackChannels={slackChannels}
                            isActive={false}
                            onToggleActive={handleToggleActive}
                            onChannelChange={handleChannelChange}
                            onSendSingle={handleSendSingle}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </main>
      )}

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter flex items-center gap-2 px-4 py-3 rounded-[8px] shadow-xl text-[13px] border ${
              t.type === 'success'
                ? 'bg-[var(--color-surface-2)] border-[var(--color-success)]/35 text-[var(--color-success)]'
                : 'bg-[var(--color-surface-2)] border-[var(--color-danger)]/35 text-[var(--color-danger)]'
            }`}
          >
            {t.type === 'success' ? <Send size={13} /> : <AlertTriangle size={13} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Cron Settings Modal */}
      {showCronModal && (
        <CronSettingsModal
          config={config}
          onClose={() => setShowCronModal(false)}
          onSave={handleSaveCron}
        />
      )}

      {/* Scroll to Top */}
      {isMobile && showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-[var(--color-tg-orange)] text-white shadow-lg animate-fade-in z-50 hover:scale-110 active:scale-95 transition-all"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}

// ---- Small sub-components ----

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`text-[22px] font-bold leading-none ${highlight ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] font-medium">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-[var(--color-border)]" />;
}

function ColHeader({ active, count, expanded, onToggle, isMobile }: { 
  active: boolean; 
  count: number;
  expanded?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
}) {
  return (
    <div 
      className={`flex items-center gap-2 pb-3 border-b border-[var(--color-border)] ${isMobile ? 'cursor-pointer hover:bg-[var(--color-surface-2)]/50 -mx-2 px-2 rounded-t-[8px]' : ''}`}
      onClick={() => isMobile && onToggle?.()}
    >
      <div
        className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-dim)]'}`}
        style={active ? { boxShadow: '0 0 6px var(--color-success)' } : {}}
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[var(--color-text-muted)]">
        {active ? 'Active Teams' : 'Inactive Teams'}
      </span>
      <span className="ml-auto bg-[var(--color-surface-3)] text-[var(--color-text-dim)] rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
        {count}
      </span>
      {isMobile && (
        <div className="ml-1 text-[var(--color-text-dim)]">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon}
      <p className="text-[12px] text-[var(--color-text-dim)] max-w-[200px]">{text}</p>
    </div>
  );
}
