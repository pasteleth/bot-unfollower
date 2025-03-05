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
    
    // Start the scan in the background
    handleScanResults(fidNumber, headers)
      .then(results => {
        console.log(`[scanningFrame] Scan completed for FID: ${fidNumber}`);
        // Store the results for later retrieval
        global.scanResults[fidNumber] = {
          timestamp: Date.now(),
          flaggedCount: results.flaggedCount,
          completed: true
        };
      })
      .catch(error => {
        console.error("[scanningFrame] Error during scan:", error);
        // Store the error
        global.scanResults[fidNumber] = {
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : "Unknown error",
          completed: true
        };
      });
    
    // Mark that we've started scanning
    global.scanResults[fidNumber] = {
      timestamp: Date.now(),
      started: true,
      completed: false
    };
    
    console.log("[scanningFrame] Returning scanning frame with button");
    // Return the immediate response
    return new Response(scanningFrameHtml, {
      headers: { "Content-Type": "text/html" }
    });
  
  } catch (error) {
    console.error("Error during scanning:", error);
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
  try {
    // Parse the request body as JSON
    let requestBody;
    try {
      requestBody = await request.json();
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
    
    console.log(`Processing button ${buttonIndex} press for step: ${step}`);
    
    // Handle button actions based on the current step
    if (step === 'scanning') {
      // Check if scan results are available
      console.log(`[POST] Button pressed during scanning state for FID: ${fidNumber}`);
      
      if (!global.scanResults || !global.scanResults[fidNumber]) {
        console.log(`[POST] No scan data found for FID: ${fidNumber}, starting scan`);
        // No results found, start a new scan
        return scanningFrame(fidNumber, request.headers);
      }
      
      const scanData = global.scanResults[fidNumber];
      console.log(`[POST] Scan data for FID: ${fidNumber}:`, scanData);
      
      if (scanData.completed) {
        // If there was an error during scanning
        if (scanData.error) {
          console.log(`[POST] Scan completed with error for FID: ${fidNumber}`);
          return errorFrame(`Error during scan: ${scanData.error}`, request.headers);
        }
        
        // Results are ready, show them
        console.log(`[POST] Scan completed successfully for FID: ${fidNumber}`);
        return resultsFrame(fidNumber, scanData.flaggedCount?.toString() || "0", request.headers);
      } else {
        // Scan is still in progress, show "not ready yet" page
        console.log(`[POST] Scan still in progress for FID: ${fidNumber}`);
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
        return startFrame();
      }
    } else {
      // Default start state - begin scanning
      return scanningFrame(fidNumber, request.headers);
    }
    
    // If no specific handler matched, return to start
    return startFrame();

  } catch (error) {
    console.error("Error processing request:", error);
    
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Request headers:", Object.fromEntries(request.headers.entries()));
    
    return errorFrame(errorMessage, request.headers);
  }
}

// Helper function to handle scan results processing
async function handleScanResults(fidNumber: number, headers: Headers) {
  try {
    console.log("[handleScanResults] Starting with FID:", fidNumber);
    
    // Get the following list for the FID
    let followingList;
    try {
      console.log("Fetching following list for FID:", fidNumber);
      followingList = await getFollowing(fidNumber);
      console.log("Following list fetched, entries:", followingList.length);
    } catch (apiError) {
      console.error("API error during following list fetch:", apiError);
      throw new Error("Error fetching following list: " + (apiError instanceof Error ? apiError.message : "Unknown error"));
    }
    
    // Check if the list is empty
    if (!followingList || followingList.length === 0) {
      throw new Error("No accounts found in your following list");
    }
    
    console.log(`Found ${followingList.length} following accounts for FID: ${fidNumber}`);
    
    // Process following list
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
    
    console.log(`Found ${userIds.length} valid user IDs for moderation check`);
    
    // No valid user IDs found
    if (!userIds || userIds.length === 0) {
      console.warn('No valid user IDs found after processing following list');
      throw new Error("No valid accounts found to analyze");
    }
    
    // Perform moderation check
    console.log("Checking for potential bots among following");
    const moderationResults = await getModerationFlags(userIds);
    
    let flaggedCount = 0;
    const flaggedUsers = [];
    
    // Process moderation results to count flagged accounts
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
    
    console.log(`Found ${flaggedCount} flagged accounts`);
    
    // Return results data
    return {
      flaggedCount,
      followingCount: userIds.length,
      flaggedUsers
    };
    
  } catch (error) {
    console.error("Error handling scan results:", error);
    throw error;
  }
} 