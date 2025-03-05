import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';
import { getInterCssUrl } from "@/lib/fonts";
import path from 'path';
import { registerFont } from 'canvas';

// Custom type declarations for global state
declare global {
  var scanResults: {
    [key: number]: {
      timestamp: number;
      started?: boolean;
      completed: boolean;
      flaggedCount?: number;
      error?: string;
      totalScanTimeMs?: number;
      timingStats?: {
        totalTimeMs: number;
        followingFetchMs: number;
        moderationCheckMs: number;
        resultsProcessingMs: number;
      };
    };
  };
}

// Initialize global results store if not exists
if (!global.scanResults) {
  global.scanResults = {};
}

// Base URL for the app with proper protocol
const BASE_URL = (() => {
  // For production environment
  if (process.env.NODE_ENV === 'production') {
    return "https://bot-unfollower.vercel.app";
  }
  
  // For preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // For local development
  return process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
})();

console.log("Using BASE_URL:", BASE_URL);

// Secret key for protection bypass
const PROTECTION_KEY = 'fdhsgioepfdgoissdifhiuads848hsdi';

// Version for cache busting
const VERSION = Date.now().toString();

// Absolute paths ensure fonts are correctly loaded
try {
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-Regular.ttf'), {
    family: 'Inter',
    weight: '400',
  });
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-Bold.ttf'), {
    family: 'Inter',
    weight: '700',
  });
  console.log('✅ Fonts loaded successfully!');
} catch (e) {
  console.error('❌ Font loading error:', e);
}

/**
 * State-driven Frame implementation for scanning follows
 */
export async function GET(request: NextRequest): Promise<Response> {
  // Parse the current step from the URL
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step') || 'start';
  const fid = searchParams.get('fid');
  const count = searchParams.get('count');

  try {
    // State machine to manage frame flow
    switch (step) {
      case 'start':
        return startFrame();
      
      case 'scanning':
        if (!fid) {
          return errorFrame("Missing FID parameter", request.headers);
        }
        return scanningFrame(fid, request.headers);
      
      case 'results':
        if (!fid || !count) {
          return errorFrame("Missing required parameters", request.headers);
        }
        return resultsFrame(parseInt(fid, 10), count, request.headers);
      
      default:
        return errorFrame("Invalid state", request.headers);
    }
  } catch (error) {
    console.error("Frame error:", error);
    return errorFrame("An unexpected error occurred", request.headers);
  }
}

/**
 * Helper function to add protection parameter to URLs if needed
 */
