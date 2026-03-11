'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-base)]">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,98,45,0.3) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src="/icon-tg-cow.svg" alt="T/G" className="w-14 h-14" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              T/G Daily Digest
            </h1>
            <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
              Shortcut × Slack
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-8 flex flex-col gap-6 shadow-2xl">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
              Sign in to continue
            </h2>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1.5">
              Use your Tayloe/Gray Slack account to access the dashboard.
            </p>
          </div>

          <button
            onClick={() => signIn('slack', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-[8px] bg-[var(--color-tg-orange)] hover:bg-[var(--color-tg-orange-hover)] text-white text-[14px] font-semibold transition-colors shadow-md shadow-orange-900/20"
          >
            {/* Slack icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
            Sign in with Slack
          </button>

          <p className="text-[11px] text-[var(--color-text-dim)]">
            Access restricted to Tayloe/Gray workspace members only.
          </p>
        </div>
      </div>
    </div>
  );
}
