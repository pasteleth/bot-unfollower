import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';
import { getInterCssUrl } from "@/lib/fonts";
import path from 'path';
import { registerFont } from 'canvas';
import type { Following } from "../../../../types/farcaster";

// Custom type declarations for global state
declare global {
  var scanResults: {
    [key: number]: {
      timestamp: number;
      started?: boolean;
      completed: boolean;
      flaggedCount?: number;
      followingCount?: number;
      error?: string;
      totalScanTimeMs?: number;
      timingStats?: {
        totalTimeMs: number;
        followingFetchMs: number;
        moderationCheckMs: number;
        resultsProcessingMs: number;
      };
      flaggedUsers?: { id: string; scores: Record<string, number> }[];
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
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-VariableFont_opsz,wght.ttf'), {
    family: 'Inter',
    weight: '400 700',
  });
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-Italic-VariableFont_opsz,wght.ttf'), {
    family: 'Inter',
    style: 'italic',
    weight: '400 700',
  });
  console.log('✅ Variable fonts loaded successfully!');
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
        return scanningFrame(parseInt(fid, 10), request.headers);
      
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
    
    // Initialize or update scan state
    if (!global.scanResults[fidNumber] || !global.scanResults[fidNumber].started) {
      global.scanResults[fidNumber] = {
        timestamp: Date.now(),
        started: true,
        completed: false
      };
      
      // Start the scan in the background without awaiting
      handleScanResults(fidNumber, headers)
        .then(results => {
          const completionTime = Date.now();
          const totalScanTime = completionTime - frameStartTime;
          console.log(`[TIMING] Scan completed for FID: ${fidNumber} in ${totalScanTime}ms`);
          
          // Store the results
          global.scanResults[fidNumber] = {
            timestamp: Date.now(),
            started: true,
            completed: true,
            flaggedCount: results.flaggedCount,
            followingCount: results.followingCount,
            timingStats: results.timingStats,
            totalScanTimeMs: totalScanTime,
            flaggedUsers: results.flaggedUsers
          };
        })
        .catch(error => {
          console.error("[scanningFrame] Error during scan:", error);
          global.scanResults[fidNumber] = {
            timestamp: Date.now(),
            started: true,
            completed: true,
            error: error instanceof Error ? error.message : 'Unknown error during scan'
          };
        });
    }
    
    // Check if scan is complete
    const scanState = global.scanResults[fidNumber];
    if (scanState?.completed) {
      // If scan is complete, redirect to results
      const resultsUrl = addProtectionIfNeeded(
        `${BASE_URL}/api/frames/account-scanner?step=results&fid=${fidNumber}&count=${scanState.followingCount || 0}`,
        headers
      );
      
      return new Response(
        `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-scanning-image?fid=${fidNumber}&message=${encodeURIComponent("Scan complete! Click to view results")}" />
    <meta property="fc:frame:button:1" content="View Results" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${resultsUrl}" />
  </head>
</html>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }
    
    // If scan is still in progress, show scanning message
    const postUrl = addProtectionIfNeeded(
      `${BASE_URL}/api/frames/account-scanner?step=scanning&fid=${fidNumber}`,
      headers
    );
    
    return new Response(
      `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-scanning-image?fid=${fidNumber}&message=${encodeURIComponent("Scanning in progress... Click to check status")}" />
    <meta property="fc:frame:button:1" content="Check Progress" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
</html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("[scanningFrame] Error:", error);
    return errorFrame("An unexpected error occurred", headers);
  }
}

/**
 * Results frame shown after scanning completes
 */
function resultsFrame(fid: number, countStr: string, headers: Headers): Response {
  const scanData = global.scanResults[fid];
  const flaggedUsers: { id: string; scores: Record<string, number> }[] = scanData?.flaggedUsers || [];

  const flaggedListHtml = flaggedUsers.map(user => `<li>User ID: ${user.id}</li>`).join('');

  const message = flaggedUsers.length > 0 ? 'These users might be bots:' : 'No potential issue accounts found';

  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-success-image?unfollowers=${flaggedUsers.length}" />
  </head>
  <body>
    <h1>${message}</h1>
    <ul>${flaggedListHtml}</ul>
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

// Update handleScanResults to use pagination
async function handleScanResults(fidNumber: number, headers: Headers) {
  const scanStartTime = Date.now();
  console.log(`[handleScanResults] Starting scan for FID: ${fidNumber}`);
  
  // Fetch following list
  const followingFetchStart = Date.now();
  const following = await getFollowing(fidNumber);
  const followingFetchTime = Date.now() - followingFetchStart;
  
  if (!following || following.length === 0) {
    throw new Error("No following accounts found");
  }
  
  // Extract user IDs
  const userIds = following.map(user => String(user.fid));
  
  // Check moderation flags
  const moderationStart = Date.now();
  const moderationResults = await getModerationFlags(userIds);
  const moderationTime = Date.now() - moderationStart;
  
  // Process results
  const processingStart = Date.now();
  let flaggedCount = 0;
  const flaggedUsers = [];
  
  for (const userId in moderationResults) {
    const userResult = moderationResults[userId];
    if (!userResult || !userResult.flags) continue;
    
    if (userResult.flags.isFlagged) {
      flaggedCount++;
      flaggedUsers.push({
        id: userId,
        scores: userResult.scores
      });
    }
  }
  
  const processingTime = Date.now() - processingStart;
  const totalTime = Date.now() - scanStartTime;
  
  return {
    flaggedCount,
    followingCount: following.length,
    timingStats: {
      totalTimeMs: totalTime,
      followingFetchMs: followingFetchTime,
      moderationCheckMs: moderationTime,
      resultsProcessingMs: processingTime
    },
    flaggedUsers
  };
} 