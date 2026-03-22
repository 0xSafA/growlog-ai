'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { cn } from '@/lib/utils';
import { Camera, Home, List, LogOut, PenLine, Settings2, Thermometer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const nav = [
  { href: '/', label: 'Фокус', icon: Home },
  { href: '/timeline', label: 'Таймлайн', icon: List },
  { href: '/log', label: 'Запись', icon: PenLine },
  { href: '/photos', label: 'Фото', icon: Camera },
  { href: '/sensors', label: 'Сенсоры', icon: Thermometer },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { pathname } = useRouter();
  const { supabase, farms, farmId, setFarmId } = useFarmContext();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/80 bg-card/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Growlog AI</p>
            <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {farms.length > 1 && (
              <select
                className="max-w-[140px] rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={farmId ?? ''}
                onChange={(e) => setFarmId(e.target.value)}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings" aria-label="Настройки">
                <Settings2 className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Выйти"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>

      <nav className="sticky bottom-0 border-t border-border/80 bg-card/90 backdrop-blur-md">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="mb-0.5 h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
