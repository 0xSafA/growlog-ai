'use client';

import { CaptureFab } from '@/components/layout/CaptureFab';
import { ContextScopeBar } from '@/components/layout/ContextScopeBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { cn } from '@/lib/utils';
import {
  Camera,
  ClipboardCheck,
  FileText,
  Home,
  List,
  LogOut,
  MessageCircle,
  Settings2,
  Thermometer,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';

/** ADR-005: five core modes; capture is the FAB, not a sixth tab. */
const nav = [
  { href: '/', label: 'Фокус', icon: Home },
  { href: '/timeline', label: 'Таймлайн', icon: List },
  { href: '/assistant', label: 'ИИ', icon: MessageCircle, modeTitle: 'Ассистент' },
  { href: '/sop', label: 'SOP', icon: ClipboardCheck },
  { href: '/reports', label: 'Отчёты', icon: FileText },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { pathname } = useRouter();
  const { supabase, farms, farmId, setFarmId } = useFarmContext();
  const showCaptureFab = pathname !== '/log';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/80 bg-card/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Growlog AI</p>
              <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              {farms.length > 1 && (
                <select
                  className="max-w-[120px] sm:max-w-[140px] rounded-md border border-input bg-background px-2 py-1 text-sm"
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
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link href="/photos" aria-label="Фото">
                  <Camera className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <Link href="/sensors" aria-label="Сенсоры">
                  <Thermometer className="h-5 w-5" />
                </Link>
              </Button>
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
          <ContextScopeBar />
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-3xl flex-1 px-4 py-6',
          showCaptureFab && 'pb-28'
        )}
      >
        {children}
      </main>

      {showCaptureFab && <CaptureFab />}

      <nav className="sticky bottom-0 border-t border-border/80 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl gap-0.5 overflow-x-auto px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-1">
          {nav.map(({ href, label, icon: Icon, modeTitle }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={modeTitle ?? label}
                aria-label={modeTitle ?? label}
                className={cn(
                  'flex min-w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-lg py-2 text-[10px] font-medium transition-colors sm:min-w-[3.75rem] sm:text-[11px]',
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
