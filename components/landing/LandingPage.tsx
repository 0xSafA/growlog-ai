'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/components/providers/I18nProvider';
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
import { useEffect, useMemo } from 'react';

export function LandingPage() {
  const router = useRouter();
  const { userId, authLoading } = useFarmContext();
  const { t } = useTranslation();

  const features = useMemo(
    () => [
      {
        icon: Mic,
        title: t('landing.featureVoiceTitle'),
        description: t('landing.featureVoiceDesc'),
      },
      {
        icon: Brain,
        title: t('landing.featureAiTitle'),
        description: t('landing.featureAiDesc'),
      },
      {
        icon: Thermometer,
        title: t('landing.featureSensorsTitle'),
        description: t('landing.featureSensorsDesc'),
      },
      {
        icon: Camera,
        title: t('landing.featurePhotoTitle'),
        description: t('landing.featurePhotoDesc'),
      },
      {
        icon: ClipboardCheck,
        title: t('landing.featureSopTitle'),
        description: t('landing.featureSopDesc'),
      },
      {
        icon: ShieldCheck,
        title: t('landing.featureTrustTitle'),
        description: t('landing.featureTrustDesc'),
      },
    ],
    [t]
  );

  const steps = useMemo(
    () => [
      { n: '01', title: t('landing.step1Title'), text: t('landing.step1Text') },
      { n: '02', title: t('landing.step2Title'), text: t('landing.step2Text') },
      { n: '03', title: t('landing.step3Title'), text: t('landing.step3Text') },
    ],
    [t]
  );

  useEffect(() => {
    if (!authLoading && userId) {
      void router.replace('/dashboard');
    }
  }, [authLoading, userId, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  if (userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('landing.redirectToJournal')}
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
            {t('appName')}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="hover:text-foreground transition-colors">
              {t('landing.features')}
            </a>
            <a href="#how" className="hover:text-foreground transition-colors">
              {t('landing.howItWorks')}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">{t('landing.signIn')}</Link>
            </Button>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/auth/login">{t('landing.getStarted')}</Link>
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
              {t('landing.badge')}
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t('landing.heroTitle')}{' '}
              <span className="text-primary">{t('landing.heroHighlight')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/login">{t('landing.createJournal')}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">{t('landing.haveAccount')}</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{t('landing.stack')}</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('landing.featuresHeading')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.featuresSub')}</p>
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
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('landing.howHeading')}
            </h2>
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
          <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing.ctaHeading')}</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{t('landing.ctaSub')}</p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/auth/login">{t('landing.ctaButton')}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t('appName')}
          </p>
          <div className="flex gap-4">
            <Link href="/auth/login" className="hover:text-foreground transition-colors">
              {t('landing.footerSignIn')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
