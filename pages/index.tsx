import { LandingPage } from '@/components/landing/LandingPage';
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Growlog AI — журнал выращивания с памятью цикла</title>
        <meta
          name="description"
          content="Голосовые заметки, датчики, фото и AI-советник на базе полной истории вашего grow cycle."
        />
      </Head>
      <LandingPage />
    </>
  );
}
