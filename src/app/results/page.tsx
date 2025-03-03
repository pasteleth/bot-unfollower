'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface FlaggedAccount {
  fid: string;
  username: string;
  displayName: string;
  pfpUrl: string;
  flags: {
    isFlagged: boolean;
    reasons: string[];
  };
  scores: {
    [key: string]: number;
  };
}

interface ScanResults {
  fid: string;
  timestamp: string;
  followingCount: number;
  flaggedCount: number;
  flaggedAccounts: FlaggedAccount[];
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const fid = searchParams.get('fid');
  
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!fid) {
      setError('No FID provided');
      setLoading(false);
      return;
    }
    
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/scan-following?fid=${fid}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching results: ${response.statusText}`);
        }
        
        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [fid]);
  
  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Loading Results...</h1>
        <p>Analyzing your following list for potential bots...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500">{error}</p>
        <a href="/" className="text-blue-500 underline mt-4 block">Return to Scanner</a>
      </div>
    );
  }
  
  if (!results || results.flaggedCount === 0) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Scan Complete</h1>
        <p>Good news! No potential bots were found in your following list.</p>
        <a href="/" className="text-blue-500 underline mt-4 block">Scan Again</a>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Bot Detection Results</h1>
      
      <div className="mb-6">
        <p>We analyzed your following list and found {results.flaggedCount} potential bots out of {results.followingCount} accounts you follow.</p>
      </div>
      
      <h2 className="text-xl font-semibold mb-2">Flagged Accounts</h2>
      
      <div className="grid gap-4">
        {results.flaggedAccounts.map((account) => (
          <div key={account.fid} className="border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              {account.pfpUrl && (
                <img 
                  src={account.pfpUrl} 
                  alt={account.username} 
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <h3 className="font-medium">{account.displayName}</h3>
                <p className="text-sm text-gray-600">@{account.username}</p>
              </div>
            </div>
            
            <div className="mt-2">
              <h4 className="font-medium">Flags:</h4>
              <ul className="list-disc list-inside text-sm">
                {account.flags.reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
            
            <div className="mt-2">
              <h4 className="font-medium">Scores:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(account.scores).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium">{key}:</span> {(value * 100).toFixed(1)}%
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <a href="/" className="text-blue-500 underline mt-6 block">Scan Again</a>
    </div>
  );
}

// Wrap the component with Suspense
export default function ResultsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
} 