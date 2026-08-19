/** Subtle botanical accents for the public landing page only. */
export function LandingHeroDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-grow-moss/15 blur-3xl" />
      <div className="absolute -right-16 top-32 h-96 w-96 rounded-full bg-grow-leaf/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-grow-accent/10 blur-3xl" />

      <svg
        className="absolute -right-6 top-16 h-40 w-40 text-grow-leaf/20 dark:text-grow-leaf/10"
        viewBox="0 0 120 120"
        fill="currentColor"
      >
        <path d="M60 8c-8 18-28 32-48 36 14 6 28 18 36 36 8-18 22-30 36-36-20-4-40-18-48-36z" />
        <path d="M92 52c-6 12-18 22-32 26 8 4 16 12 20 24 4-12 12-20 20-24-14-4-26-14-32-26z" opacity="0.6" />
      </svg>

      <svg
        className="absolute bottom-12 left-8 h-28 w-28 rotate-12 text-grow-moss/25 dark:text-grow-moss/15"
        viewBox="0 0 80 80"
        fill="currentColor"
      >
        <path d="M40 6C32 22 16 34 4 38c10 5 20 14 26 28 6-14 16-23 26-28-12-4-28-16-36-32z" />
      </svg>

      <svg
        className="absolute right-1/4 top-1/2 h-16 w-16 -rotate-45 text-grow-accent/20"
        viewBox="0 0 60 60"
        fill="currentColor"
      >
        <path d="M30 4C24 16 12 24 2 26c8 4 14 10 18 20 4-10 10-16 18-20-10-2-22-10-28-22z" />
      </svg>

      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, hsl(var(--grow-leaf) / 0.12) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}

export function LandingCtaDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_120%,hsl(var(--grow-moss)/0.25),transparent)]" />
      <svg
        className="absolute -left-4 bottom-0 h-32 w-32 text-white/10"
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        <path d="M50 4C40 24 16 38 0 42c12 6 24 18 32 36 8-18 20-30 32-36-16-4-40-18-50-38z" />
      </svg>
      <svg
        className="absolute -right-2 top-4 h-24 w-24 text-white/10"
        viewBox="0 0 80 80"
        fill="currentColor"
      >
        <path d="M40 6C32 22 16 34 4 38c10 5 20 14 26 28 6-14 16-23 26-28-12-4-28-16-36-32z" />
      </svg>
    </div>
  );
}
