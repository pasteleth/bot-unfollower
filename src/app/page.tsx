import BotDetector from '@/components/frame/bot-detector';
import { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Bot Detector Frame',
  description: 'Unfollow bots in your Farcaster network',
  openGraph: {
    title: 'Bot Detector Frame',
    description: 'Unfollow bots in your Farcaster network',
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': 'http://localhost:3000/api/og',
    'fc:frame:button:1': 'Find Bots I Follow',
    'fc:frame:post_url': 'http://localhost:3000/api/frame',
  },
};

export default function Home() {
  return (
    <>
      <BotDetector />
      <div style={{ display: 'none' }}>
        <Image 
          src="/api/og" 
          alt="Frame preview" 
          width={1200} 
          height={630} 
          priority
        />
      </div>
      <footer className="text-center text-sm text-white/70">
        <p>Powered by MBD Moderation API - Helping build a safer Farcaster ecosystem</p>
        <p className="mt-2">&copy; 2023 Account Scanner. All rights reserved.</p>
      </footer>
    </>
  );
}
