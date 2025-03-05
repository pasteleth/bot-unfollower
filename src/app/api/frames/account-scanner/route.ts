import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';

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

// Protection bypass key for Vercel
const PROTECTION_BYPASS = "fdhsgioepfdgoissdifhiuads848hsdi";

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
          return errorFrame("Missing FID parameter");
        }
        return scanningFrame(fid);
      
      case 'results':
        if (!fid || !count) {
          return errorFrame("Missing required parameters");
        }
        return resultsFrame(parseInt(fid, 10), count);
      
      default:
        return errorFrame("Invalid state");
    }
  } catch (error) {
    console.error("Frame error:", error);
    return errorFrame("An unexpected error occurred");
  }
}

/**
 * Helper function to add protection bypass to URLs
 */
function addProtectionBypass(url: string): string {
  // Check if URL already has parameters
  const hasParams = url.includes('?');
  const separator = hasParams ? '&' : '?';
  return `${url}${separator}protection=${PROTECTION_BYPASS}`;
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
  const imageUrl = addProtectionBypass(`${BASE_URL}/api/generate-start-image`);
  
  // Construct a fully qualified, safe post URL with HTTPS protocol
  const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
  console.log("Generated post URL for startFrame:", postUrl);
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Account Scanner - Farcaster Frame</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta property="og:title" content="Account Scanner" />
        <meta property="og:description" content="Scan your following list for potentially problematic accounts" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="theme-color" content="#000000" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Account Scanner" />
        <meta name="twitter:description" content="Scan your following list for potentially problematic accounts" />
        <meta name="twitter:image" content="${imageUrl}" />

        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Scan My Following List" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:post_url" content="${postUrl}" />
      </head>
      <body style="background-color: #000000; color: #ffffff;">
        <h1>Account Scanner</h1>
        <p>Scan your following list for potentially problematic accounts.</p>
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
async function scanningFrame(fid: number | string): Promise<Response> {
  try {
    console.log("[scanningFrame] Starting with FID:", fid, "Type:", typeof fid);
    
    // Convert string FID to number if needed
    let fidNumber: number;
    if (typeof fid === 'string') {
      console.log("[scanningFrame] Converting string FID to number:", fid);
      fidNumber = parseInt(fid, 10);
      if (isNaN(fidNumber)) {
        console.error("[scanningFrame] Failed to parse FID as number:", fid);
        return errorFrame(`Invalid FID format: ${fid}. FID must be a number.`);
      }
      console.log("[scanningFrame] Converted FID to number:", fidNumber);
    } else if (typeof fid === 'number') {
      fidNumber = fid;
    } else {
      console.error("[scanningFrame] Unsupported FID type:", typeof fid, fid);
      return errorFrame(`Invalid FID type: ${typeof fid}. FID must be a number.`);
    }
    
    // Set a timeout for the scanning operation
    const timeoutDuration = 3000; // 3 seconds
    let timeoutReached = false;
    const timeout = setTimeout(() => {
      timeoutReached = true;
    }, timeoutDuration);

    const scanningPromise = async (): Promise<Response> => {
      try {
        console.log("Starting scanning process for FID:", fidNumber);
        
        // Safety check - start timer to measure performance
        const startTime = Date.now();
        
        console.log("Fetching following list for FID:", fidNumber);
        // Validate FID one more time to be extra safe
        if (typeof fidNumber !== 'number' || isNaN(fidNumber) || fidNumber <= 0) {
          throw new Error(`Invalid FID: ${fidNumber}. FID must be a positive number.`);
        }
        
        const followingList = await getFollowing(fidNumber);
        
        if (!followingList || followingList.length === 0) {
          const noFollowingImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-error-image?message=${encodeURIComponent("We couldn't find any accounts you're following")}`);
          
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <title>No Following Found - Account Scanner</title>
                <meta property="og:title" content="No Following Found" />
                <meta property="og:description" content="We couldn't find any accounts you're following" />
                <meta property="og:image" content="${noFollowingImageUrl}" />
                <meta name="theme-color" content="#000000" />

                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:image" content="${noFollowingImageUrl}" />
                <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
                <meta property="fc:frame:button:1" content="Try Again" />
                <meta property="fc:frame:button:1:action" content="post" />
                <meta property="fc:frame:button:1:target" content="_self" />
                <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`)}" />
              </head>
              <body style="background-color: #000000; color: #ffffff;">
                <h1>No Following Found</h1>
                <p>We couldn't find any accounts you're following.</p>
              </body>
            </html>`,
            {
              headers: {
                "Content-Type": "text/html",
              },
            }
          );
        }

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
        
        if (userIds.length === 0) {
          console.warn('No valid user IDs found after processing following list');
          const noFollowingImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-error-image?message=${encodeURIComponent("We couldn't find any valid accounts you're following")}`);
          
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <title>No Valid Accounts Found - Account Scanner</title>
                <meta property="og:title" content="No Valid Accounts Found" />
                <meta property="og:description" content="We couldn't find any valid accounts you're following" />
                <meta property="og:image" content="${noFollowingImageUrl}" />
                <meta name="theme-color" content="#000000" />

                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:image" content="${noFollowingImageUrl}" />
                <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
                <meta property="fc:frame:button:1" content="Try Again" />
                <meta property="fc:frame:button:1:action" content="post" />
                <meta property="fc:frame:button:1:target" content="_self" />
                <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`)}" />
              </head>
              <body style="background-color: #000000; color: #ffffff;">
                <h1>No Valid Accounts Found</h1>
                <p>We couldn't find any valid accounts you're following.</p>
              </body>
            </html>`,
            {
              headers: {
                "Content-Type": "text/html",
              },
            }
          );
        }
        
        const moderationResults = await getModerationFlags(userIds);

        // Count flagged accounts
        let flaggedCount = 0;
        const flaggedUsers = [];

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

        // Scanning complete image
        const scanningImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-scanning-image?fid=${formatFidForUrl(fidNumber)}`);
        
        // Fully qualified URL for results
        const resultsParam = `step=results&fid=${formatFidForUrl(fidNumber)}&count=${flaggedCount}`;
        const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?${resultsParam}`);
        console.log("Generated results post URL:", postUrl);
        
        return new Response(
          `<!DOCTYPE html>
          <html>
            <head>
              <title>Scanning Complete - Account Scanner</title>
              <meta property="og:title" content="Scanning Complete" />
              <meta property="og:description" content="We've scanned your following list" />
              <meta property="og:image" content="${scanningImageUrl}" />
              <meta property="fc:frame" content="vNext" />
              <meta property="fc:frame:image" content="${scanningImageUrl}" />
              <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
              <meta property="fc:frame:button:1" content="See Results" />
              <meta property="fc:frame:button:1:action" content="post" />
              <meta property="fc:frame:post_url" content="${postUrl}" />
            </head>
            <body style="background-color: #000000; color: #ffffff;">
              <h1>Scanning Complete</h1>
              <p>We've scanned your following list</p>
            </body>
          </html>`,
          {
            headers: {
              "Content-Type": "text/html",
            },
          }
        );
      } catch (apiError) {
        console.error("API error during following list fetch:", apiError);
        return errorFrame("Error fetching following list: " + (apiError instanceof Error ? apiError.message : "Unknown error"));
      }
    };

    // Use safe FID formatting here too
    const scanningImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-scanning-image?fid=${formatFidForUrl(fidNumber)}`);
    
    // Race the scanning process against the timeout
    const result = await Promise.race<Response | null>([
      scanningPromise(),
      new Promise<null>(resolve => setTimeout(() => {
        timeoutReached = true;
        resolve(null);
      }, 3000))
    ]);
    
    clearTimeout(timeout);
    
    // If the timeout was reached, return an interim response
    if (timeoutReached) {
      console.log("Timeout reached, returning interim response");
      // Return a response indicating scanning is in progress
      const scanningImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-scanning-image?fid=${formatFidForUrl(fidNumber)}`);
      const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?step=scanning&fid=${formatFidForUrl(fidNumber)}`);
      console.log("Generated post URL for timeout response:", postUrl);
      
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Scanning in Progress - Account Scanner</title>
            <meta property="og:title" content="Scanning in Progress" />
            <meta property="og:description" content="We're scanning your following list..." />
            <meta property="og:image" content="${scanningImageUrl}" />
            
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${scanningImageUrl}" />
            <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
            <meta property="fc:frame:button:1" content="Check Again" />
            <meta property="fc:frame:button:1:action" content="post" />
            <meta property="fc:frame:post_url" content="${postUrl}" />
          </head>
          <body style="background-color: #000000; color: #ffffff;">
            <h1>Scanning in Progress</h1>
            <p>We're scanning your following list... Click "Check Again" to see if it's complete.</p>
          </body>
        </html>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }
    
    // If we got here, the scanning completed before the timeout
    if (result) {
      return result as Response;
    } else {
      // Provide a fallback response if result is null
      return errorFrame("Scanning timed out or failed to complete");
    }
  } catch (error) {
    console.error("Error during scanning:", error);
    return errorFrame("Error scanning your following list: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Results frame shown after scanning completes
 */
function resultsFrame(fid: number, countStr: string): Response {
  const count = parseInt(countStr);
  let message = '';
  let imageUrl = '';
  let buttonText = '';
  let buttonUrl = '';
  let hasActionButton = true;
  
  try {
    if (count > 0) {
      message = `We found ${count} potentially problematic account${count === 1 ? '' : 's'} in your following list`;
      imageUrl = addProtectionBypass(`${BASE_URL}/api/generate-results-image?count=${count}`);
      buttonText = 'View Detailed Report';
      
      // Construct a fully qualified URL
      const reportParams = `fid=${formatFidForUrl(fid)}&count=${count}`;
      buttonUrl = `${BASE_URL}/report?${reportParams}`;
      console.log("Generated report button URL:", buttonUrl);
    } else {
      message = "Great news! We didn't find any potentially problematic accounts in your following list";
      imageUrl = addProtectionBypass(`${BASE_URL}/api/generate-zero-results-image`);
      buttonText = 'Start New Scan';
      
      // Construct fully qualified URL for restart
      buttonUrl = `${BASE_URL}/api/frames/account-scanner`;
      console.log("Generated restart button URL:", buttonUrl);
    }
  } catch (error) {
    console.error("Error preparing results frame:", error);
    message = "Error preparing results";
    imageUrl = addProtectionBypass(`${BASE_URL}/api/generate-error-image?message=${encodeURIComponent(message)}`);
    hasActionButton = false;
  }
  
  // Construct post URL for scan again button
  const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
  console.log("Generated post URL for results frame:", postUrl);
  
  // Prepare HTML response with results
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Scan Results - Account Scanner</title>
        <meta property="og:title" content="Scan Results" />
        <meta property="og:description" content="${message}" />
        <meta property="og:image" content="${imageUrl}" />
        
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        ${hasActionButton ? `
        <meta property="fc:frame:button:1" content="${buttonText}" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content="${buttonUrl}" />
        ` : ''}
        <meta property="fc:frame:button:2" content="Scan Again" />
        <meta property="fc:frame:button:2:action" content="post" />
        <meta property="fc:frame:post_url" content="${postUrl}" />
      </head>
      <body style="background-color: #000000; color: #ffffff;">
        <h1>Scan Results</h1>
        <p>${message}</p>
        ${hasActionButton ? `<p><a href="${buttonUrl}">${buttonText}</a></p>` : ''}
        <p><button onclick="location.href='${postUrl}'">Scan Again</button></p>
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
 * Error frame shown when an error occurs
 */
function errorFrame(errorMessage: string = "An error occurred"): Response {
  console.error("Showing error frame:", errorMessage);
  
  // Log error stack for debugging
  console.error("Error details:", new Error().stack);
  
  // Encode the error message for the URL
  const encodedMessage = encodeURIComponent(errorMessage);
  const errorImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-error-image?message=${encodedMessage}`);
  
  // Construct a fully qualified post URL for the "Try Again" button
  const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
  console.log("Generated post URL for error frame:", postUrl);
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Error - Account Scanner</title>
        <meta property="og:title" content="Error" />
        <meta property="og:description" content="${errorMessage}" />
        <meta property="og:image" content="${errorImageUrl}" />
        
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${errorImageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Try Again" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:post_url" content="${postUrl}" />
      </head>
      <body style="background-color: #000000; color: #ffffff;">
        <h1>Error</h1>
        <p>${errorMessage}</p>
        <p><button onclick="location.href='${postUrl}'">Try Again</button></p>
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
export async function POST(request: NextRequest): Promise<Response> {
  console.log("Received POST request to frame");
  try {
    // Log full request information
    console.log("Request URL:", request.url);
    console.log("Request method:", request.method);
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));
    
    let requestBody;
    try {
      console.log("Parsing request body...");
      const clone = request.clone();
      requestBody = await request.json();
      
      // Also log the raw request text for debugging
      const rawBody = await clone.text();
      console.log("Raw request body:", rawBody);
      
      console.log("Request body received:", JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return errorFrame("Failed to parse request body. This may indicate a malformed request.");
    }
    
    // Verify untrustedData exists
    if (!requestBody || !requestBody.untrustedData) {
      console.error("Request body missing untrustedData:", JSON.stringify(requestBody));
      return errorFrame("Invalid request format: missing untrustedData");
    }
    
    const { untrustedData } = requestBody;
    console.log("untrustedData:", JSON.stringify(untrustedData, null, 2));
    
    const buttonIndex = untrustedData?.buttonIndex || 1;
    const fid = untrustedData?.fid;
    
    console.log(`Button ${buttonIndex} pressed by user with FID:`, fid);
    console.log("FID type:", typeof fid);
    
    // If no FID is provided, use a placeholder for testing or return an error
    if (!fid) {
      console.error("Missing FID in request");
      return errorFrame("Missing FID in request. This may happen if you're testing outside of a Farcaster client.");
    }
    
    // Check for required environment variables
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    const mbdApiKey = process.env.MBD_API_KEY;
    
    if (!neynarApiKey) {
      console.error("NEYNAR_API_KEY is missing");
      return errorFrame("Server configuration error: Missing API key");
    }
    
    if (!mbdApiKey) {
      console.error("MBD_API_KEY is missing");
      return errorFrame("Server configuration error: Missing API key");
    }
    
    console.log("Required API keys are present");
    
    // Always start scanning when a button is clicked from the start frame
    console.log("Starting scanning process for FID:", fid);
    
    // Convert FID to number safely, regardless of input type
    let fidNumber: number;
    if (typeof fid === 'string') {
      console.log("Converting string FID to number:", fid);
      fidNumber = parseInt(fid, 10);
      if (isNaN(fidNumber)) {
        console.error("Failed to parse FID as number:", fid);
        return errorFrame(`Invalid FID format: ${fid}. FID must be a number.`);
      }
      console.log("Converted FID to number:", fidNumber);
    } else if (typeof fid === 'number') {
      fidNumber = fid;
    } else {
      console.error("Unsupported FID type:", typeof fid, fid);
      return errorFrame(`Invalid FID type: ${typeof fid}. FID must be a number.`);
    }
    
    return scanningFrame(fidNumber);
  } catch (error) {
    console.error("Error processing POST request:", error);
    
    // Create a detailed error message
    let errorMessage = "Failed to process your request";
    if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
      console.error("Stack trace:", error.stack);
    }
    
    // Log any additional details that might help debugging
    console.error("Request URL:", request.url);
    console.error("Request method:", request.method);
    console.error("Request headers:", Object.fromEntries(request.headers.entries()));
    
    return errorFrame(errorMessage);
  }
} 