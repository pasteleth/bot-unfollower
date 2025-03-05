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

// Define the Neynar v2 API response types
type NeynarV2User = {
  object: 'user';
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  profile?: {
    bio?: {
      text?: string;
    };
  };
};

type NeynarV2Follow = {
  object: 'follow';
  user: NeynarV2User;
};

type NeynarV2Response = {
  users: NeynarV2Follow[];
  next?: {
    cursor: string;
  };
};

// Define Neynar error response type
type NeynarErrorResponse = {
  code: string;
  message: string;
  property?: string;
  status: number;
  retry_after?: number;  // Add retry_after field for rate limit responses
};

// Add rate limit tracking
const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 300, // Starter plan limit
  REQUESTS_PER_SECOND: 5,   // Starter plan limit
};

// Track requests within the minute window
let requestsInLastMinute = 0;
let lastMinuteTimestamp = Date.now();

// Track requests within the second window
let requestsInLastSecond = 0;
let lastSecondTimestamp = Date.now();

// Track rate limit info from headers
let globalRateLimitRemaining: number | null = null;
let globalRateLimitReset: number | null = null;
let globalRateLimitLimit: number | null = null;

/**
 * Parse rate limit headers from Neynar API response
 * @param headers Response headers from Neynar API
 */
function parseRateLimitHeaders(headers: Headers): void {
  // Check both x-ratelimit-* and x-rate-limit-* formats since docs aren't clear
  const remaining = headers.get('x-ratelimit-remaining') || headers.get('x-rate-limit-remaining');
  const reset = headers.get('x-ratelimit-reset') || headers.get('x-rate-limit-reset');
  const limit = headers.get('x-ratelimit-limit') || headers.get('x-rate-limit-limit');

  if (remaining) {
    globalRateLimitRemaining = parseInt(remaining);
  }
  if (reset) {
    globalRateLimitReset = parseInt(reset) * 1000; // Convert to milliseconds
  }
  if (limit) {
    globalRateLimitLimit = parseInt(limit);
  }

  // Log rate limit info if any headers were present
  if (limit || remaining || reset) {
    console.log('NEYNAR_RATE_LIMIT_HEADERS', {
      limit: globalRateLimitLimit,
      remaining: globalRateLimitRemaining,
      resetAt: globalRateLimitReset ? new Date(globalRateLimitReset).toISOString() : null,
      resetIn: globalRateLimitReset ? `${Math.round((globalRateLimitReset - Date.now()) / 1000)}s` : null
    });
  }
}

/**
 * Check if we should wait based on rate limit headers
 * @returns {Promise<void>}
 */
