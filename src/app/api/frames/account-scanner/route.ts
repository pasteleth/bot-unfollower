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
    <!-- Preconnect to Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <!-- Load Inter font with multiple weights -->
    <link rel="stylesheet" href="${getInterCssUrl()}" />
    <style>
      /* Define font variables */
      :root {
        --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      /* Apply fonts globally */
      body {
        font-family: var(--font-sans);
        background-color: #000000;
        color: #ffffff;
        margin: 0;
        padding: 0;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-sans);
        font-weight: 700;
      }
      
      p, span, div {
        font-family: var(--font-sans);
        font-weight: 400;
      }
    </style>
  </head>
  <body>
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
          // Use direct HTML content instead of generated image for empty following list
          const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
          
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <title>No Following Found - Account Scanner</title>
                <meta property="og:title" content="No Following Found" />
                <meta property="og:description" content="We couldn't find any accounts you're following" />
                
                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:button:1" content="Try Again" />
                <meta property="fc:frame:button:1:action" content="post" />
                <meta property="fc:frame:post_url" content="${postUrl}" />
                
                <!-- Load Inter font with multiple weights -->
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
              </head>
              <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
                <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: #ff4040;">No Following Found</h1>
                <p style="font-size: 24px; margin-bottom: 30px;">We couldn't find any accounts you're following.</p>
                <div style="padding: 20px; border-radius: 12px; background-color: rgba(255, 64, 64, 0.1); border: 1px solid rgba(255, 64, 64, 0.2); max-width: 600px;">
                  <p style="font-size: 18px; color: #ff8080;">This could be due to API limitations or because your account is new.</p>
                </div>
              </body>
            </html>`,
            {
              headers: {
                "Content-Type": "text/html",
              },
            }
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
        
        if (userIds.length === 0) {
          console.warn('No valid user IDs found after processing following list');
          // Use direct HTML content instead of generated image
          const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner`);
          
          return new Response(
            `<!DOCTYPE html>
            <html>
              <head>
                <title>No Valid Accounts Found - Account Scanner</title>
                <meta property="og:title" content="No Valid Accounts Found" />
                <meta property="og:description" content="We couldn't find any valid accounts you're following" />
                
                <meta property="fc:frame" content="vNext" />
                <meta property="fc:frame:button:1" content="Try Again" />
                <meta property="fc:frame:button:1:action" content="post" />
                <meta property="fc:frame:post_url" content="${postUrl}" />
                
                <!-- Load Inter font with multiple weights -->
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
              </head>
              <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
                <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: #ff4040;">No Valid Accounts Found</h1>
                <p style="font-size: 24px; margin-bottom: 30px;">We couldn't find any valid accounts you're following.</p>
                <div style="padding: 20px; border-radius: 12px; background-color: rgba(255, 64, 64, 0.1); border: 1px solid rgba(255, 64, 64, 0.2); max-width: 600px;">
                  <p style="font-size: 18px; color: #ff8080;">This could be due to API limitations or because your account is new.</p>
                </div>
              </body>
            </html>`,
            {
              headers: {
                "Content-Type": "text/html",
              },
            }
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
              
              <meta property="fc:frame" content="vNext" />
              <meta property="fc:frame:button:1" content="See Results" />
              <meta property="fc:frame:button:1:action" content="post" />
              <meta property="fc:frame:post_url" content="${postUrl}" />
              
              <!-- Load Inter font with multiple weights -->
              <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
            </head>
            <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
              <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: #4caf50;">Scanning Complete</h1>
              <p style="font-size: 24px; margin-bottom: 30px;">We've analyzed your following list.</p>
              <div style="display: flex; align-items: center; justify-content: center; width: 200px; height: 200px; border-radius: 50%; background-color: rgba(76, 175, 80, 0.1); margin-bottom: 30px;">
                <div style="font-size: 72px; font-weight: 700; color: #4caf50;">${flaggedCount}</div>
              </div>
              <p style="font-size: 20px; color: #aaaaaa;">
                ${flaggedCount === 0 
                  ? "Great news! No problematic accounts found." 
                  : `Found ${flaggedCount} potentially problematic account${flaggedCount === 1 ? '' : 's'}.`}
              </p>
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

    // Race the scanning process against the timeout
    const result = await Promise.race<Response | null>([
      scanningPromise(),
      new Promise<null>(resolve => setTimeout(() => {
        timeoutReached = true;
        resolve(null);
      }, 3000))
    ]);
    
    // Clear the timeout since we won't need it anymore
    clearTimeout(timeout);
    
    if (timeoutReached) {
      // Return a scanning in progress frame with HTML instead of image
      // Construct a fully qualified post URL for the frame
      const scanningParam = `step=scanning&fid=${formatFidForUrl(fidNumber)}`;
      const postUrl = addProtectionBypass(`${BASE_URL}/api/frames/account-scanner?${scanningParam}`);
      console.log("Generated post URL for scanning in progress frame:", postUrl);
      
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Scanning in Progress - Account Scanner</title>
            <meta property="og:title" content="Scanning in Progress" />
            <meta property="og:description" content="We're scanning your following list" />
            
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:button:1" content="Continue Scanning" />
            <meta property="fc:frame:button:1:action" content="post" />
            <meta property="fc:frame:post_url" content="${postUrl}" />
            
            <!-- Load Inter font with multiple weights -->
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
          </head>
          <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
            <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: #2196f3;">Scanning in Progress</h1>
            <p style="font-size: 24px; margin-bottom: 30px;">We're analyzing your following list for potentially problematic accounts.</p>
            <div style="width: 60px; height: 60px; border: 5px solid rgba(33, 150, 243, 0.3); border-radius: 50%; border-top-color: #2196f3; animation: spin 1s linear infinite; margin-bottom: 30px;"></div>
            <p style="font-size: 20px; color: #aaaaaa;">This may take a moment to complete.</p>
            
            <style>
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
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
  let buttonText = '';
  let buttonUrl = '';
  let hasActionButton = true;
  
  try {
    if (count > 0) {
      message = `We found ${count} potentially problematic account${count === 1 ? '' : 's'} in your following list`;
      buttonText = 'View Detailed Report';
      
      // Construct a fully qualified URL without protection param for validators
      const reportParams = `fid=${formatFidForUrl(fid)}&count=${count}`;
      buttonUrl = `${BASE_URL}/report?${reportParams}`;
      console.log("Generated report button URL:", buttonUrl);
    } else {
      message = "Great news! We didn't find any potentially problematic accounts in your following list";
      buttonText = 'Start New Scan';
      
      // Construct fully qualified URL for restart without protection param for validators
      buttonUrl = `${BASE_URL}/api/frames/account-scanner`;
      console.log("Generated restart button URL:", buttonUrl);
    }
  } catch (error) {
    console.error("Error preparing results frame:", error);
    message = "Error preparing results";
    hasActionButton = false;
  }
  
  // Construct post URL without protection param for validators
  const postUrl = `${BASE_URL}/api/frames/account-scanner`;
  console.log("Generated post URL for results frame:", postUrl);
  
  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <title>Results - Account Scanner</title>
    <meta property="og:title" content="Scan Results" />
    <meta property="og:description" content="${message}" />
    <meta property="fc:frame" content="vNext" />
    ${hasActionButton ? `
    <meta property="fc:frame:button:1" content="${buttonText}" />
    ${buttonText === 'View Detailed Report' 
      ? `<meta property="fc:frame:button:1:action" content="link" />
    <meta property="fc:frame:button:1:target" content="${buttonUrl}" />`
      : `<meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />`
    }` : ''}
    <meta property="fc:frame:button:2" content="Scan Again" />
    <meta property="fc:frame:button:2:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
    <!-- Load Inter font with multiple weights -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
  </head>
  <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
    <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: ${count > 0 ? '#ff9800' : '#4caf50'};">Scan Results</h1>
    <p style="font-size: 24px; margin-bottom: 30px;">${message}</p>
    ${count > 0 ? `
    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 30px;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: rgba(255, 152, 0, 0.1); border-radius: 12px; padding: 20px; width: 160px;">
        <span style="font-size: 72px; font-weight: 700; color: #ff9800;">${count}</span>
        <span style="font-size: 18px; color: #aaaaaa;">Flagged</span>
      </div>
    </div>
    <p style="font-size: 20px; color: #aaaaaa;">Click "${buttonText}" to see detailed information</p>
    ` : `
    <div style="display: flex; align-items: center; justify-content: center; width: 200px; height: 200px; border-radius: 50%; background-color: rgba(76, 175, 80, 0.1); margin-bottom: 30px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </div>
    <p style="font-size: 20px; color: #aaaaaa;">Your following list looks clean!</p>
    `}
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
function errorFrame(errorMessage: string = "An error occurred"): Response {
  console.error("Showing error frame:", errorMessage);
  
  // Log error stack for debugging
  console.error("Error details:", new Error().stack);
  
  // Construct a fully qualified post URL without protection param for validators
  const postUrl = `${BASE_URL}/api/frames/account-scanner`;
  console.log("Generated post URL for error frame:", postUrl);
  
  return new Response(
    `<!DOCTYPE html>
<html>
  <head>
    <title>Error - Account Scanner</title>
    <meta property="og:title" content="Error" />
    <meta property="og:description" content="${errorMessage}" />
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:button:1" content="Try Again" />
    <meta property="fc:frame:button:1:action" content="post" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
    <!-- Load Inter font with multiple weights -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" />
  </head>
  <body style="margin: 0; padding: 40px; background-color: #000000; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 630px; text-align: center;">
    <h1 style="font-size: 48px; font-weight: 700; margin-bottom: 20px; color: #f44336;">Error</h1>
    <p style="font-size: 24px; margin-bottom: 30px;">Something went wrong</p>
    <div style="padding: 20px; border-radius: 12px; background-color: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.2); max-width: 600px; margin-bottom: 30px;">
      <p style="font-size: 18px; color: #ff8080;">${errorMessage}</p>
    </div>
    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    <p style="font-size: 20px; color: #aaaaaa;">Click "Try Again" to restart the scanner</p>
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