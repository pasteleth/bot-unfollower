import { Following } from '../types/farcaster';
import neynarClient from './neynar-client';

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
 * @returns Array of following accounts
 */
export async function getFollowing(fid: number): Promise<Following[]> {
  // Check if we have a Neynar API key
  const apiKey = process.env.NEYNAR_API_KEY;
  console.log(`Using Neynar API key: ${apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'undefined'}`);
  
  if (!apiKey) {
    console.error('No Neynar API key provided');
    throw new Error("No Neynar API key provided. Add your API key to .env.local file.");
  }
  
  try {
    console.log(`Fetching following for FID: ${fid}`);
    
    // Validate FID
    if (typeof fid !== 'number' || isNaN(fid) || fid <= 0) {
      throw new Error(`Invalid FID: ${fid}. FID must be a positive number.`);
    }
    
    // Ensure integer
    const fidAsInt = Math.floor(fid);
    
    // Use the Neynar SDK to fetch following
    const response = await neynarClient.fetchUserFollowing({
      fid: fidAsInt,
      limit: 100
    });
    
    // Process the response data
    const users = response?.users || [];
    
    if (users.length === 0) {
      console.warn('No following users found in Neynar API response');
      return [];
    }
    
    // Map the API response to our Following type
    return users.map((user: any) => ({
      fid: user.fid,
      username: user.username || `fid:${user.fid}`,
      display_name: user.display_name || `User ${user.fid}`,
      pfp_url: user.pfp_url || '',
      bio: '',
    }));
  } catch (error) {
    console.error('Error fetching following from Neynar:', error);
    
    // Create a more detailed error message
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
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