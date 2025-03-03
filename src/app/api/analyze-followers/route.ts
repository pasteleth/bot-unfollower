import { NextRequest, NextResponse } from 'next/server';

// Type for the analysis result we return
type AnalysisResult = {
  moderation?: {
    spam?: number;
    llm_generated?: number;
  };
};

// Mock analysis function that would be replaced with a real API call to MBD
function analyzeBotContent(content: string): AnalysisResult {
  // In production, this would call an external API for content analysis
  // For now, return pseudorandom scores based on the content string
  const contentHash = content.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isLikelySpam = contentHash % 5 === 0; // 20% chance of being considered spam
  const isLikelyAI = contentHash % 7 === 0;   // ~14% chance of being considered AI
  
  return {
    moderation: {
      spam: isLikelySpam ? 0.7 + (contentHash % 30) / 100 : 0.1 + (contentHash % 40) / 100,
      llm_generated: isLikelyAI ? 0.7 + (contentHash % 25) / 100 : 0.2 + (contentHash % 30) / 100
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { followers } = body;
    
    if (!followers || !Array.isArray(followers)) {
      return NextResponse.json({ error: 'Invalid followers data' }, { status: 400 });
    }
    
    // Process each follower and generate analysis results
    const analysisResults: Record<string, AnalysisResult> = {};
    
    followers.forEach((follower) => {
      const { fid, username, display_name } = follower;
      
      if (!fid) return;
      
      // Use follower data as content for analysis
      const content = `${username || ''} ${display_name || ''}`;
      analysisResults[fid.toString()] = analyzeBotContent(content);
    });
    
    return NextResponse.json({ analysisResults });
  } catch (error) {
    console.error('Error in analyze-followers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 