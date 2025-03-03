import { NextRequest, NextResponse } from 'next/server';
import { getFollowing } from '@/lib/farcaster';
import { getModerationFlags } from '@/lib/moderation';

/**
 * Scan a user's following list for potentially problematic accounts
 * 
 * @param request The HTTP request containing the FID to scan
 * @returns List of flagged accounts the user follows
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
    // Get the list of accounts the user follows
    console.log(`Getting following list for FID ${fid}...`);
    const followingList = await getFollowing(parseInt(fid, 10));
    
    if (!followingList || followingList.length === 0) {
      return NextResponse.json({
        fid,
        timestamp: new Date().toISOString(),
        message: 'User is not following any accounts',
        followingCount: 0,
        flaggedAccounts: []
      });
    }
    
    console.log(`User follows ${followingList.length} accounts. Checking for moderation flags...`);
    
    // Extract FIDs from the following list
    const followingFids = followingList.map(user => user.fid?.toString()).filter(Boolean);
    
    // Check moderation flags for all following accounts
    const moderationResults = await getModerationFlags(followingFids);
    
    // Filter for flagged accounts only
    const flaggedAccounts = Object.values(moderationResults)
      .filter(result => result.flags.isFlagged)
      .map(result => {
        // Find the original user data from the following list
        const userData = followingList.find(user => user.fid?.toString() === result.userId);
        
        return {
          fid: result.userId,
          username: userData?.username || `fid:${result.userId}`,
          displayName: userData?.display_name || `User ${result.userId}`,
          pfpUrl: userData?.pfp_url || '',
          flags: result.flags,
          scores: result.scores
        };
      });
    
    // Return the results
    return NextResponse.json({
      fid,
      timestamp: new Date().toISOString(),
      followingCount: followingList.length,
      flaggedCount: flaggedAccounts.length,
      flaggedAccounts,
      meta: {
        api: 'MBD User Moderation API',
        description: 'Scan of accounts the user follows for moderation issues'
      }
    });
    
  } catch (error) {
    console.error('Error scanning following list:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 