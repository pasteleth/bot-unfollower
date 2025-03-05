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
 * @returns Array of following accounts
 */
export async function getFollowing(fid: number): Promise<Following[]> {
  // Check if we have a Neynar API key
  const apiKey = process.env.NEYNAR_API_KEY;
  console.log(`[getFollowing] Using Neynar API key: ${apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'undefined'}`);
  
  if (!apiKey) {
    console.error('[getFollowing] No Neynar API key provided');
    throw new Error("No Neynar API key provided. Add your API key to .env.local file.");
  }

  let attempt = 0;
  let startTime = Date.now();
  
  while (true) { // Keep trying indefinitely
    try {
      attempt++;
      console.log(`[getFollowing] Fetching following for FID: ${fid} (Attempt ${attempt})`);
      
      // Validate FID
      if (typeof fid !== 'number' || isNaN(fid) || fid <= 0) {
        console.error(`[getFollowing] Invalid FID: ${fid}. FID must be a positive number.`);
        throw new Error(`Invalid FID: ${fid}. FID must be a positive number.`);
      }
      
      // Ensure integer
      const fidAsInt = Math.floor(fid);
      
      // Build URL - no pagination, just get what we can
      const url = `https://api.neynar.com/v2/farcaster/following?fid=${fidAsInt}&limit=100&sort_type=desc_chron`;
      
      console.log(`[getFollowing] Using v2 API endpoint: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey,
          'x-neynar-experimental': 'false'
        }
      });
      
      const responseTime = new Date().toISOString();
      console.log(`NEYNAR_API_RESPONSE [${responseTime}] Status: ${response.status} after ${Date.now() - startTime}ms`);

      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      // Simple rate limit check
      if ((data as NeynarErrorResponse).code === 'rate_limit') {
        console.warn(`Rate limit hit on attempt ${attempt}, waiting 1s before retry`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Handle other errors
      if (!response.ok) {
        const errorData = data as NeynarErrorResponse;
        console.error(`API error:`, errorData);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      if (data && data.users && data.users.length > 0) {
        const followedUsers = data.users
          .filter((followObj: NeynarV2Follow) => followObj.user)
          .map((followObj: NeynarV2Follow) => followObj.user)
          .map((user: NeynarV2User) => ({
            fid: user.fid,
            username: user.username || `fid:${user.fid}`,
            display_name: user.display_name || `User ${user.fid}`,
            pfp_url: user.pfp_url || '',
            bio: user.profile?.bio?.text || '',
          }));
        
        console.log(`[getFollowing] Returning ${followedUsers.length} following accounts`);
        return followedUsers;
      } else {
        console.warn('[getFollowing] No following users found');
        return [];
      }
    } catch (error) {
      console.error(`API error after ${Date.now() - startTime}ms (attempt ${attempt}):`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
  }
}

// Remove fetchAllFollowing since we're not paginating anymore 