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
    
    // Log the outgoing request parameters in detail
    console.log(`[getFollowing] Using fetchUserFollowing to get user following list`);
    
    // Log the exact request details
    const requestTime = new Date().toISOString();
    console.log(`[NEYNAR-REQUEST][${requestTime}] Sending request to Neynar API: fetchUserFollowing(fid: ${fidAsInt}, limit: 100, cursor: ${cursor || 'null'})`);
    
    let startTime = Date.now();
    try {
      const response = await neynarClient.fetchUserFollowing({
        fid: fidAsInt,
        limit: 100,
        cursor: cursor || undefined
      });
      
      let endTime = Date.now();
      const responseTime = new Date().toISOString();
      console.log(`[NEYNAR-RESPONSE][${responseTime}] Successfully received response from Neynar API after ${endTime - startTime}ms`);
      
      // Log full details of the API response summary
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
    } catch (apiError) {
      let endTime = Date.now();
      const errorTime = new Date().toISOString();
      console.error(`[NEYNAR-ERROR][${errorTime}] Neynar API request failed after ${endTime - startTime}ms`);
      
      if (apiError && typeof apiError === 'object') {
        // Full error logging to see all properties
        console.error('[NEYNAR-ERROR-DETAILS] Full error object:', JSON.stringify(apiError, null, 2));
        
        // Try to extract the status code
        const statusCode = (apiError as any).response?.status || (apiError as any).status || 'unknown';
        console.error(`[NEYNAR-ERROR-STATUS] Status code: ${statusCode}`);
        
        // Log the request details for correlation
        console.error(`[NEYNAR-ERROR-REQUEST] Failed request parameters: fid=${fidAsInt}, cursor=${cursor || 'null'}`);
      }
      
      throw apiError;
    }
  } catch (error: unknown) {
    // If the error is due to rate limit, log detailed info and return an empty result with the same cursor
    if ((error as any).response && (error as any).response.status === 429) {
      console.warn('[getFollowing][RATE LIMIT] 429 encountered. Request parameters: ', { fid, cursor });
      console.warn('[getFollowing] Rate limit encountered. Returning empty result and preserving cursor for later retry.');
      
      // Log rate limit headers if available
      const rateHeaders = (error as any).response?.headers || {};
      const resetTime = rateHeaders['x-ratelimit-reset'] || 'unknown';
      const remaining = rateHeaders['x-ratelimit-remaining'] || 'unknown';
      console.warn(`[NEYNAR-RATE-LIMIT] Rate limit information - Reset time: ${resetTime}, Remaining: ${remaining}`);
      
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

/**
 * Fetch all accounts that a Farcaster user follows by handling pagination
 * @param fid The Farcaster ID to look up
 * @returns Complete array of all following accounts
 */
export async function fetchAllFollowing(fid: number): Promise<Following[]> {
  console.log(`[fetchAllFollowing] Starting to fetch all following for FID: ${fid}`);
  let allFollowing: Following[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  
  try {
    do {
      pageCount++;
      console.log(`[fetchAllFollowing] Fetching page ${pageCount} with cursor: ${cursor || 'initial'}`);
      const response = await getFollowing(fid, cursor);
      
      if (response.users && response.users.length > 0) {
        allFollowing = allFollowing.concat(response.users);
        console.log(`[fetchAllFollowing] Added ${response.users.length} users, total so far: ${allFollowing.length}`);
      } else {
        console.log(`[fetchAllFollowing] No users returned on page ${pageCount}, possibly due to rate limiting`);
      }
      
      cursor = response.nextCursor || null;
    } while (cursor);
    
    console.log(`[fetchAllFollowing] Completed fetching all following. Total: ${allFollowing.length} users across ${pageCount} pages`);
    return allFollowing;
  } catch (error) {
    console.error(`[fetchAllFollowing] Error fetching all following:`, error);
    throw error;
  }
} 