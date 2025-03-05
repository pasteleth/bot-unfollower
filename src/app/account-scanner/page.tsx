'use client';

import dynamic from 'next/dynamic';

const AccountScanner = dynamic(() => import('@/components/AccountScanner'), {
  ssr: false,
});

export default function AccountScannerPage() {
  return (
    <main className="min-h-screen flex flex-col p-4">
      <AccountScanner />
    </main>
  );
} 