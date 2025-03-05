'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

// Define types for the Frame SDK
type FrameContext = {
  fid?: string | number;
  url?: string;
  buttonIndex?: number;
  inputText?: string;
  state?: string;
};

type FrameSDK = {
  actions: {
    ready: () => Promise<void>;
  };
  context: Promise<FrameContext>;
};

// Helper to safely access SDK
const getFrameSDK = (): FrameSDK => {
  if (typeof window === 'undefined') {
    // Return a mock for SSR
    return {
      actions: { ready: async () => {} },
      context: Promise.resolve({})
    };
  }
  // Use dynamic import in browser
  if (window && 'sdk' in window) {
    // @ts-ignore - We know the SDK exists at runtime
    return window.sdk;
  }
  // Fallback mock
  return {
    actions: { ready: async () => {} },
    context: Promise.resolve({})
  };
};

// Base URL for the app with proper protocol
const BASE_URL = (() => {
  // For client-side usage
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For server-side rendering (fallback)
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
})();

type ScanState = 'start' | 'scanning' | 'results' | 'error';

export default function AccountScanner() {
  const [isReady, setIsReady] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('start');
  const [error, setError] = useState<string | null>(null);
  const [fid, setFid] = useState<number | null>(null);
  const [flaggedCount, setFlaggedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Get user connection status and Farcaster ID
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  // Initialize the Frame SDK
  useEffect(() => {
    // Mark the frame as ready
    const initFrameSdk = async () => {
      try {
        const sdk = getFrameSDK();
        await sdk.actions.ready();
        setIsReady(true);
        
        // Get user context
        const context = await sdk.context;
        if (context && context.fid) {
          setFid(Number(context.fid));
        }
      } catch (error) {
        console.error('Failed to initialize Frame SDK:', error);
        setError('Failed to initialize Frame SDK');
      }
    };

    initFrameSdk();
  }, []);

  // Start scanning when user clicks scan button
  const startScan = async () => {
    if (!fid) {
      setError('Farcaster ID not found');
      setScanState('error');
      return;
    }

    setScanState('scanning');
    setIsLoading(true);
    
    try {
      // Call the API to scan the user's following list
      const response = await fetch(`/api/scan-following?fid=${fid}`);
      
      if (!response.ok) {
        throw new Error(`Failed to scan: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setFlaggedCount(data.flaggedCount);
      setScanState('results');
    } catch (error) {
      console.error('Error during scanning:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setScanState('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to start state
  const reset = () => {
    setScanState('start');
    setError(null);
  };

  // Render based on current state
  const renderContent = () => {
    switch (scanState) {
      case 'start':
        return (
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Account Scanner</h1>
            <p className="mb-6">Scan your following list for potentially problematic accounts</p>
            <button
              onClick={startScan}
              disabled={!isReady || !fid || isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Scan My Following List'}
            </button>
          </div>
        );
        
      case 'scanning':
        return (
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Scanning in Progress</h1>
            <p className="mb-6">We're scanning your following list...</p>
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
        
      case 'results':
        return (
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Scan Complete</h1>
            <p className="mb-6">
              {flaggedCount > 0
                ? `We found ${flaggedCount} potentially problematic account${flaggedCount === 1 ? '' : 's'} in your following list`
                : "Good news! We didn't find any potentially problematic accounts in your following list"}
            </p>
            {flaggedCount > 0 && (
              <button
                onClick={() => window.open(`${BASE_URL}/detailed-report?fid=${fid}`, '_blank')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md mb-4"
              >
                View Detailed Report
              </button>
            )}
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-600 text-white rounded-md"
            >
              Scan Again
            </button>
          </div>
        );
        
      case 'error':
        return (
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-4">Error</h1>
            <p className="mb-6">{error || 'An unexpected error occurred'}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-600 text-white rounded-md"
            >
              Try Again
            </button>
          </div>
        );
        
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {renderContent()}
      
      {/* Debug information - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 text-xs">
          <p>Debug Info:</p>
          <p>Ready: {isReady ? 'Yes' : 'No'}</p>
          <p>FID: {fid || 'Not set'}</p>
          <p>State: {scanState}</p>
        </div>
      )}
    </div>
  );
} 