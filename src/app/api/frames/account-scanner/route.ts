import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';

// Base URL for the app (update for production)
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

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
 * Initial frame that prompts the user to start scanning
 */
function startFrame() {
  const imageUrl = `${BASE_URL}/api/generate-start-image`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Account Scanner - Farcaster Frame</title>
        <meta property="og:title" content="Account Scanner" />
        <meta property="og:description" content="Scan your following list for potentially problematic accounts" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="theme-color" content="#000000" />

        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Scan My Following List" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:target" content="_self" />
        <meta property="fc:frame:post_url" content="${BASE_URL}/api/frames/account-scanner?step=scanning" />
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
    // Get the user's following list
    const followingList = await getFollowing(parseInt(fid, 10));
    
    if (!followingList || followingList.length === 0) {
      const noFollowingImageUrl = `${BASE_URL}/api/generate-error-image`;
      
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
            <meta property="fc:frame:post_url" content="${BASE_URL}/api/frames/account-scanner" />
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
    const scanningImageUrl = `${BASE_URL}/api/generate-scanning-image?fid=${fid}`;
    
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
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frames/account-scanner?step=results&fid=${fid}&count=${flaggedCount}" />
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
  } catch (error) {
    console.error("Error during scanning:", error);
    return errorFrame("Error scanning your following list");
  }
}

/**
 * Frame that shows the results of the scan
 */
function resultsFrame(fid: string, countStr: string) {
  const count = parseInt(countStr, 10);
  
  // Use different image based on whether we found flagged accounts
  const imageUrl = count > 0
    ? `${BASE_URL}/api/generate-scanner-image?fid=${fid}&count=${count}`
    : `${BASE_URL}/api/generate-scanner-image/no-flagged?fid=${fid}`;
  
  const buttonText = count > 0
    ? "View Detailed Report" 
    : "Done";
  
  const buttonUrl = count > 0
    ? `${BASE_URL}/report?fid=${fid}`
    : `${BASE_URL}/api/frames/account-scanner`;
  
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
  const errorImageUrl = `${BASE_URL}/api/generate-error-image`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Error - Account Scanner</title>
        <meta property="og:title" content="Error" />
        <meta property="og:description" content="${message}" />
        <meta property="og:image" content="${errorImageUrl}" />
        <meta name="theme-color" content="#000000" />

        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${errorImageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
        <meta property="fc:frame:button:1" content="Try Again" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:target" content="_self" />
        <meta property="fc:frame:post_url" content="${BASE_URL}/api/frames/account-scanner" />
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