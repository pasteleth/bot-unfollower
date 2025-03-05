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
    
    // Use the direct following endpoint
    console.log('[getFollowing] Using fetchUserFollowing to get user following list');
    
    try {
      const response = await neynarClient.fetchUserFollowing({
        fid: fidAsInt,
        limit: 100,
        cursor: cursor || undefined
      });
      
      // Log a summary of the response for debugging
      console.log(`[getFollowing] API request succeeded with ${response?.users?.length || 0} follow objects`);
      
      if (response && response.users && response.users.length > 0) {
        // Extract user objects from the follow objects
        const followedUsers = response.users
          .filter(followObj => followObj.user)
          .map(followObj => followObj.user);
          
        console.log(`[getFollowing] Extracted ${followedUsers.length} user objects`);
        
        // Map the API response to our Following type
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
    } catch (apiError: unknown) {
      console.error('[getFollowing] API request failed:', apiError);
      
      // Log detailed API error information if available
      interface ApiErrorWithResponse {
        response?: {
          status?: number;
          data?: any;
        }
      }
      
      const typedError = apiError as ApiErrorWithResponse;
      
      if (typedError.response) {
        console.error('[getFollowing] API error status:', typedError.response.status);
        console.error('[getFollowing] API error data:', JSON.stringify(typedError.response.data));
      }
      
      throw apiError;
    }
  } catch (error: unknown) {
    console.error('[getFollowing] Error fetching following from Neynar:', error);
    
    // Create a more detailed error message
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('[getFollowing] Error stack:', error.stack);
    } else if (typeof error === 'object' && error !== null) {
      // Handle possible API error response structure
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Unstructured error object';
      }
    }
    
    throw new Error(`Error fetching following list: ${errorMessage}`);
  }
} 