function addProtectionIfNeeded(url: string, headers: Headers): string {
  const shouldAddProtection = headers.get('x-add-protection-to-urls') === 'true';
  if (shouldAddProtection && !url.includes('protection=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}protection=${PROTECTION_KEY}`;
  }
  return url;
}

// Helper function to safely format FID for URL
function formatFidForUrl(fid: number | string | null): string {
  if (fid === null) return '';
  // Ensure it's a string and encode any special characters
  return encodeURIComponent(String(fid));
}

/**
 * Initial frame that prompts the user to start scanning
 */
function startFrame(): Response {
  // Get simplified URLs for validators - remove query params that might confuse parsers
  const imageUrl = `${BASE_URL}/api/generate-start-image`;
  const postUrl = `${BASE_URL}/api/frames/account-scanner`;
  
  // Log for debugging
  console.log("Generated image URL:", imageUrl);
  console.log("Generated post URL:", postUrl);
  
  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="fc:frame:button:1" content="Scan My Following List" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
    <link rel="stylesheet" href="${getInterCssUrl()}" />
  </head>
  <body>
    <!-- Frame content -->
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}

/**
 * Frame shown during the scanning process
 */
async function scanningFrame(fid: number | string, headers: Headers): Promise<Response> {
  const frameStartTime = Date.now();
  console.log(`[TIMING] scanningFrame started at ${new Date().toISOString()}`);

  try {
    console.log("[scanningFrame] Starting with FID:", fid, "Type:", typeof fid);
    
    // Convert string FID to number if needed
    let fidNumber: number;
    if (typeof fid === 'string') {
      console.log("[scanningFrame] Converting string FID to number:", fid);
      fidNumber = parseInt(fid, 10);
      if (isNaN(fidNumber)) {
        console.error("[scanningFrame] Failed to parse FID as number:", fid);
        return errorFrame(`Invalid FID format: ${fid}. FID must be a number.`, headers);
      }
      console.log("[scanningFrame] Converted FID to number:", fidNumber);
    } else if (typeof fid === 'number') {
      fidNumber = fid;
    } else {
      console.error("[scanningFrame] Unsupported FID type:", typeof fid, fid);
      return errorFrame(`Invalid FID type: ${typeof fid}. FID must be a number.`, headers);
    }
    
    // First, show a scanning frame response with a Check Results button
    console.log("[scanningFrame] Creating scanning frame with button");
    
    // Create post URL for the Check Results button
    const postUrl = addProtectionIfNeeded(`${BASE_URL}/api/frames/account-scanner?step=scanning&fid=${fidNumber}`, headers);
    
    // HTML for scanning frame with a button
    const scanningFrameHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-scanning-image?fid=${fidNumber}&message=${encodeURIComponent("Wait 10 seconds then click button")}" />
    <meta property="fc:frame:button:1" content="Check Results" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
  <body>
    <!-- Scanning frame content with button -->
  </body>
</html>`;

    // Handle the scanning logic asynchronously
    console.log("[scanningFrame] Starting asynchronous scan process");
    // Create a global variable to store scan results
    if (!global.scanResults) {
      global.scanResults = {};
    }
    
    // Measure setup time before starting async work
    const setupCompleteTime = Date.now();
    console.log(`[TIMING] scanningFrame setup completed in ${setupCompleteTime - frameStartTime}ms`);
    
    // Start the scan in the background
    handleScanResults(fidNumber, headers)
      .then(results => {
        const completionTime = Date.now();
        const totalScanTime = completionTime - frameStartTime;
        console.log(`[TIMING] Scan completed for FID: ${fidNumber} in ${totalScanTime}ms`);
        console.log(`[scanningFrame] Scan completed for FID: ${fidNumber}`);
        
        // Store the results for later retrieval
        global.scanResults[fidNumber] = {
          timestamp: Date.now(),
          flaggedCount: results.flaggedCount,
          completed: true,
          timingStats: results.timingStats,
          totalScanTimeMs: totalScanTime
        };
      })
      .catch(error => {
        const errorTime = Date.now();
        console.error("[scanningFrame] Error during scan:", error);
        console.log(`[TIMING] Scan failed for FID: ${fidNumber} after ${errorTime - frameStartTime}ms`);
        
        // Store the error
        global.scanResults[fidNumber] = {
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : "Unknown error",
          completed: true,
          totalScanTimeMs: errorTime - frameStartTime
        };
      });
    
    // Mark that we've started scanning
    global.scanResults[fidNumber] = {
      timestamp: Date.now(),
      started: true,
      completed: false
    };
    
    console.log("[scanningFrame] Returning scanning frame with button");
    const responseTime = Date.now();
    console.log(`[TIMING] scanningFrame returning response after ${responseTime - frameStartTime}ms`);
    
    // Return the immediate response
    return new Response(scanningFrameHtml, {
      headers: { "Content-Type": "text/html" }
    });
  
  } catch (error) {
    const errorTime = Date.now();
    console.error("Error during scanning:", error);
    console.log(`[TIMING] scanningFrame error after ${errorTime - frameStartTime}ms`);
    return errorFrame("Error scanning your following list: " + (error instanceof Error ? error.message : "Unknown error"), headers);
  }
}

/**
 * Results frame shown after scanning completes
 */
function resultsFrame(fid: number, countStr: string, headers: Headers): Response {
  const count = parseInt(countStr);
  let message = '';
  
  if (isNaN(count)) {
    message = 'Scan complete';
  } else if (count === 0) {
    message = 'No potential issue accounts found';
  } else if (count === 1) {
    message = '1 potential issue account found';
  } else {
    message = `${count} potential issue accounts found`;
  }
  
  // Generate URLs that will be presented to the user
  const hostname = headers.get('host') || 'bot-unfollower.vercel.app';
  const protocol = hostname.includes('localhost') ? 'http' : 'https';
  
  // Create the report URL without protection for validation, it will be added later if needed
  const reportUrl = `${protocol}://${hostname}/reports/${fid}`;
  const restartUrl = `${protocol}://${hostname}/api/frames/account-scanner`;
  
  // Add protection if needed
  const reportButtonUrl = addProtectionIfNeeded(reportUrl, headers);
  const restartButtonUrl = addProtectionIfNeeded(restartUrl, headers);
  
  console.log("Report button URL:", reportButtonUrl);
  console.log("Restart button URL:", restartButtonUrl);
  
  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="https://bot-unfollower.vercel.app/api/generate-success-image?unfollowers=${count}" />
    <meta property="fc:frame:button:1" content="View Full Report" />
    <meta property="fc:frame:button:1:action" content="post_redirect" />
    <meta property="fc:frame:button:1:target" content="${reportButtonUrl}" />
    <meta property="fc:frame:button:2" content="Scan Again" />
    <meta property="fc:frame:button:2:action" content="post" />
    <meta property="fc:frame:post_url" content="${restartButtonUrl}" />
  </head>
  <body>
    <!-- Results frame content -->
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}

/**
 * Error frame to display when something goes wrong
 */
function errorFrame(errorMessage: string = "An error occurred", headers: Headers): Response {
  console.error("Showing error frame:", errorMessage);
  
  const hostname = headers.get('host') || 'bot-unfollower.vercel.app';
  const protocol = hostname.includes('localhost') ? 'http' : 'https';
  const restartUrl = `${protocol}://${hostname}/api/frames/account-scanner`;
  const restartButtonUrl = addProtectionIfNeeded(restartUrl, headers);
  
  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="https://bot-unfollower.vercel.app/api/generate-error-image?message=${encodeURIComponent(errorMessage)}" />
    <meta property="fc:frame:button:1" content="Try Again" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${restartButtonUrl}" />
  </head>
  <body>
    <!-- Error frame content -->
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}

// Handle POST requests (for button clicks)
export async function POST(request: Request) {
  const postStartTime = Date.now();
  console.log(`[TIMING] POST request started at ${new Date().toISOString()}`);
  
  try {
    // Parse the request body as JSON
    let requestBody;
    try {
      requestBody = await request.json();
      const parseTime = Date.now();
      console.log(`[TIMING] Request body parsed in ${parseTime - postStartTime}ms`);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return errorFrame("Failed to parse request body. This may indicate a malformed request.", request.headers);
    }
    
    // Verify untrustedData exists
    if (!requestBody || !requestBody.untrustedData) {
      console.error("Request body missing untrustedData:", JSON.stringify(requestBody));
      return errorFrame("Invalid request format: missing untrustedData", request.headers);
    }
    
    // Extract button index and FID from the frame action
    const { buttonIndex = 0, fid = null } = requestBody.untrustedData;
    
    if (!fid) {
      console.error("Missing FID in request");
      return errorFrame("Missing FID in request. This may happen if you're testing outside of a Farcaster client.", request.headers);
    }
    
    // Get API keys
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    const mbdApiKey = process.env.MBD_API_KEY;
    
    if (!neynarApiKey) {
      console.error("NEYNAR_API_KEY is missing");
      return errorFrame("Server configuration error: Missing API key", request.headers);
    }
    
    if (!mbdApiKey) {
      console.error("MBD_API_KEY is missing");
      return errorFrame("Server configuration error: Missing API key", request.headers);
    }
    
    // Convert FID to a number
    let fidNumber: number;
    if (typeof fid === 'number') {
      fidNumber = fid;
    } else if (typeof fid === 'string') {
      fidNumber = parseInt(fid, 10);
      if (isNaN(fidNumber)) {
        console.error("Failed to parse FID as number:", fid);
        return errorFrame(`Invalid FID format: ${fid}. FID must be a number.`, request.headers);
      }
      console.log("Converted FID to number:", fidNumber);
    } else {
      console.error("Unsupported FID type:", typeof fid, fid);
      return errorFrame(`Invalid FID type: ${typeof fid}. FID must be a number.`, request.headers);
    }
    
    // Extract URL parameters from search params if present
    const url = new URL(request.url);
    const step = url.searchParams.get('step') || '';
    const count = url.searchParams.get('count') || '';
    
    const processingTime = Date.now();
    console.log(`[TIMING] POST request processing completed in ${processingTime - postStartTime}ms`);
    console.log(`Processing button ${buttonIndex} press for step: ${step}`);
    
    // Handle button actions based on the current step
    if (step === 'scanning') {
      // Check if scan results are available
      console.log(`[POST] Button pressed during scanning state for FID: ${fidNumber}`);
      
      if (!global.scanResults || !global.scanResults[fidNumber]) {
        console.log(`[POST] No scan data found for FID: ${fidNumber}, starting scan`);
        // No results found, start a new scan
        const newScanTime = Date.now();
        console.log(`[TIMING] Starting new scan at ${newScanTime - postStartTime}ms`);
        return scanningFrame(fidNumber, request.headers);
      }
      
      const scanData = global.scanResults[fidNumber];
      console.log(`[POST] Scan data for FID: ${fidNumber}:`, scanData);
      
      const scanCheckTime = Date.now();
      console.log(`[TIMING] Scan status check completed in ${scanCheckTime - postStartTime}ms`);
      
      if (scanData.completed) {
        // If there was an error during scanning
        if (scanData.error) {
          console.log(`[POST] Scan completed with error for FID: ${fidNumber}`);
          console.log(`[TIMING] Returning error response at ${Date.now() - postStartTime}ms`);
          return errorFrame(`Error during scan: ${scanData.error}`, request.headers);
        }
        
        // Results are ready, show them
        console.log(`[POST] Scan completed successfully for FID: ${fidNumber}`);
        const resultsTime = Date.now();
        console.log(`[TIMING] Returning results response at ${resultsTime - postStartTime}ms`);
        return resultsFrame(fidNumber, scanData.flaggedCount?.toString() || "0", request.headers);
      } else {
        // Scan is still in progress, show "not ready yet" page
        console.log(`[POST] Scan still in progress for FID: ${fidNumber}`);
        const notReadyTime = Date.now();
        console.log(`[TIMING] Returning not-ready response at ${notReadyTime - postStartTime}ms`);
        const postUrl = addProtectionIfNeeded(`${BASE_URL}/api/frames/account-scanner?step=scanning&fid=${fidNumber}`, request.headers);
        
        return new Response(
          `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-error-image?message=${encodeURIComponent("Results not ready yet. Please wait a few more seconds and try again.")}" />
    <meta property="fc:frame:button:1" content="Check Again" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
  <body>
    <!-- Results not ready yet frame content -->
  </body>
</html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
    } else if (step === 'results') {
      // In results state, Button 1 is for viewing report (handled by redirect)
      // Button 2 is for restarting scan
      if (buttonIndex === 2) {
        console.log(`[TIMING] Returning to start frame at ${Date.now() - postStartTime}ms`);
        return startFrame();
      }
    } else {
      // Default start state - begin scanning
      console.log(`[TIMING] Starting scan from default state at ${Date.now() - postStartTime}ms`);
      return scanningFrame(fidNumber, request.headers);
    }
    
    // If no specific handler matched, return to start
    console.log(`[TIMING] Falling back to start frame at ${Date.now() - postStartTime}ms`);
    return startFrame();

  } catch (error) {
    console.error("Error processing request:", error);
    
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Request headers:", Object.fromEntries(request.headers.entries()));
    
    const errorTime = Date.now();
    console.log(`[TIMING] Error in POST handling after ${errorTime - postStartTime}ms`);
    return errorFrame(errorMessage, request.headers);
  }
}

// Helper function to handle scan results processing
async function handleScanResults(fidNumber: number, headers: Headers) {
  // Start timing the entire scan process
  const startTime = Date.now();
  // Variables for timing metrics that need broader scope
  let followingFetchStart = 0;
  let followingFetchEnd = 0;
  let processingStart = 0;
  let processingEnd = 0;
  let moderationStart = 0;
  let moderationEnd = 0;
  let resultsProcessingStart = 0;
  let resultsProcessingEnd = 0;
  
  try {
    console.log(`[TIMING] Scan process started at ${new Date().toISOString()} for FID: ${fidNumber}`);
    
    console.log("[handleScanResults] Starting with FID:", fidNumber);
    
    // Get the following list for the FID
    let followingList;
    try {
      followingFetchStart = Date.now();
      console.log(`[TIMING] Starting following list fetch at ${followingFetchStart - startTime}ms`);
      console.log("Fetching following list for FID:", fidNumber);
      followingList = await getFollowing(fidNumber);
      followingFetchEnd = Date.now();
      console.log(`[TIMING] Following list fetch completed in ${followingFetchEnd - followingFetchStart}ms (total: ${followingFetchEnd - startTime}ms)`);
      console.log("Following list fetched, entries:", followingList.length);
    } catch (apiError) {
      console.error("API error during following list fetch:", apiError);
      throw new Error("Error fetching following list: " + (apiError instanceof Error ? apiError.message : "Unknown error"));
    }
    
    // Check if the list is empty
    if (!followingList || followingList.length === 0) {
      const emptyListTime = Date.now();
      console.log(`[TIMING] Empty list detection at ${emptyListTime - startTime}ms`);
      throw new Error("No accounts found in your following list");
    }
    
    console.log(`Found ${followingList.length} following accounts for FID: ${fidNumber}`);
    
    // Process following list
    processingStart = Date.now();
    console.log(`[TIMING] Starting list processing at ${processingStart - startTime}ms`);
    console.log("Processing following list");
    
    // Check following list against moderation flags
    const userIds = followingList.map(user => {
      if (user && typeof user.fid === 'number') {
        return String(user.fid);
      }
      // Log problematic user objects
      console.log('Invalid user object:', JSON.stringify(user));
      return '';
    }).filter(id => id !== ''); // Filter out empty strings
    
    processingEnd = Date.now();
    console.log(`[TIMING] List processing completed in ${processingEnd - processingStart}ms (total: ${processingEnd - startTime}ms)`);
    console.log(`Found ${userIds.length} valid user IDs for moderation check`);
    
    // No valid user IDs found
    if (!userIds || userIds.length === 0) {
      console.warn('No valid user IDs found after processing following list');
      const noValidIdsTime = Date.now();
      console.log(`[TIMING] No valid IDs detection at ${noValidIdsTime - startTime}ms`);
      throw new Error("No valid accounts found to analyze");
    }
    
    // Perform moderation check
    moderationStart = Date.now();
    console.log(`[TIMING] Starting moderation check at ${moderationStart - startTime}ms`);
    console.log("Checking for potential bots among following");
    const moderationResults = await getModerationFlags(userIds);
    moderationEnd = Date.now();
    console.log(`[TIMING] Moderation check completed in ${moderationEnd - moderationStart}ms (total: ${moderationEnd - startTime}ms)`);
    
    let flaggedCount = 0;
    const flaggedUsers = [];
    
    // Process moderation results to count flagged accounts
    resultsProcessingStart = Date.now();
    console.log(`[TIMING] Starting results processing at ${resultsProcessingStart - startTime}ms`);
    console.log("Processing moderation results");
    
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
    
    resultsProcessingEnd = Date.now();
    console.log(`[TIMING] Results processing completed in ${resultsProcessingEnd - resultsProcessingStart}ms (total: ${resultsProcessingEnd - startTime}ms)`);
    console.log(`Found ${flaggedCount} flagged accounts`);
    
    // Complete timing
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    console.log(`[TIMING] Total scan process completed in ${totalTime}ms`);
    console.log(`[TIMING] SUMMARY for FID ${fidNumber}:`);
    console.log(`[TIMING] - Following list fetch: ${followingFetchEnd - followingFetchStart}ms`);
    console.log(`[TIMING] - List processing: ${processingEnd - processingStart}ms`);
    console.log(`[TIMING] - Moderation check: ${moderationEnd - moderationStart}ms`);
    console.log(`[TIMING] - Results processing: ${resultsProcessingEnd - resultsProcessingStart}ms`);
    console.log(`[TIMING] - Total time: ${totalTime}ms`);
    
    // Return results data
    return {
      flaggedCount,
      followingCount: userIds.length,
      flaggedUsers,
      timingStats: {
        totalTimeMs: totalTime,
        followingFetchMs: followingFetchEnd - followingFetchStart,
        moderationCheckMs: moderationEnd - moderationStart,
        resultsProcessingMs: resultsProcessingEnd - resultsProcessingStart
      }
    };
    
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error("Error handling scan results:", error);
    console.log(`[TIMING] Error occurred after ${errorTime}ms`);
    throw error;
  }
} 