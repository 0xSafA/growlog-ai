'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFarmContext } from '@/components/providers/FarmProvider';
import {
  Brain,
  Camera,
  ClipboardCheck,
  LineChart,
  Mic,
  ShieldCheck,
  Sprout,
  Thermometer,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const features = [
  {
    icon: Mic,
    title: 'Голосовые заметки',
    description:
      'Grover фиксирует день голосом — Whisper расшифровывает, AI структурирует, вы подтверждаете перед сохранением.',
  },
  {
    icon: Brain,
    title: 'AI с памятью цикла',
    description:
      'Советник учитывает весь журнал: события, daily summaries, датчики, фото и прошлые диалоги — не только последний вопрос.',
  },
  {
    icon: Thermometer,
    title: 'Датчики и среда',
    description: 'Ручной ввод или API ingest. Агрегаты min/max/avg попадают в контекст рекомендаций.',
  },
  {
    icon: Camera,
    title: 'Фото-анализ',
    description:
      'Vision pipeline сравнивает кадры во времени и даёт гипотезы — без диагнозов «из головы» модели.',
  },
  {
    icon: ClipboardCheck,
    title: 'SOP и регламенты',
    description: 'Напоминания, просрочки, исполнение — в одной картине с журналом и отчётами.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust layer',
    description: 'Факты отделены от гипотез. Слабый контекст → уточнение, а не выдумка.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Записывайте',
    text: 'Голосом, текстом, фото или с датчиков — всё становится событиями в timeline.',
  },
  {
    n: '02',
    title: 'Накапливайте',
    text: 'Worker строит daily summaries и индекс — история цикла сжимается для AI.',
  },
  {
    n: '03',
    title: 'Спрашивайте',
    text: 'AI-ассистент собирает retrieval по ферме и отвечает с grounding и confidence.',
  },
];

export function LandingPage() {
  const router = useRouter();
  const { userId, authLoading } = useFarmContext();

  useEffect(() => {
    if (!authLoading && userId) {
      void router.replace('/dashboard');
    }
  }, [authLoading, userId, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  if (userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Переход в журнал…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sprout className="h-4 w-4" />
            </span>
            Growlog AI
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground transition-colors">
              Возможности
            </a>
            <a href="#how" className="hover:text-foreground transition-colors">
              Как работает
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Войти</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/auth/login">Начать</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              <LineChart className="h-3.5 w-3.5" />
              Event-centric grow journal + retrieval-first AI
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Журнал выращивания, который помнит{' '}
              <span className="text-primary">весь цикл</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              Growlog AI — PWA для гроверов: ежедневные голосовые заметки, датчики, фото и
              AI-советник, который опирается на факты из вашей фермы, а не на общие знания модели.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/login">Создать журнал</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">У меня уже есть аккаунт</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Supabase · OpenAI · Next.js PWA · RLS по ферме
            </p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Всё, что нужно Grover&apos;у каждый день
            </h2>
            <p className="mt-3 text-muted-foreground">
              Capture → timeline → derived summaries → AI с guardrails. Один источник правды —
              база событий, не чат.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/70 bg-card/50">
                <CardHeader className="pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {f.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Как это работает</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative">
                  <span className="text-4xl font-bold text-primary/20">{s.n}</span>
                  <h3 className="mt-2 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Готовы вести журнал по-взрослому?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Регистрация за минуту. Онбординг создаст ферму и первый grow cycle.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/auth/login">Начать бесплатно</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Growlog AI</p>
          <div className="flex gap-4">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              Вход
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
