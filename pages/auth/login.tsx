import { LoginPageClient } from '@/components/auth/LoginPageClient';
import { HreflangHead } from '@/components/layout/HreflangHead';

export default function LoginPage() {
  return (
    <>
      <HreflangHead path="/auth/login" />
      <LoginPageClient />
    </>
  );
}
