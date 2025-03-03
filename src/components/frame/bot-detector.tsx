'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/frame-sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Following, BotAccount, BotStats } from '@/types/farcaster';

// Remove or comment out the unused AnalysisResult type since it's already defined in the API
/* type AnalysisResult = {
  moderation?: {
    spam?: number;
    llm_generated?: number;
  };
}; */

type FrameContext = {
  user: {
    fid: number;
    username?: string;
    displayName?: string;
    pfp?: string;
  };
};

export default function BotDetector() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingGlobalBots, setLoadingGlobalBots] = useState(false);
  const [following, setFollowing] = useState<Following[]>([]);
  const [botAccounts, setBotAccounts] = useState<BotAccount[]>([]);
  const [botStats, setBotStats] = useState<BotStats>({
    knownBots: 0,
    aiContentBots: 0,
    spamBots: 0
  });
  const [progress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Load SDK and context
  useEffect(() => {
    const loadContext = async () => {
      try {
        const ctx = await sdk.context;
        setContext(ctx as FrameContext);
        sdk.actions.ready();
      } catch (error) {
        console.error('Error loading Frame SDK context:', error);
        // If context loading fails, provide a default context with the user's FID
        setContext({
          user: {
            fid: 318473, // Your FID as default
            username: 'yourfarcasterhandle',
            displayName: 'Your Name',
            pfp: 'https://avatar.vercel.sh/yourfarcasterhandle'
          }
        });
      } finally {
        setIsSDKLoaded(true);
      }
    };
    
    loadContext();
  }, []);

  // Load global bot list
  useEffect(() => {
    const loadGlobalBots = async () => {
      if (!isSDKLoaded) return;
      
      setLoadingGlobalBots(true);
      try {
        // Just check if the API endpoint exists, we don't need the data right now
        await fetch('/api/global-bots');
        // No state update needed
      } catch (error) {
        console.error('Error loading global bot list:', error);
      } finally {
        setLoadingGlobalBots(false);
      }
    };
    
    if (isSDKLoaded) {
      loadGlobalBots();
    }
  }, [isSDKLoaded]);

  const handleAnalyzeFollowing = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Call API to get users the current user is following
      const followingResponse = await fetch(`/api/followers?fid=${context?.user?.fid || 318473}`);
      const followingData = await followingResponse.json();
      
      // Check if the response contains an error
      if (followingResponse.status !== 200 || !followingData || followingData.error) {
        throw new Error(followingData.error || 'Failed to fetch following data');
      }
      
      // Set the following accounts
      setFollowing(followingData);
      
      // Call API to analyze following
      const analyzeResponse = await fetch('/api/analyze-following', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ following: followingData }),
      });
      
      const analyzeData = await analyzeResponse.json();
      
      // Check if the response contains an error
      if (analyzeResponse.status !== 200 || !analyzeData || analyzeData.error) {
        throw new Error(analyzeData.error || 'Failed to analyze following data');
      }
      
      // Update state with the analyzed data
      setBotAccounts(analyzeData.botAccounts);
      setBotStats(analyzeData.botStats);
      setStep(2);
    } catch (error) {
      console.error('Error in handleAnalyzeFollowing:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Bot Detector</CardTitle>
            <CardDescription>Loading Frame SDK...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Bot Detector</CardTitle>
          <CardDescription>
            Find bots among accounts you follow on Farcaster
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {context?.user ? (
            <div className="flex items-center space-x-4 mb-6">
              <Avatar className="h-12 w-12">
                <AvatarImage src={context.user.pfp} alt={context.user.username} />
                <AvatarFallback>{context.user.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium">{context.user.displayName}</h3>
                <p className="text-sm text-muted-foreground">@{context.user.username}</p>
              </div>
            </div>
          ) : loadingGlobalBots ? (
            <p className="text-center py-4">Loading bot database...</p>
          ) : null}
          
          {!loading && following.length === 0 && context?.user && (
            <Button 
              onClick={handleAnalyzeFollowing}
              className="w-full"
              disabled={loadingGlobalBots}
            >
              Scan Accounts I Follow
            </Button>
          )}
          
          {(loading || step === 1) && (
            <div className="space-y-4">
              <p className="text-center">
                {loading && step === 0 ? 'Loading accounts you follow...' : `Analyzing ${following.length} accounts for bot activity...`}
              </p>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          {botAccounts.length > 0 && (
            <div className="space-y-6">
              <div className="bg-card/50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Bot Account Analysis</h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-card p-2 rounded">
                    <span className="block text-xl font-bold">{botAccounts.length}</span>
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <div className="bg-card p-2 rounded">
                    <span className="block text-xl font-bold">{botStats.knownBots}</span>
                    <span className="text-xs text-muted-foreground">Known</span>
                  </div>
                  <div className="bg-card p-2 rounded">
                    <span className="block text-xl font-bold">{botStats.aiContentBots}</span>
                    <span className="text-xs text-muted-foreground">AI</span>
                  </div>
                  <div className="bg-card p-2 rounded">
                    <span className="block text-xl font-bold">{botStats.spamBots}</span>
                    <span className="text-xs text-muted-foreground">Spam</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {botAccounts.map((account) => (
                  <div 
                    key={account.fid} 
                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                      account.botType === 'known' ? 'bg-yellow-950/20' : 
                      account.botType === 'spam' ? 'bg-red-950/20' : 
                      'bg-blue-950/20'
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={account.pfp_url} alt={account.username} />
                      <AvatarFallback>{account.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{account.display_name}</p>
                      <p className="text-sm text-muted-foreground truncate">@{account.username}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      {account.botType === 'known' && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-200">Known Bot</span>
                      )}
                      {account.botScores?.spam_probability && account.botScores.spam_probability > 0.7 && (
                        <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-200 mt-1">
                          Spam {Math.round(account.botScores.spam_probability * 100)}%
                        </span>
                      )}
                      {account.botScores?.ai_generated_probability && account.botScores.ai_generated_probability > 0.7 && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-200 mt-1">
                          AI {Math.round(account.botScores.ai_generated_probability * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!loading && following.length > 0 && botAccounts.length === 0 && (
            <div className="text-center py-6">
              <h3 className="text-xl font-medium mb-2">Good news! 🎉</h3>
              <p>No bot accounts detected among the {following.length} accounts you follow.</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <h3 className="text-sm font-medium text-red-800">Error occurred</h3>
              </div>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setStep(0)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </CardContent>
        
        {botAccounts.length > 0 && (
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                setFollowing([]);
                setBotAccounts([]);
                setBotStats({
                  knownBots: 0,
                  aiContentBots: 0,
                  spamBots: 0
                });
              }}
            >
              Reset
            </Button>
            <Button onClick={() => sdk.actions.addFrame()}>
              Save Results
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
} 