'use client';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/components/providers/I18nProvider';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';
import Link from 'next/link';

/** ADR-005: golden action — REC / add event; valid next step from almost any screen. */
export function CaptureFab({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-50 flex justify-center px-4',
        className
      )}
      style={{
        bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="pointer-events-auto">
        <Button
          asChild
          size="lg"
          className="h-14 min-w-[min(100vw-2rem,20rem)] gap-2 rounded-full text-base font-semibold shadow-lg shadow-primary/30"
        >
          <Link href="/log" aria-label={t('nav.captureAria')}>
            <Mic className="h-5 w-5" />
            {t('nav.capture')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
