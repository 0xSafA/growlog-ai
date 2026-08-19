import { HomeHead } from '@/components/landing/HomeHead';
import { HreflangHead } from '@/components/layout/HreflangHead';
import { LandingPage } from '@/components/landing/LandingPage';

export default function HomePage() {
  return (
    <>
      <HreflangHead path="/" />
      <HomeHead />
      <LandingPage />
    </>
  );
}
