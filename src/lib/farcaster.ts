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

// Define the Warpcast API response types
type WarpcastUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: {
    url?: string;
  };
  profile?: {
    bio?: {
      text?: string;
    };
  };
};

type WarpcastResponse = {
  result?: {
    users: WarpcastUser[];
  };
  next?: {
    cursor?: string;
  };
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

  const MIN_DELAY_BETWEEN_REQUESTS = 200; // Ensure we don't exceed 5 RPS
  const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds
  let attempt = 0;
  let startTime = Date.now();
  let lastRequestTime = 0;
  
  while (true) { // Keep trying indefinitely
    try {
      // Ensure we're not exceeding RPS limit
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest));
      }
      
      console.log(`[getFollowing] Fetching following for FID: ${fid} (Attempt ${attempt + 1})`);
      
      // Validate FID
      if (typeof fid !== 'number' || isNaN(fid) || fid <= 0) {
        console.error(`[getFollowing] Invalid FID: ${fid}. FID must be a positive number.`);
        throw new Error(`Invalid FID: ${fid}. FID must be a positive number.`);
      }
      
      // Ensure integer
      const fidAsInt = Math.floor(fid);
      console.log(`[getFollowing] Using integer FID: ${fidAsInt}`);
      
      // Build URL with cursor if available
      let url = `https://api.warpcast.com/v2/following?fid=${fidAsInt}&limit=100`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      // Log the exact request details
      const requestTime = new Date().toISOString();
      console.log(`WARPCAST_API_REQUEST [${requestTime}] Sending request to: ${url}`);
      
      lastRequestTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      let endTime = Date.now();
      const responseTime = new Date().toISOString();
      
      // Check for rate limit response
      if (response.status === 429) {
        attempt++;
        console.warn(`WARPCAST_RATE_LIMIT_HIT [${new Date().toISOString()}] 429 encountered on attempt ${attempt}. Request parameters: fid=${fid} cursor=${cursor || 'null'}`);
        
        // Get rate limit headers
        const resetTime = response.headers.get('x-ratelimit-reset');
        const remaining = response.headers.get('x-ratelimit-remaining');
        console.warn(`WARPCAST_RATE_LIMIT_HEADERS Reset time: ${resetTime}, Remaining: ${remaining}`);
        
        // Calculate wait time
        let waitTime = RATE_LIMIT_WINDOW;
        if (resetTime) {
          const resetTimeMs = new Date(resetTime).getTime();
          const now = Date.now();
          if (resetTimeMs > now) {
            waitTime = resetTimeMs - now;
          }
        }
        
        console.log(`WARPCAST_RATE_LIMIT_RETRY Waiting ${waitTime}ms for rate limit window to reset`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue; // Retry the request
      }
      
      // Handle other error responses
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json() as WarpcastResponse;
      console.log(`WARPCAST_API_RESPONSE [${responseTime}] Successfully received response after ${endTime - startTime}ms`);
      
      if (!data.result?.users) {
        console.error('Unexpected API response:', data);
        throw new Error('Unexpected API response format');
      }
      
      const users = data.result.users;
      console.log(`[getFollowing] API request succeeded with ${users.length} follow objects`);
      
      // Map users to our format
      const mappedUsers = users.map((user: WarpcastUser) => ({
        fid: user.fid,
        username: user.username || `fid:${user.fid}`,
        display_name: user.displayName || `User ${user.fid}`,
        pfp_url: user.pfp?.url || '',
        bio: user.profile?.bio?.text || '',
      }));
      
      console.log(`[getFollowing] Returning ${mappedUsers.length} following accounts`);
      return {
        users: mappedUsers,
        nextCursor: data.next?.cursor || null,
      };
    } catch (error) {
      let endTime = Date.now();
      const errorTime = new Date().toISOString();
      console.error(`WARPCAST_API_ERROR [${errorTime}] API request failed after ${endTime - startTime}ms:`, error);
      
      // If it's not a rate limit error (which we handle above), throw
      throw new Error(`Error fetching following list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
  let totalPages = 0; // We'll estimate this after first request
  const startTime = Date.now();
  
  try {
    do {
      pageCount++;
      console.log(`[fetchAllFollowing] Fetching page ${pageCount}${totalPages ? ` of ~${totalPages}` : ''} with cursor: ${cursor || 'initial'}`);
      const response = await getFollowing(fid, cursor);
      
      if (response.users && response.users.length > 0) {
        allFollowing = allFollowing.concat(response.users);
        
        // After first page, estimate total pages
        if (pageCount === 1) {
          // Each page has 100 users, so estimate total pages needed
          totalPages = Math.ceil(response.users.length * 7); // Assuming ~700 following based on your number
        }
        
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        console.log(`[fetchAllFollowing] Progress: ${allFollowing.length} users fetched in ${elapsedSeconds}s (Page ${pageCount}${totalPages ? ` of ~${totalPages}` : ''})`);
      } else {
        if (pageCount === 1) {
          console.warn(`[fetchAllFollowing] First page returned no users. User might not be following anyone.`);
          break; // Only break on first page with no results - that means they follow no one
        } else {
          console.warn(`[fetchAllFollowing] Page ${pageCount} returned no users but has cursor: ${cursor}. This might be due to rate limiting, will continue...`);
        }
      }
      
      cursor = response.nextCursor || null;
      
      // If we have more pages but we're close to rate limit, add a small delay
      if (cursor && pageCount % 5 === 0) { // Every 5 pages
        const delay = 1000; // 1 second pause every 5 pages to help avoid rate limits
        console.log(`[fetchAllFollowing] Added ${delay}ms delay after ${pageCount} pages to help avoid rate limits`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } while (cursor);
    
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[fetchAllFollowing] Completed fetching all following. Total: ${allFollowing.length} users across ${pageCount} pages in ${totalTime}s`);
    return allFollowing;
  } catch (error) {
    const errorTime = Math.round((Date.now() - startTime) / 1000);
    console.error(`[fetchAllFollowing] Error fetching all following after ${errorTime}s (${pageCount} pages, ${allFollowing.length} users):`, error);
    throw error;
  }
} 