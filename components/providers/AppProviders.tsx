'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { FarmProvider } from '@/components/providers/FarmProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <FarmProvider>{children}</FarmProvider>
        <Analytics />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
