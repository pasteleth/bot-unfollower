import { NextRequest, NextResponse } from 'next/server';
import { analyzeContent } from '../../../lib/mbd';
import { Following, BotAccount, BotStats } from '../../../types/farcaster';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { following } = body;
    
    if (!following || !Array.isArray(following) || following.length === 0) {
      return NextResponse.json({ error: 'Invalid or missing following data' }, { status: 400 });
    }
    
    // Process in batches to avoid API rate limits
    const batchSize = 5;
    const results: BotAccount[] = [];
    const botStats: BotStats = { knownBots: 0, aiContentBots: 0, spamBots: 0 };
    
    for (let i = 0; i < following.length; i += batchSize) {
      const batch = following.slice(i, i + batchSize);
      
      // Process each account in the batch
      const batchPromises = batch.map(async (account: Following) => {
        // For this example, we'll analyze the bio
        const contentToAnalyze = account.bio || account.username;
        
        try {
          const analysis = await analyzeContent(contentToAnalyze);
          
          const botAccount: BotAccount = {
            ...account,
            botType: 'spam', // Default, will be updated based on scores
            botScores: {
              known: false,
              spam_probability: analysis.moderation?.spam_probability || 0,
              ai_generated_probability: analysis.moderation?.ai_generated_probability || 0,
            }
          };
          
          // Determine bot type based on the highest score
          if (botAccount.botScores.spam_probability && botAccount.botScores.spam_probability > 0.7) {
            botAccount.botType = 'spam';
            botStats.spamBots++;
          } else if (botAccount.botScores.ai_generated_probability && botAccount.botScores.ai_generated_probability > 0.7) {
            botAccount.botType = 'ai';
            botStats.aiContentBots++;
          } else {
            botAccount.botType = 'known';
            botStats.knownBots++;
          }
          
          return botAccount;
        } catch (error) {
          // Return the account with an error indicator
          console.error(`Error analyzing account ${account.username}:`, error);
          return {
            ...account,
            botType: 'known',
            botScores: {
              error: true,
              known: false,
              spam_probability: 0,
              ai_generated_probability: 0,
              errorInfo: error instanceof Error ? error.message : 'Unknown error analyzing account'
            }
          } as BotAccount;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < following.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return NextResponse.json({ 
      botAccounts: results, 
      botStats 
    });
    
  } catch (error) {
    console.error('Error in /api/analyze-following:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error analyzing following' },
      { status: 500 }
    );
  }
} 