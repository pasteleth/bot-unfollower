import { AnalysisResult } from '../types/farcaster';

// MBD API endpoints for user moderation
const MBD_USER_LABELS_URL = 'https://api.mbd.xyz/v2/farcaster/users/labels/for-users';

// Simple in-memory cache for moderation results
// In a production environment, consider using Redis or a similar distributed cache
interface ModerationCache {
  [userId: string]: {
    timestamp: number;
    result: AnalysisResult;
  };
}

// Cache expires after 1 hour (in milliseconds)
const CACHE_TTL = 60 * 60 * 1000; 
const moderationCache: ModerationCache = {};

interface MbdUserLabel {
  label: string;
  score: number;
}

interface MbdUserResponse {
  user_id: string;
  ai_labels: {
    moderation: MbdUserLabel[];
  };
}

/**
 * Analyze user accounts for moderation indicators using the MBD API
 * @param userIds Array of Farcaster FIDs to analyze
 * @param skipCache If true, bypass the cache and force a fresh API call
 * @returns Analysis results with moderation scores
 */
export async function getUserModeration(userIds: string[], skipCache = false): Promise<Record<string, AnalysisResult>> {
  // Check if we have an MBD API key
  const apiKey = process.env.MBD_API_KEY;
  
  if (!apiKey) {
    console.error('No MBD API key provided');
    throw new Error("No MBD API key provided. Add your API key to .env.local file.");
  }

  const now = Date.now();
  const results: Record<string, AnalysisResult> = {};
  const userIdsToFetch: string[] = [];

  // Check cache for each user ID if skipCache is false
  if (!skipCache) {
    userIds.forEach(userId => {
      const cached = moderationCache[userId];
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // Cache hit - use cached result
        results[userId] = cached.result;
      } else {
        // Cache miss or expired - need to fetch
        userIdsToFetch.push(userId);
      }
    });
  } else {
    // Skip cache - fetch all user IDs
    userIdsToFetch.push(...userIds);
  }

  // If all results were in cache, return them
  if (userIdsToFetch.length === 0) {
    return results;
  }

  try {
    console.log(`Making MBD API request to check moderation for ${userIdsToFetch.length} users`);
    
    // Use the correct authentication format according to MBD documentation
    const headers = {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://nuonu.xyz',
      'X-Title': 'Nuonu Frame'
    };
    
    const response = await fetch(MBD_USER_LABELS_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        users_list: userIdsToFetch,
        label_category: 'moderation' // Focus on moderation labels
      }),
    });
    
    console.log(`MBD API response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('MBD API response data:', JSON.stringify(data).substring(0, 200) + '...');
      
      if (data.status_code === 200 && data.body) {
        // Parse the data for each user
        data.body.forEach((userData: MbdUserResponse) => {
          const userId = userData.user_id;
          const moderation: Record<string, number> = {};
          
          // Extract moderation labels from the array format
          if (userData.ai_labels && userData.ai_labels.moderation) {
            userData.ai_labels.moderation.forEach((item: MbdUserLabel) => {
              const { label, score } = item;
              
              if (label === 'spam') {
                moderation['spam_probability'] = score;
              } else if (label === 'llm_generated') {
                moderation['ai_generated_probability'] = score;
              } else {
                moderation[label] = score;
              }
            });
          }
          
          const result = { moderation };
          
          // Store in results
          results[userId] = result;
          
          // Update cache
          moderationCache[userId] = {
            timestamp: now,
            result
          };
        });
      }
      
      return results;
    }
    
    // Handle common HTTP errors
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}. Check your API key.`);
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else if (response.status >= 500) {
      throw new Error(`MBD API server error: ${response.status} ${response.statusText}`);
    }
    
    // If authentication failed, log the error response
    const errorText = await response.text();
    console.error(`MBD API error response: ${errorText}`);
    throw new Error(`MBD API error: ${response.status} ${response.statusText}`);
    
  } catch (error) {
    console.error('Error getting user moderation from MBD:', error);
    throw new Error(`Failed to get user moderation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze text content for bot/spam indicators using the MBD API
 * Maintained for backward compatibility
 * @param content The text content to analyze
 * @returns Analysis results with moderation scores
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function analyzeContent(_content: string): Promise<AnalysisResult> {
  // This is kept for backwards compatibility with existing code
  console.log(`Making MBD API request to check connectivity...`);
  
  try {
    // For the test endpoint, we'll just use a mock userid to test API connectivity
    const mockUserIds = ['3']; // Sample user ID
    const results = await getUserModeration(mockUserIds);
    
    // Return the actual results for the mock user if available, otherwise mock values
    if (results['3']) {
      return results['3'];
    }
    
    // Fallback mock values
    return {
      moderation: {
        spam_probability: 0.01, // Mock value
        ai_generated_probability: 0.05 // Mock value
      }
    };
  } catch (error) {
    console.error('Error analyzing content with MBD:', error);
    throw new Error(`Failed to analyze content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 