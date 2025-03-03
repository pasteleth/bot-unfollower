import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-600 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Farcaster Account Scanner</h1>
          <p className="text-xl">Identify potentially problematic accounts you follow</p>
        </header>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-12 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">What is this?</h2>
          <p className="mb-4">
            The Farcaster Account Scanner helps you improve the quality of your feed by identifying potentially problematic accounts you follow.
          </p>
          <p className="mb-4">
            Using MBD's AI moderation API, we analyze your following list and flag accounts that might be:
          </p>
          <ul className="list-disc list-inside mb-6 space-y-2">
            <li>Spam accounts</li>
            <li>AI-generated content farms</li>
            <li>Posting harmful or inappropriate content</li>
            <li>Violating community standards</li>
          </ul>
          <p>
            You'll get a detailed report showing any flagged accounts, allowing you to make informed decisions about who to continue following.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 mb-12 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">How it works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-purple-800/40 p-4 rounded-lg">
              <div className="text-3xl font-bold mb-2">1</div>
              <h3 className="font-bold mb-2">Run the scanner</h3>
              <p className="text-sm">Launch our Frame in your favorite Farcaster client and authorize the scan</p>
            </div>
            
            <div className="bg-purple-800/40 p-4 rounded-lg">
              <div className="text-3xl font-bold mb-2">2</div>
              <h3 className="font-bold mb-2">Wait for results</h3>
              <p className="text-sm">We'll scan your following list and check for problematic accounts</p>
            </div>
            
            <div className="bg-purple-800/40 p-4 rounded-lg">
              <div className="text-3xl font-bold mb-2">3</div>
              <h3 className="font-bold mb-2">Review & take action</h3>
              <p className="text-sm">See all flagged accounts and decide who to unfollow</p>
            </div>
          </div>
          
          <p className="text-sm">
            Your privacy is important: We don't store any information about your account or following list.
            All processing happens on-demand and results are only shown to you.
          </p>
        </div>

        <div className="text-center mb-12">
          <Link 
            href="/frames/account-scanner" 
            className="bg-white text-purple-900 hover:bg-purple-200 px-8 py-4 rounded-full text-xl font-bold inline-block shadow-lg transition-all hover:scale-105"
          >
            Launch Account Scanner Frame
          </Link>
        </div>

        <footer className="text-center text-sm text-white/70">
          <p>Powered by MBD Moderation API - Helping build a safer Farcaster ecosystem</p>
          <p className="mt-2">© 2023 Account Scanner. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
