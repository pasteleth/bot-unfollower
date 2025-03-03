import { NextRequest, NextResponse } from 'next/server';
import { getUserModeration } from '@/lib/mbd';

/**
 * GET handler for user moderation API
 * @param request Request object
 * @returns Moderation data for the specified FID
 */
export async function GET(request: NextRequest) {
  // Get FID from query parameters
  const url = new URL(request.url);
  const fid = url.searchParams.get('fid');
  
  if (!fid) {
    return NextResponse.json(
      { error: 'Missing FID parameter' },
      { status: 400 }
    );
  }

  try {
    // Call getUserModeration with the FID
    const userModerationResults = await getUserModeration([fid]);
    
    if (!userModerationResults[fid]) {
      return NextResponse.json(
        { 
          message: `No moderation data found for FID ${fid}`,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Return the moderation data
    return NextResponse.json({
      fid,
      timestamp: new Date().toISOString(),
      moderationData: userModerationResults[fid],
      // Include some helpful response metadata
      meta: {
        api: 'MBD User Moderation API',
        endpoint: '/v2/farcaster/users/labels/for-users',
        documentation: 'https://docs.mbd.xyz'
      }
    });
  } catch (error) {
    console.error('Error getting user moderation:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 