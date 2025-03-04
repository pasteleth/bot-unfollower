import { Frog } from 'frog';
import { handle } from 'frog/next';
import { getModerationFlags } from '@/lib/moderation';
import { getFollowing } from '@/lib/farcaster';
import { NextRequest, NextResponse } from 'next/server';

interface FrameMessage {
  trustedData?: {
    messageBytes?: string;
  };
  untrustedData?: {
    fid?: number;
    buttonIndex?: number;
  };
}

// Create a new Frog instance
const app = new Frog({
  assetsPath: '/api',
  basePath: '/api',
});

// Define the main frame 
app.frame('/', (c) => {
  const { buttonValue, inputText, fid } = c;
  
  // Display different messages based on user interaction
  const message = buttonValue
    ? `You clicked: ${buttonValue}`
    : inputText
    ? `You entered: ${inputText}`
    : 'Welcome to Bot Unfollower Frame!';

  return c.res({
    image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/frame_image.png`,
    intents: [
      { type: 'button', value: 'scan', label: 'Scan My Following List' },
      { type: 'button', value: 'view', label: 'View Results' },
      { type: 'text_input', placeholder: 'Enter your FID' },
    ],
    text: message,
  });
});

// Handle the scan action - adding functionality from the original implementation
app.frame('/scan', async (c) => {
  const { fid } = c;
  
  if (!fid) {
    return c.res({
      image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/frame_image.png`,
      intents: [
        { type: 'button', value: 'retry', label: 'Try Again' },
      ],
      text: 'Could not determine your FID. Please try again.',
    });
  }

  try {
    // Get the user's following list
    const followingList = await getFollowing(fid);
    
    if (!followingList || followingList.length === 0) {
      return c.res({
        image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/frame_image.png`,
        intents: [
          { type: 'button', value: 'retry', label: 'Try Again' },
        ],
        text: 'No following found. Please try again.',
      });
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

    return c.res({
      image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/scanning-complete.png`,
      intents: [
        { type: 'button', value: 'results', label: 'View Results' },
      ],
      text: `Scanning complete! We found ${flaggedCount} potentially problematic accounts.`,
    });
  } catch (error) {
    console.error('Error during scanning:', error);
    return c.res({
      image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/frame_image.png`,
      intents: [
        { type: 'button', value: 'retry', label: 'Try Again' },
      ],
      text: 'Error scanning your following list. Please try again.',
    });
  }
});

// Handle viewing results
app.frame('/results', (c) => {
  const { fid, inputText } = c;
  const countParam = c.frameData?.timestamp?.toString() || "0";
  const count = parseInt(countParam, 10);
  
  return c.res({
    image: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/results.png`,
    intents: [
      { type: 'button', value: 'detail', label: 'View Detailed Report' },
      { type: 'button', value: 'restart', label: 'Start New Scan' },
    ],
    text: `Found ${count} potentially problematic accounts. Click to view details.`,
  });
});

// Base URL for the app
const BASE_URL = process.env.NODE_ENV === 'production'
  ? "https://bot-unfollower.vercel.app" 
  : "http://localhost:3000";

/**
 * Redirect to the account-scanner frame
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(`${BASE_URL}/api/frames/account-scanner`);
}

/**
 * Handle POST requests for backward compatibility 
 */
export async function POST(request: NextRequest) {
  return NextResponse.redirect(`${BASE_URL}/api/frames/account-scanner`);
}

async function validateFrameMessage(message: FrameMessage) {
  try {
    if (!message?.trustedData?.messageBytes) {
      return { isValid: false };
    }
    return { isValid: true };
  } catch {
    return { isValid: false };
  }
} 