import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';

// Base URL for the app (update for production)
const BASE_URL = process.env.NEXT_PUBLIC_HOST || 
  (process.env.NODE_ENV === 'production' ? "https://bot-unfollower.vercel.app" :
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));

// Protection bypass key for Vercel
const PROTECTION_BYPASS = "fdhsgioepfdgoissdifhiuads848hsdi";

// Version for cache busting
const VERSION = Date.now().toString();

/**
 * State-driven Frame implementation for scanning follows
 */
export async function GET(request: NextRequest) {
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
        return resultsFrame(fid, count);
      
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
  return `${url}${url.includes('?') ? '&' : '?'}x-vercel-protection-bypass=${PROTECTION_BYPASS}&v=${VERSION}`;
}

/**
 * Initial frame that prompts the user to start scanning
 */
function startFrame() {
  const imageUrl = addProtectionBypass(`${BASE_URL}/api/generate-start-image`);
  
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
        <meta property="fc:frame:button:1:target" content="_self" />
        <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?step=scanning`)}" />
      </head>
      <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
async function scanningFrame(fid: string) {
  try {
    // Set up a timeout to ensure we respond within Farcaster's 5-second limit
    let timeoutReached = false;
    const timeout = setTimeout(() => {
      timeoutReached = true;
    }, 3000); // 3 second timeout to leave room for processing

    // Start the actual scanning process
    const scanningPromise = async () => {
      // Get the user's following list
      const followingList = await getFollowing(parseInt(fid, 10));
      
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
            <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
      const userIds = followingList.map(user => user.fid.toString());
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

      // Scanning complete image
      const scanningImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-scanning-image?fid=${fid}`);
      
      // Redirect to results with the count
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Scanning Complete - Account Scanner</title>
            <meta property="og:title" content="Scanning Complete" />
            <meta property="og:description" content="We found ${flaggedCount} potentially problematic accounts" />
            <meta property="og:image" content="${scanningImageUrl}" />
            <meta name="theme-color" content="#000000" />

            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${scanningImageUrl}" />
            <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
            <meta property="fc:frame:button:1" content="View Results" />
            <meta property="fc:frame:button:1:action" content="post" />
            <meta property="fc:frame:button:1:target" content="_self" />
            <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?step=results&fid=${fid}&count=${flaggedCount}`)}" />
          </head>
          <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <h1>Scanning Complete</h1>
            <p>We found ${flaggedCount} potentially problematic accounts.</p>
          </body>
        </html>`,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    };

    // Race the scanning process against the timeout
    const scanningPromiseResult = scanningPromise();
    
    // Wait for either the scanning to complete or the timeout to be reached
    await Promise.race([
      scanningPromiseResult,
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    clearTimeout(timeout);
    
    // If the timeout was reached, return an interim response
    if (timeoutReached) {
      console.log("Timeout reached, returning interim response");
      // Return a response indicating scanning is in progress
      const scanningImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-scanning-image?fid=${fid}`);
      
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Scanning in Progress - Account Scanner</title>
            <meta property="og:title" content="Scanning in Progress" />
            <meta property="og:description" content="We're scanning your following list..." />
            <meta property="og:image" content="${scanningImageUrl}" />
            <meta name="theme-color" content="#000000" />

            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${scanningImageUrl}" />
            <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
            <meta property="fc:frame:button:1" content="Check Again" />
            <meta property="fc:frame:button:1:action" content="post" />
            <meta property="fc:frame:button:1:target" content="_self" />
            <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?step=scanning&fid=${fid}`)}" />
          </head>
          <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <h1>Scanning in Progress</h1>
            <p>Your following list is being scanned. Please check again in a moment.</p>
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
    return await scanningPromiseResult;
  } catch (error) {
    console.error("Error during scanning:", error);
    return errorFrame("Error scanning your following list: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Frame that shows the results of the scan
 */
function resultsFrame(fid: string, countStr: string) {
  const count = parseInt(countStr, 10);
  
  // Use different image based on whether we found flagged accounts
  const imageUrl = count > 0
    ? addProtectionBypass(`${BASE_URL}/api/generate-scanner-image?fid=${fid}&count=${count}`)
    : addProtectionBypass(`${BASE_URL}/api/generate-scanner-image/no-flagged?fid=${fid}`);
  
  const buttonText = count > 0
    ? "View Detailed Report" 
    : "Done";
  
  const buttonUrl = count > 0
    ? addProtectionBypass(`${BASE_URL}/report?fid=${fid}`)
    : addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Account Scanner Results</title>
        <meta property="og:title" content="Account Scanner Results" />
        <meta property="og:description" content="We found ${count} potentially problematic accounts you're following" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="theme-color" content="#000000" />

        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="${buttonText}" />
        <meta property="fc:frame:button:1:action" content="post_redirect" />
        <meta property="fc:frame:button:1:target" content="_blank" />
        <meta property="fc:frame:post_url" content="${buttonUrl}" />
      </head>
      <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <h1>Account Scanner Results</h1>
        <p>We found ${count} potentially problematic accounts you're following.</p>
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
 * Frame to display errors
 */
function errorFrame(message: string) {
  const errorImageUrl = addProtectionBypass(`${BASE_URL}/api/generate-error-image?message=${encodeURIComponent(message)}`);
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Error - Account Scanner</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta property="og:title" content="Error" />
        <meta property="og:description" content="${message}" />
        <meta property="og:image" content="${errorImageUrl}" />
        <meta name="theme-color" content="#000000" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Error - Account Scanner" />
        <meta name="twitter:description" content="${message}" />
        <meta name="twitter:image" content="${errorImageUrl}" />

        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${errorImageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Try Again" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:target" content="_self" />
        <meta property="fc:frame:post_url" content="${addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`)}" />
      </head>
      <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <h1>Error</h1>
        <p>${message}</p>
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
export async function POST(request: NextRequest) {
  console.log("POST request received for account-scanner");
  try {
    console.log("Parsing request body...");
    const body = await request.json();
    console.log("Request body received:", JSON.stringify(body).substring(0, 200) + "...");
    
    const { untrustedData } = body;
    console.log("untrustedData:", JSON.stringify(untrustedData));
    
    const buttonIndex = untrustedData?.buttonIndex || 1;
    const fid = untrustedData?.fid;
    
    console.log(`Button ${buttonIndex} pressed by user with FID: ${fid}`);
    
    if (!fid) {
      console.error("Missing FID in request");
      return errorFrame("Missing FID in request");
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
    
    // Determine the step based on the button pressed
    const step = buttonIndex === 1 ? 'scanning' : 'start';
    console.log(`Moving to step: ${step}`);
    
    // For direct response, use the appropriate frame function
    if (step === 'scanning') {
      console.log("Starting scanning process for FID:", fid);
      return scanningFrame(fid.toString());
    } else {
      console.log("Returning to start frame");
      return startFrame();
    }
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