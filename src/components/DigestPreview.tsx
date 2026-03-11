'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { CategorizedStories } from '@/lib/types';
import { DigestBody } from './digest-sections';

interface DigestPreviewProps {
  teamName: string;
  stories: CategorizedStories;
}

export function DigestPreview({ teamName, stories }: DigestPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors text-[12px] font-medium"
      >
        <ExternalLink size={13} />
        <span>Digest Preview</span>
        <ChevronDown
          size={14}
          className={`ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="digest-preview-area border-t border-[var(--color-border)] p-4 overflow-x-auto">
          <div className="flex items-baseline gap-3 mb-3 pb-3 border-b border-[var(--color-border)]">
            <span className="text-[13px] font-bold text-[var(--color-text-primary)]">
              {teamName} — Task Digest
            </span>
            <span className="text-[11px] text-[var(--color-text-dim)]">{today}</span>
          </div>

          <DigestBody stories={stories} />

          <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-dim)]">
            {stories.total} open {stories.total === 1 ? 'story' : 'stories'} total
          </div>
        </div>
      )}
    </>
  );
}
