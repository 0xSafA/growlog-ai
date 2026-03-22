import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AppProviders } from '@/components/providers/AppProviders';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProviders>
      <Component {...pageProps} />
    </AppProviders>
  );
}
