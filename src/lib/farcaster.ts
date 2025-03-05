import { Following } from '../types/farcaster';
import neynarClient from './neynar-client';
import { FeedType } from '@neynar/nodejs-sdk/build/api';

// Define the Neynar user type
export type NeynarUser = {
  fid: number;
  username?: string;
  display_name?: string;
  displayName?: string;  // Allowing both snake_case and camelCase
  pfp?: {
    url?: string;
  };
  profile?: {
    username?: string;
    displayName?: string;
  };
  pfp_url?: string;
};

/**
 * Get the list of accounts that a Farcaster user follows
 * @param fid The Farcaster ID to look up
 * @param cursor Optional cursor for pagination
 * @returns Array of following accounts and next cursor
 */
export async function getFollowing(fid: number, cursor?: string | null): Promise<{ users: Following[]; nextCursor?: string | null }> {
  // Check if we have a Neynar API key
  const apiKey = process.env.NEYNAR_API_KEY;
  console.log(`[getFollowing] Using Neynar API key: ${apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'undefined'}`);
  
  if (!apiKey) {
    console.error('[getFollowing] No Neynar API key provided');
    throw new Error("No Neynar API key provided. Add your API key to .env.local file.");
  }
  
  try {
    console.log(`[getFollowing] Fetching following for FID: ${fid}`);
    
    // Validate FID
    if (typeof fid !== 'number' || isNaN(fid) || fid <= 0) {
      console.error(`[getFollowing] Invalid FID: ${fid}. FID must be a positive number.`);
      throw new Error(`Invalid FID: ${fid}. FID must be a positive number.`);
    }
    
    // Ensure integer
    const fidAsInt = Math.floor(fid);
    console.log(`[getFollowing] Using integer FID: ${fidAsInt}`);
    
    // Use the direct following endpoint without retry logic
    console.log('[getFollowing] Using fetchUserFollowing to get user following list');
    
    const response = await neynarClient.fetchUserFollowing({
      fid: fidAsInt,
      limit: 100,
      cursor: cursor || undefined
    });
    
    console.log(`[getFollowing] API request succeeded with ${response?.users?.length || 0} follow objects`);
    
    if (response && response.users && response.users.length > 0) {
      const followedUsers = response.users
        .filter(followObj => followObj.user)
        .map(followObj => followObj.user);
      
      console.log(`[getFollowing] Extracted ${followedUsers.length} user objects`);
      
      const result = followedUsers.map((user: any) => {
        return {
          fid: user.fid,
          username: user.username || `fid:${user.fid}`,
          display_name: user.display_name || `User ${user.fid}`,
          pfp_url: user.pfp_url || '',
          bio: user.profile?.bio?.text || '',
        };
      });
      
      console.log(`[getFollowing] Returning ${result.length} following accounts`);
      return {
        users: result,
        nextCursor: response.next?.cursor || null,
      };
    } else {
      console.warn('[getFollowing] No following users found in Neynar API response');
      return { users: [] };
    }
  } catch (error: unknown) {
    // If the error is due to rate limit, return an empty result with the same cursor so that calling code can resume later
    if ((error as any).response && (error as any).response.status === 429) {
      console.warn('[getFollowing] Rate limit encountered. Returning empty result and preserving cursor for later retry.');
      return { users: [], nextCursor: cursor || null };
    }
    console.error('[getFollowing] Error fetching following from Neynar:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('[getFollowing] Error stack:', error.stack);
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Unstructured error object';
      }
    }
    throw new Error(`Error fetching following list: ${errorMessage}`);
  }
} 