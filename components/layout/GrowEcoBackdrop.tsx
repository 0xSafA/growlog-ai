import { cn } from '@/lib/utils';

/** Soft botanical background for auth and setup flows. */
export function GrowEcoBackdrop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-grow-sage/70 via-background to-background dark:from-grow-sage/20">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-grow-moss/10 blur-3xl" />
        <div className="absolute -right-10 bottom-20 h-72 w-72 rounded-full bg-grow-leaf/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.25] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--grow-leaf) / 0.1) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>
      <div className={cn('relative', className)}>{children}</div>
    </div>
  );
}
