import { NextRequest, NextResponse } from 'next/server';
import { getFollowing } from '../../../lib/farcaster';

export async function GET(request: NextRequest) {
  try {
    // Get the FID from the query string
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    
    if (!fid || isNaN(Number(fid))) {
      return NextResponse.json({ error: 'Invalid or missing FID parameter' }, { status: 400 });
    }
    
    // Fetch the following data from the Farcaster API
    console.log(`[/api/followers] Fetching following for FID: ${fid}`);
    const following = await getFollowing(Number(fid));
    
    return NextResponse.json({ users: following });
  } catch (error) {
    console.error('Error in /api/followers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error getting followers data' },
      { status: 500 }
    );
  }
} 