import { NextRequest, NextResponse } from 'next/server';
import { checkUserModeration, DEFAULT_MODERATION_THRESHOLDS } from '@/lib/moderation';

/**
 * GET handler for user moderation flags API
 * @param request Request object
 * @returns User moderation flags for the specified FID
 */
export async function GET(request: NextRequest) {
  // Get FID and optional parameters from query
  const url = new URL(request.url);
  const fid = url.searchParams.get('fid');
  
  // Get custom threshold values if provided
  const spamThreshold = parseFloat(url.searchParams.get('spam') || '') || DEFAULT_MODERATION_THRESHOLDS.spam;
  const aiThreshold = parseFloat(url.searchParams.get('ai') || '') || DEFAULT_MODERATION_THRESHOLDS.ai_generated;
  
  if (!fid) {
    return NextResponse.json(
      { error: 'Missing FID parameter' },
      { status: 400 }
    );
  }

  try {
    // Get custom thresholds if provided in query params
    const customThresholds = {
      ...DEFAULT_MODERATION_THRESHOLDS,
      spam: spamThreshold,
      ai_generated: aiThreshold
    };
    
    // Get moderation flags with optional custom thresholds
    const moderationResult = await checkUserModeration(fid, customThresholds);
    
    if (!moderationResult) {
      return NextResponse.json(
        { 
          message: `No moderation data found for FID ${fid}`,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Return the moderation data with flags
    return NextResponse.json({
      fid,
      timestamp: new Date().toISOString(),
      flags: moderationResult.flags,
      scores: moderationResult.scores,
      thresholds: customThresholds,
      meta: {
        api: 'MBD User Moderation API',
        endpoint: '/v2/farcaster/users/labels/for-users',
        documentation: 'https://docs.mbd.xyz'
      }
    });
  } catch (error) {
    console.error('Error getting user moderation flags:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 