'use client';

import { LandingCtaDecor, LandingHeroDecor } from '@/components/landing/LandingBotanicalDecor';
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
  Leaf,
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
    <div className="landing-eco min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-grow-leaf/15 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-grow-forest text-grow-forest-foreground shadow-sm shadow-grow-leaf/20">
              <Sprout className="h-4 w-4" />
            </span>
            {t('appName')}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="transition-colors hover:text-grow-leaf">
              {t('landing.features')}
            </a>
            <a href="#how" className="transition-colors hover:text-grow-leaf">
              {t('landing.howItWorks')}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">{t('landing.signIn')}</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="hidden bg-grow-forest text-grow-forest-foreground hover:bg-grow-forest/90 sm:inline-flex"
            >
              <Link href="/auth/login">{t('landing.getStarted')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-grow-leaf/15 bg-gradient-to-b from-grow-sage/80 via-background to-background dark:from-grow-sage/40">
          <LandingHeroDecor />
          <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-grow-leaf/25 bg-grow-earth/60 px-3 py-1 text-xs text-grow-forest dark:bg-grow-earth/30 dark:text-grow-leaf">
              <Leaf className="h-3.5 w-3.5" />
              {t('landing.badge')}
            </p>
            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {t('landing.heroTitle')}{' '}
              <span className="bg-gradient-to-r from-grow-forest to-grow-moss bg-clip-text text-transparent dark:from-grow-leaf dark:to-grow-accent">
                {t('landing.heroHighlight')}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('landing.heroSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                asChild
                className="bg-grow-forest text-grow-forest-foreground shadow-md shadow-grow-leaf/20 hover:bg-grow-forest/90"
              >
                <Link href="/auth/login">{t('landing.createJournal')}</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-grow-leaf/30 hover:border-grow-leaf/50 hover:bg-grow-sage/50"
              >
                <Link href="/auth/login">{t('landing.haveAccount')}</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">{t('landing.stack')}</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-grow-moss">
              {t('landing.features')}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('landing.featuresHeading')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.featuresSub')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="border-grow-leaf/15 bg-card/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-grow-leaf/30 hover:shadow-md hover:shadow-grow-leaf/10"
              >
                <CardHeader className="pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-grow-moss/20 to-grow-leaf/10 text-grow-forest dark:text-grow-leaf">
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

        <section
          id="how"
          className="border-y border-grow-leaf/15 bg-gradient-to-b from-grow-earth/50 to-grow-sage/30 dark:from-grow-earth/20 dark:to-grow-sage/10"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-grow-moss">
              {t('landing.howItWorks')}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('landing.howHeading')}
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative rounded-2xl border border-grow-leaf/10 bg-background/60 p-5 backdrop-blur-sm">
                  <span className="text-4xl font-bold text-grow-leaf/25">{s.n}</span>
                  <h3 className="mt-2 text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-4 py-16 sm:my-8 sm:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-grow-forest px-6 py-14 text-center text-grow-forest-foreground sm:px-10">
            <LandingCtaDecor />
            <div className="relative">
              <Sprout className="mx-auto mb-4 h-8 w-8 opacity-80" />
              <h2 className="text-2xl font-semibold sm:text-3xl">{t('landing.ctaHeading')}</h2>
              <p className="mx-auto mt-3 max-w-md opacity-90">{t('landing.ctaSub')}</p>
              <Button
                size="lg"
                className="mt-8 bg-background text-grow-forest hover:bg-background/90"
                asChild
              >
                <Link href="/auth/login">{t('landing.ctaButton')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-grow-leaf/15 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-1.5">
            <Sprout className="h-3.5 w-3.5 text-grow-moss" />
            © {new Date().getFullYear()} {t('appName')}
          </p>
          <div className="flex gap-4">
            <Link href="/auth/login" className="transition-colors hover:text-grow-leaf">
              {t('landing.footerSignIn')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
