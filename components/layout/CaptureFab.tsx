'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';
import Link from 'next/link';

/** ADR-005: golden action — REC / add event; valid next step from almost any screen. */
export function CaptureFab({ className }: { className?: string }) {
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
          className="h-14 min-w-[min(100vw-2rem,20rem)] rounded-full shadow-lg shadow-primary/25 gap-2 text-base font-semibold"
        >
          <Link href="/log" aria-label="Запись в журнал: текст или голос">
            <Mic className="h-5 w-5" />
            Запись
          </Link>
        </Button>
      </div>
    </div>
  );
}
