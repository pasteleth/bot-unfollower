import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';
import { getInterCssUrl } from "@/lib/fonts";

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
    
    // First, show an immediate scanning frame response
    const simpleScanningFrame = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-scanning-image?fid=${fidNumber}" />
  </head>
  <body>
    <!-- Scanning frame content -->
  </body>
</html>`;

    // Handle the scanning logic asynchronously
    handleScanResults(fidNumber, headers)
      .then(result => {
        console.log("Scan completed successfully");
      })
      .catch(error => {
        console.error("Error during scan:", error);
      });
    
    // Return the immediate response
    return new Response(simpleScanningFrame, {
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
      // User clicked during scanning state - continue scanning
      return scanningFrame(fidNumber, request.headers);
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
      return errorFrame("Error fetching following list: " + (apiError instanceof Error ? apiError.message : "Unknown error"), headers);
    }
    
    // Check if the list is empty
    if (!followingList || followingList.length === 0) {
      // Use direct HTML content instead of generated image for empty following list
      const postUrl = addProtectionIfNeeded(`${BASE_URL}/api/frames/account-scanner`, headers);
      
      return new Response(
        `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-error-image?message=${encodeURIComponent("No accounts found in your following list.")}" />
    <meta property="fc:frame:button:1" content="Try Again" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
  <body>
    <!-- Empty following list frame content -->
  </body>
</html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
    
    console.log(`Found ${followingList.length} following accounts for FID: ${fidNumber}`);
    
    // Process following list in batches to avoid excessive API calls
    console.log("Processing following list in batches");
    
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
      // Use direct HTML content instead of generated image
      const postUrl = addProtectionIfNeeded(`${BASE_URL}/api/frames/account-scanner`, headers);
      
      return new Response(
        `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${BASE_URL}/api/generate-error-image?message=${encodeURIComponent("No valid accounts found to analyze.")}" />
    <meta property="fc:frame:button:1" content="Try Again" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
  <body>
    <!-- No valid user IDs frame content -->
  </body>
</html>`,
        { headers: { "Content-Type": "text/html" } }
      );
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
    
    // Return results frame
    return resultsFrame(fidNumber, flaggedCount.toString(), headers);
    
  } catch (error) {
    console.error("Error handling scan results:", error);
    return errorFrame("Error handling scan results: " + (error instanceof Error ? error.message : "Unknown error"), headers);
  }
} 