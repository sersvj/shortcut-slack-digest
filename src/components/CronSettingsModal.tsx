'use client';

import { useState } from 'react';
import { X, Clock, Info } from 'lucide-react';
import { CronConfig, AppConfig } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Halifax',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
];

const DEFAULT_CRON: CronConfig = {
  enabled: false,
  hour: 9,
  minute: 0,
  days: [1, 2, 3, 4, 5], // Mon–Fri
  timezone: 'America/New_York',
};

function toCronExpression(cron: CronConfig): string {
  const { minute, hour, days } = cron;
  const dayStr = days.length === 7 ? '*' : days.join(',');
  return `${minute} ${hour} * * ${dayStr}`;
}

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute === 0 ? '00' : '30';
  return `${h}:${m} ${ampm}`;
}

interface Props {
  config: AppConfig;
  onClose: () => void;
  onSave: (cron: CronConfig) => void;
}

export function CronSettingsModal({ config, onClose, onSave }: Props) {
  const [cron, setCron] = useState<CronConfig>(config.cron ?? DEFAULT_CRON);

  const toggleDay = (day: number) => {
    setCron((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort(),
    }));
  };

  const handleSave = () => {
    onSave(cron);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-[var(--color-tg-orange)]" />
            <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              Scheduled Digest
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Status banner */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-[8px] bg-[var(--color-surface-3)] border border-[var(--color-border)]">
            <Info size={13} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">
              Set your preferred schedule below and save. Once you&apos;re happy with it,
              reach out to Stephen to flip the switch and get automatic digests running.
            </p>
          </div>

          {/* Time */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-dim)]">
              Send Time
            </label>
            <div className="flex gap-2">
              <select
                value={cron.hour}
                onChange={(e) => setCron((p) => ({ ...p, hour: Number(e.target.value) }))}
                className="flex-1 px-3 py-2 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                  </option>
                ))}
              </select>
              <select
                value={cron.minute}
                onChange={(e) => setCron((p) => ({ ...p, minute: Number(e.target.value) }))}
                className="w-24 px-3 py-2 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors"
              >
                <option value={0}>:00</option>
                <option value={30}>:30</option>
              </select>
            </div>
          </div>

          {/* Days */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-dim)]">
              Days
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-[6px] text-[12px] font-semibold border transition-colors ${
                    cron.days.includes(i)
                      ? 'bg-[var(--color-tg-orange)] border-[var(--color-tg-orange)] text-white'
                      : 'bg-[var(--color-surface-3)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)]'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-dim)]">
              Timezone
            </label>
            <select
              value={cron.timezone}
              onChange={(e) => setCron((p) => ({ ...p, timezone: e.target.value }))}
              className="w-full px-3 py-2 rounded-[6px] bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] focus:outline-none focus:border-[var(--color-tg-orange)] transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Cron expression preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-dim)]">
              Schedule Preview
            </label>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[6px] bg-black/30 border border-[var(--color-border)]">
              <span className="text-[12px] text-[var(--color-text-muted)]">
                {cron.days.length === 0
                  ? 'No days selected'
                  : `${formatTime(cron.hour, cron.minute)} on ${cron.days.map((d) => DAYS[d]).join(', ')}`}
              </span>
              <code className="text-[11px] text-[var(--color-tg-orange)] font-mono">
                {toCronExpression(cron)}
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-base)]/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={cron.days.length === 0}
            className="px-4 py-2 rounded-[6px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[13px] font-semibold transition-colors disabled:opacity-40"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
