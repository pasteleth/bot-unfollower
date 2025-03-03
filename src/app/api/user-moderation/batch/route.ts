import { NextRequest, NextResponse } from 'next/server';
import { getUserModeration } from '@/lib/mbd';

/**
 * POST handler for batch user moderation API
 * @param request Request with array of FIDs in the body
 * @returns Moderation data for all specified FIDs
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Validate the request body
    if (!body.fids || !Array.isArray(body.fids) || body.fids.length === 0) {
      return NextResponse.json(
        { error: 'Request body must include a non-empty "fids" array' },
        { status: 400 }
      );
    }
    
    // Extract FIDs and validate them
    const fids = body.fids.map((fid: string | number) => String(fid));
    
    // If more than 50 FIDs are requested, limit to 50 to prevent abuse
    const maxFids = 50;
    if (fids.length > maxFids) {
      return NextResponse.json(
        { error: `Too many FIDs requested. Maximum is ${maxFids}.` },
        { status: 400 }
      );
    }
    
    console.log(`Processing batch moderation request for ${fids.length} FIDs`);
    
    // Call getUserModeration with all FIDs
    const skipCache = body.skipCache === true;
    const userModerationResults = await getUserModeration(fids, skipCache);
    
    // Return the moderation data
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      count: Object.keys(userModerationResults).length,
      results: userModerationResults,
      meta: {
        api: 'MBD User Moderation API (Batch)',
        endpoint: '/v2/farcaster/users/labels/for-users',
        documentation: 'https://docs.mbd.xyz',
        requestedFids: fids.length,
        cacheUsed: !skipCache
      }
    });
  } catch (error) {
    console.error('Error processing batch moderation request:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 