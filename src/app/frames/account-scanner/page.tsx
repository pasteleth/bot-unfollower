import { NextRequest } from 'next/server';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';

// Moderation thresholds for flagging users
const MODERATION_THRESHOLDS = {
  spam: 0.5,
  ai_generated: 0.9,
  sexual: 0.5,
  hate: 0.5,
  violence: 0.5,
  harassment: 0.5,
  selfharm: 0.5,
  sexual_minors: 0.25,
  hate_threatening: 0.4,
  violence_graphic: 0.4
};

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
  const imageUrl = `${BASE_URL}/assets/scanner-start.png`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:button:1" content="Scan My Following List" />
        <meta property="fc:frame:post_url" content="${BASE_URL}/frames/account-scanner?step=scanning" />
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
async function scanningFrame(fid: string) {
  try {
    // Get the user's following list
    const followingList = await getFollowing(parseInt(fid, 10));
    
    if (!followingList || followingList.length === 0) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${BASE_URL}/assets/no-following.png" />
            <meta property="fc:frame:button:1" content="Try Again" />
            <meta property="fc:frame:post_url" content="${BASE_URL}/frames/account-scanner" />
          </head>
          <body>
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

    // Redirect to results with the count
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/assets/scanning-complete.png" />
          <meta property="fc:frame:button:1" content="View Results" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/frames/account-scanner?step=results&fid=${fid}&count=${flaggedCount}" />
        </head>
        <body>
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
    : `${BASE_URL}/frames/account-scanner`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:button:1" content="${buttonText}" />
        <meta property="fc:frame:post_url" content="${buttonUrl}" />
      </head>
      <body>
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
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${BASE_URL}/assets/error.png" />
        <meta property="fc:frame:button:1" content="Try Again" />
        <meta property="fc:frame:post_url" content="${BASE_URL}/frames/account-scanner" />
      </head>
      <body>
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

// Export a default component for client-side rendering (needed for App Router)
export default function AccountScannerPage() {
  return (
    <div>
      <h1>Account Scanner Frame</h1>
      <p>This page provides a Farcaster Frame that scans following lists.</p>
      <p>To use this frame, embed it in a Farcaster post.</p>
    </div>
  );
} 