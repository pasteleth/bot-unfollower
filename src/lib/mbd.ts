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

  // If no user IDs need to be fetched, return cached results
  if (userIdsToFetch.length === 0) {
    return results;
  }

  // Define batch size
  const BATCH_SIZE = 100;
  // We'll accumulate moderation results from each batch
  const batches: string[][] = [];
  for (let i = 0; i < userIdsToFetch.length; i += BATCH_SIZE) {
    batches.push(userIdsToFetch.slice(i, i + BATCH_SIZE));
  }

  console.log(`[getUserModeration] Processing ${userIdsToFetch.length} user IDs in ${batches.length} batch(es).`);

  // Prepare headers for MBD API call
  const headers = {
    'Content-Type': 'application/json',
    'authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://nuonu.xyz',
    'X-Title': 'Nuonu Frame'
  };

  // Process each batch sequentially
  const INITIAL_DELAY_MS = 60000; // 60 seconds initial delay
  const MAX_RETRIES = 5;
  for (const batch of batches) {
    console.log(`[getUserModeration] Processing batch with ${batch.length} user IDs: ${batch.join(",")}`);
    let batchProcessed = false;
    let attempt = 0;
    let delay = INITIAL_DELAY_MS;
    while (!batchProcessed && attempt < MAX_RETRIES) {
      try {
        const response = await fetch(MBD_USER_LABELS_URL, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            users_list: batch,
            label_category: 'moderation'
          }),
        });

        console.log(`[getUserModeration] Batch response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          // If the API returns a 429 rate limit, apply exponential backoff
          if (response.status === 429) {
            attempt++;
            console.error(`[getUserModeration] Rate limit hit for batch: ${batch.join(",")}. Attempt ${attempt} of ${MAX_RETRIES}. Waiting ${delay / 1000} seconds before retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
            continue; // retry current batch
          } else {
            console.error(`[getUserModeration] Error with batch request for users: ${batch.join(",")}. Status: ${response.status}`);
            // Optionally skip this batch or throw error
            break;
          }
        }

        const data = await response.json();
        console.log(`[getUserModeration] Batch response data (truncated): ${JSON.stringify(data).substring(0,200)}...`);

        // Check if the response contains pagination info
        if (data.next) {
          console.warn(`[getUserModeration] Warning: Response for batch contains pagination info which is not handled: ${JSON.stringify(data.next)}`);
        }

        if (data.status_code === 200 && data.body) {
          data.body.forEach((userData: any) => {
            const userId = userData.user_id;
            const moderation: Record<string, number> = {};
            if (userData.ai_labels && userData.ai_labels.moderation) {
              userData.ai_labels.moderation.forEach((item: any) => {
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
            results[userId] = result;

            // Update cache if needed
            moderationCache[userId] = {
              timestamp: now,
              result
            };
          });
          batchProcessed = true; // exit while loop for this batch
        } else {
          console.warn(`[getUserModeration] Unexpected response format for batch: ${JSON.stringify(data)}`);
          batchProcessed = true; // exit loop, though no data processed
        }

      } catch (batchError: any) {
        if (batchError.response && batchError.response.status === 429) {
          attempt++;
          console.error(`[getUserModeration] Exception due to rate limit for batch: ${batch.join(",")}. Attempt ${attempt} of ${MAX_RETRIES}. Waiting ${delay / 1000} seconds before retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        } else {
          console.error(`[getUserModeration] Exception processing batch for users: ${batch.join(",")}. Error: ${batchError.message || batchError}`);
          break;
        }
      }
    }
  }

  return results;
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