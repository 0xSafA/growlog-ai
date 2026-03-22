'use client';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import Link from 'next/link';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const { userId, authLoading } = useFarmContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (userId) void router.replace('/');
  }, [authLoading, userId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      }
      await router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Head>
        <title>Вход — Growlog AI</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Growlog AI</CardTitle>
            <CardDescription>
              {mode === 'signin' ? 'Вход в журнал' : 'Регистрация (Supabase Auth)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Пароль</label>
                <Input
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? '…' : mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted-foreground underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
            </button>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Нужны переменные{' '}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> и{' '}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.{' '}
              <Link href="/" className="underline">
                На главную
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
