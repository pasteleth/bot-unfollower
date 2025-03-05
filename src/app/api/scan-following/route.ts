import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { fetchAllFollowing } from '@/lib/farcaster';

/**
 * Scan a user's following list for potentially problematic accounts
 * 
 * @param request The HTTP request containing the FID to scan
 * @returns List of flagged accounts the user follows
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Parse the FID from the URL
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    
    if (!fidParam) {
      return Response.json({ error: 'Missing FID parameter' }, { status: 400 });
    }
    
    // Convert to number
    const fid = parseInt(fidParam, 10);
    if (isNaN(fid)) {
      return Response.json({ error: 'Invalid FID format' }, { status: 400 });
    }
    
    // Fetch the user's following list
    console.log("Fetching following list for FID:", fid);
    console.log("Using fetchAllFollowing to get complete following list");
    const followingList = await fetchAllFollowing(fid);
    
    if (!followingList || followingList.length === 0) {
      return Response.json({ 
        flaggedCount: 0,
        message: "We couldn't find any accounts you're following",
        followingCount: 0
      });
    }
    
    // Extract user IDs from the following list
    const userIds = followingList.map(user => {
      if (user && typeof user.fid === 'number') {
        return String(user.fid);
      }
      return '';
    }).filter(id => id !== '');
    
    console.log(`Found ${userIds.length} valid user IDs for moderation check`);
    
    if (userIds.length === 0) {
      return Response.json({ 
        flaggedCount: 0,
        message: "We couldn't find any valid accounts you're following",
        followingCount: 0
      });
    }
    
    // Check following list against moderation flags
    const moderationResults = await getModerationFlags(userIds);
    
    // Count flagged accounts
    let flaggedCount = 0;
    const flaggedUsers = [];
    
    for (const userId in moderationResults) {
      const userResult = moderationResults[userId];
      
      // Skip users with no data
      if (!userResult || !userResult.flags) continue;
      
      // Check if any flag is true
      if (userResult.flags.isFlagged) {
        flaggedCount++;
        flaggedUsers.push({
          id: userId,
          scores: userResult.scores
        });
      }
    }
    
    console.log(`Found ${flaggedCount} flagged accounts`);
    
    // Return the scan results
    return Response.json({
      flaggedCount,
      followingCount: userIds.length,
      message: flaggedCount > 0 
        ? `We found ${flaggedCount} potentially problematic account${flaggedCount === 1 ? '' : 's'} in your following list`
        : "Good news! We didn't find any potentially problematic accounts in your following list",
      flaggedUsers: flaggedUsers
    });
    
  } catch (error) {
    console.error("Error during scanning:", error);
    return Response.json({ 
      error: "Error scanning your following list: " + (error instanceof Error ? error.message : "Unknown error") 
    }, { status: 500 });
  }
} 