async function checkRateLimitHeaders(): Promise<void> {
  const now = Date.now();
  
  // If we have header info and are close to limit
  if (globalRateLimitRemaining !== null && globalRateLimitRemaining < 5) {
    console.warn(`NEYNAR_RATE_LIMIT_PREVENTION Header indicates only ${globalRateLimitRemaining} requests remaining`);
    
    // If we have a reset time and it's in the future
    if (globalRateLimitReset && globalRateLimitReset > now) {
      const waitTime = globalRateLimitReset - now;
      console.log(`NEYNAR_RATE_LIMIT_WAIT Waiting ${Math.round(waitTime/1000)}s for rate limit window to reset`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // Reset our tracking after waiting
      globalRateLimitRemaining = null;
      globalRateLimitReset = null;
    }
  }
}

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
  const DEFAULT_RATE_LIMIT_WINDOW = 60000; // Default to 1 minute if no retry_after provided
  let attempt = 0;
  let startTime = Date.now();
  let lastRequestTime = 0;
  
  while (true) { // Keep trying indefinitely
    try {
      // Reset minute counter if we're in a new minute
      const now = Date.now();
      if (now - lastMinuteTimestamp >= 60000) {
        requestsInLastMinute = 0;
        lastMinuteTimestamp = now;
        console.log(`NEYNAR_RATE_LIMIT_RESET Resetting minute counter. Attempting to continue fetching from cursor: ${cursor || 'initial'}`);
      }

      // Reset second counter if we're in a new second
      if (now - lastSecondTimestamp >= 1000) {
        requestsInLastSecond = 0;
        lastSecondTimestamp = now;
      }

      // Check if we're at the rate limits
      if (requestsInLastMinute >= RATE_LIMITS.REQUESTS_PER_MINUTE) {
        const waitTime = 60000 - (now - lastMinuteTimestamp);
        console.warn(`NEYNAR_RATE_LIMIT_PREVENTION Waiting ${Math.round(waitTime/1000)}s for minute window to reset (${requestsInLastMinute} requests in last minute). Will resume from cursor: ${cursor || 'initial'}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Don't continue here, let the loop naturally retry with the same cursor
        requestsInLastMinute = 0;
        lastMinuteTimestamp = Date.now();
      }

      if (requestsInLastSecond >= RATE_LIMITS.REQUESTS_PER_SECOND) {
        const waitTime = 1000 - (now - lastSecondTimestamp);
        console.warn(`NEYNAR_RATE_LIMIT_PREVENTION Waiting ${waitTime}ms for second window to reset (${requestsInLastSecond} requests in last second)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        requestsInLastSecond = 0;
        lastSecondTimestamp = Date.now();
      }

      // Increment counters before making request
      requestsInLastMinute++;
      requestsInLastSecond++;

      // Ensure we're not exceeding RPS limit
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest));
      }
      
      attempt++;
      console.log(`[getFollowing] Fetching following for FID: ${fid} (Attempt ${attempt})`);
      
      // Validate FID
      if (typeof fid !== 'number' || isNaN(fid) || fid <= 0) {
        console.error(`[getFollowing] Invalid FID: ${fid}. FID must be a positive number.`);
        throw new Error(`Invalid FID: ${fid}. FID must be a positive number.`);
      }
      
      // Ensure integer
      const fidAsInt = Math.floor(fid);
      console.log(`[getFollowing] Using integer FID: ${fidAsInt}`);
      
      // Build URL with cursor if available
      let url = `https://api.neynar.com/v2/farcaster/following?fid=${fidAsInt}&limit=100`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      // Log the outgoing request parameters in detail
      console.log(`[getFollowing] Using v2 API endpoint: ${url}`);
      
      // Log the exact request details
      const requestTime = new Date().toISOString();
      console.log(`NEYNAR_API_REQUEST [${requestTime}] Sending request to Neynar API v2: ${url}`);
      
      // Check rate limit headers before proceeding
      await checkRateLimitHeaders();
      
      lastRequestTime = Date.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey
        }
      });
      
      let endTime = Date.now();
      const responseTime = new Date().toISOString();
      console.log(`NEYNAR_API_RESPONSE [${responseTime}] Status: ${response.status} after ${endTime - startTime}ms`);

      // Parse rate limit headers
      parseRateLimitHeaders(response.headers);

      // Check if we're close to rate limit based on headers
      if (globalRateLimitRemaining !== null && globalRateLimitRemaining <= 5) {
        console.warn(`NEYNAR_RATE_LIMIT_WARNING: Only ${globalRateLimitRemaining.toString()} requests remaining`);
      }
      
      const responseText = await response.text();
      console.log('Raw response:', responseText); // Log raw response for debugging
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      // Log full response data for debugging
      console.log('Full response data:', JSON.stringify(data, null, 2));

      // Enhanced rate limit detection
      const isRateLimit = (
        // Check status codes commonly used for rate limiting
        (response.status === 400 || response.status === 429 || response.status === 403) &&
        (
          // Check error code
          (data as NeynarErrorResponse).code === 'rate_limit' ||
          // Check error message
          (data as NeynarErrorResponse).message?.toLowerCase().includes('rate limit') ||
          (data as NeynarErrorResponse).message?.toLowerCase().includes('too many requests') ||
          // Check if we're out of requests based on headers
          globalRateLimitRemaining === 0
        )
      ) || (
        // Also consider it a rate limit if we have a reset time and no remaining requests
        globalRateLimitReset !== null && globalRateLimitRemaining === 0
      );

      if (isRateLimit) {
        const errorData = data as NeynarErrorResponse;
        console.warn(`NEYNAR_RATE_LIMIT_HIT [${new Date().toISOString()}] Rate limit detected on attempt ${attempt}. Current cursor: ${cursor || 'initial'}`);
        console.warn('Rate limit response:', {
          code: errorData.code,
          message: errorData.message,
          status: errorData.status,
          retry_after: errorData.retry_after,
          headers: {
            remaining: globalRateLimitRemaining,
            reset: globalRateLimitReset,
            limit: globalRateLimitLimit
          }
        });
        
        // Calculate wait time based on multiple sources
        let waitTime = DEFAULT_RATE_LIMIT_WINDOW;
        
        // Try to get wait time from headers first
        if (globalRateLimitReset) {
          const now = Date.now();
          waitTime = Math.max(globalRateLimitReset - now, 1000); // At least 1 second
        }
        // Fall back to retry_after from response body if available
        else if (errorData.retry_after) {
          waitTime = errorData.retry_after * 1000;
        }

        console.log(`NEYNAR_RATE_LIMIT_RETRY Waiting ${Math.round(waitTime/1000)}s before retry (attempt ${attempt}). Will resume from cursor: ${cursor || 'initial'}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Reset our counters after waiting
        requestsInLastMinute = 0;
        lastMinuteTimestamp = Date.now();
        requestsInLastSecond = 0;
        lastSecondTimestamp = Date.now();
        continue; // Retry with the same cursor
      }
      
      // Handle other errors
      if (!response.ok) {
        const errorData = data as NeynarErrorResponse;
        console.error(`API error response:`, {
          code: errorData.code,
          message: errorData.message,
          status: errorData.status,
          property: errorData.property
        });

        // If it's any kind of error response, wait a bit before retrying
        const waitTime = 1000; // Wait 1 second before retrying on errors
        console.log(`API error, waiting ${waitTime}ms before retry. Will resume from cursor: ${cursor || 'initial'}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // Log full details of the API response summary
      console.log(`[getFollowing] API request succeeded with ${data?.users?.length || 0} follow objects`);
      
      if (data && data.users && data.users.length > 0) {
        const followedUsers = data.users
          .filter((followObj: NeynarV2Follow) => followObj.user)
          .map((followObj: NeynarV2Follow) => followObj.user);
        
        console.log(`[getFollowing] Extracted ${followedUsers.length} user objects`);
        
        const result = followedUsers.map((user: NeynarV2User) => {
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
          nextCursor: data.next?.cursor || null,
        };
      } else {
        console.warn('[getFollowing] No following users found in Neynar API response');
        return { users: [] };
      }
    } catch (error) {
      let endTime = Date.now();
      const errorTime = new Date().toISOString();
      console.error(`NEYNAR_API_ERROR [${errorTime}] Neynar API request failed after ${endTime - startTime}ms (attempt ${attempt}, cursor: ${cursor || 'initial'}):`, error);
      
      // Any error, wait a second before retrying
      const waitTime = 1000;
      console.log(`Error occurred, waiting ${waitTime}ms before retry. Will resume from cursor: ${cursor || 'initial'}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
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
          console.warn(`[fetchAllFollowing] Page ${pageCount} returned no users but has cursor: ${cursor}. Will continue to next page.`);
        }
      }
      
      cursor = response.nextCursor || null;
      
      // Remove the fixed delay every 5 pages since we're already handling rate limits in getFollowing
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