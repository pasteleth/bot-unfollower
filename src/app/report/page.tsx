'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface FlaggedAccount {
  fid: string;
  username: string;
  displayName: string;
  pfpUrl: string;
  flags: {
    isSpam: boolean;
    isAiGenerated: boolean;
    hasSexualContent: boolean;
    hasHateContent: boolean;
    hasViolentContent: boolean;
    hasHarassmentContent: boolean;
    hasSelfHarmContent: boolean;
    hasSexualMinorsContent: boolean;
    hasThreateningContent: boolean;
    hasGraphicViolenceContent: boolean;
    hasCombinedSpamAndAi: boolean;
    hasHighSpam: boolean;
    hasHighAi: boolean;
    isFlagged: boolean;
  };
  scores: {
    spam: number;
    aiGenerated: number;
    sexual: number;
    hate: number;
    violence: number;
    harassment: number;
    selfharm: number;
    sexualMinors: number;
    threatening: number;
    graphicViolence: number;
  };
}

interface ScanReport {
  fid: string;
  timestamp: string;
  followingCount: number;
  flaggedCount: number;
  flaggedAccounts: FlaggedAccount[];
}

// Loading fallback component
function ReportLoading() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-4">Loading Report...</h1>
        <p>Please wait while we generate your report.</p>
      </div>
    </div>
  );
}

// Component that uses the search params
function ReportContent() {
  const searchParams = useSearchParams();
  const fid = searchParams.get('fid');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);

  useEffect(() => {
    if (!fid) {
      setError('No FID provided');
      setLoading(false);
      return;
    }

    async function fetchReport() {
      try {
        const response = await fetch(`/api/scan-following?fid=${fid}`);
        if (!response.ok) {
          throw new Error('Failed to fetch report');
        }
        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [fid]);

  // Format a score as a percentage
  const formatScore = (score: number) => {
    return `${(score * 100).toFixed(2)}%`;
  };

  // Get a CSS class based on the score
  const getScoreClass = (score: number) => {
    if (score > 0.75) return 'text-red-500 font-bold';
    if (score > 0.5) return 'text-orange-500 font-bold';
    if (score > 0.25) return 'text-yellow-500';
    if (score > 0.1) return 'text-blue-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-4">Loading Report...</h1>
          <p>Please wait while we generate your report.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!report || report.flaggedCount === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-4">Account Scanner Report</h1>
          <p className="text-green-500 font-bold">Great news! We didn&apos;t find any problematic accounts in your following list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-4">Account Scanner Report</h1>
        
        <div className="mb-8">
          <p>Scanned <strong>{report.followingCount}</strong> accounts you follow</p>
          <p>Found <strong className="text-red-500">{report.flaggedCount}</strong> potentially problematic accounts</p>
          <p className="text-sm text-gray-500">Report generated on {new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <h2 className="text-xl font-bold mb-4">Flagged Accounts</h2>
        
        <div className="space-y-6">
          {report.flaggedAccounts.map((account) => (
            <div key={account.fid} className="border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                {account.pfpUrl ? (
                  <Image 
                    src={account.pfpUrl} 
                    alt={account.displayName} 
                    width={48} 
                    height={48} 
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-500">{account.displayName.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <h3 className="font-bold">{account.displayName}</h3>
                  <p className="text-gray-500">@{account.username}</p>
                </div>
                <div className="ml-auto">
                  <a 
                    href={`https://warpcast.com/${account.username}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                  >
                    View Profile
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold mb-2">Flags</h4>
                  <ul className="space-y-1">
                    {account.flags.isSpam && <li className="text-red-500">⚠️ Spam Account</li>}
                    {account.flags.isAiGenerated && <li className="text-orange-500">⚠️ AI-Generated Content</li>}
                    {account.flags.hasCombinedSpamAndAi && <li className="text-red-500">⚠️ Combined Spam & AI Indicators</li>}
                    {account.flags.hasHighSpam && <li className="text-red-500">⚠️ High Spam Probability</li>}
                    {account.flags.hasHighAi && <li className="text-orange-500">⚠️ High AI-Generated Content Probability</li>}
                    {account.flags.hasSexualContent && <li className="text-red-500">⚠️ Sexual Content</li>}
                    {account.flags.hasHateContent && <li className="text-red-500">⚠️ Hate Speech</li>}
                    {account.flags.hasViolentContent && <li className="text-red-500">⚠️ Violent Content</li>}
                    {account.flags.hasHarassmentContent && <li className="text-red-500">⚠️ Harassment</li>}
                    {account.flags.hasSelfHarmContent && <li className="text-red-500">⚠️ Self-Harm Content</li>}
                    {account.flags.hasSexualMinorsContent && <li className="text-red-500">⚠️ Sexual Content with Minors</li>}
                    {account.flags.hasThreateningContent && <li className="text-red-500">⚠️ Threatening Content</li>}
                    {account.flags.hasGraphicViolenceContent && <li className="text-red-500">⚠️ Graphic Violence</li>}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold mb-2">Moderation Scores</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Spam: <span className={getScoreClass(account.scores.spam)}>{formatScore(account.scores.spam)}</span></li>
                    <li>AI-Generated: <span className={getScoreClass(account.scores.aiGenerated)}>{formatScore(account.scores.aiGenerated)}</span></li>
                    <li>Sexual Content: <span className={getScoreClass(account.scores.sexual)}>{formatScore(account.scores.sexual)}</span></li>
                    <li>Hate Speech: <span className={getScoreClass(account.scores.hate)}>{formatScore(account.scores.hate)}</span></li>
                    <li>Violence: <span className={getScoreClass(account.scores.violence)}>{formatScore(account.scores.violence)}</span></li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 text-right">
                <a 
                  href={`https://warpcast.com/~/settings/following?unfollow=${account.fid}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                  Unfollow
                </a>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Powered by MBD Moderation API. Moderation scores are estimates and may not be 100% accurate.
          </p>
        </div>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function ReportPage() {
  return (
    <Suspense fallback={<ReportLoading />}>
      <ReportContent />
    </Suspense>
  );
} 