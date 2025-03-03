import { NextRequest, NextResponse } from 'next/server';
import { getFollowing } from '@/lib/farcaster';
import { getModerationFlags } from '@/lib/moderation';

interface FrameMessage {
  trustedData?: {
    messageBytes?: string;
  };
  untrustedData?: {
    fid?: number;
    buttonIndex?: number;
  };
}

export async function POST(req: NextRequest) {
  // Set the base URL - hardcode the production URL to ensure it works
  const baseUrl = "https://bot-unfollower.vercel.app";
    
  let data;
  try {
    data = await req.json();
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  
  // Validate the Frame message
  const { isValid } = await validateFrameMessage(data);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid frame message' }, { status: 400 });
  }

  // Extract the FID from the Frame data
  const fid = data?.untrustedData?.fid;
  if (!fid) {
    return NextResponse.json({ error: 'Missing FID' }, { status: 400 });
  }

  // Get the button index to determine which action to take
  const buttonIndex = data?.untrustedData?.buttonIndex || 1;
  
  try {
    // If this is the initial scan button click
    if (buttonIndex === 1) {
      // Show scanning in progress screen
      return NextResponse.json({
        frames: {
          version: '1',
          image: `${baseUrl}/assets/scanning-complete.png`,
          buttons: [
            {
              label: 'View Results',
              action: 'post'
            }
          ],
          post_url: `${baseUrl}/api/frame`
        }
      });
    } 
    // If this is the "View Results" button click
    else if (buttonIndex === 2) {
      // Get the list of accounts the user follows
      console.log(`Getting following list for FID ${fid}...`);
      const followingList = await getFollowing(parseInt(fid.toString(), 10));
      
      if (!followingList || followingList.length === 0) {
        return NextResponse.json({
          frames: {
            version: '1',
            image: `${baseUrl}/assets/no-following.png`,
            buttons: [
              {
                label: 'Scan Again',
                action: 'post'
              }
            ],
            post_url: `${baseUrl}/api/frame`
          }
        });
      }
      
      console.log(`User follows ${followingList.length} accounts. Checking for moderation flags...`);
      
      // Extract FIDs from the following list
      const followingFids = followingList.map(user => user.fid?.toString()).filter(Boolean);
      
      // Check moderation flags for all following accounts
      const moderationResults = await getModerationFlags(followingFids);
      
      // Filter for flagged accounts only
      const flaggedAccounts = Object.values(moderationResults)
        .filter(result => result.flags.isFlagged);
      
      // Return the results frame
      return NextResponse.json({
        frames: {
          version: '1',
          image: `${baseUrl}/assets/scanning-complete.png`,
          buttons: [
            {
              label: `${flaggedAccounts.length} Bots Found`,
              action: 'link',
              target: `${baseUrl}/results?fid=${fid}`
            },
            {
              label: 'Scan Again',
              action: 'post'
            }
          ],
          post_url: `${baseUrl}/api/frame`
        }
      });
    }
    // If this is the "Scan Again" button click or any other button
    else {
      // Return to the initial frame
      return NextResponse.json({
        frames: {
          version: '1',
          image: `${baseUrl}/assets/scanner-start.png`,
          buttons: [
            {
              label: 'Scan My Following List',
              action: 'post'
            }
          ],
          post_url: `${baseUrl}/api/frame`
        }
      });
    }
  } catch (error) {
    console.error('Error processing frame action:', error);
    
    // Return an error frame
    return NextResponse.json({
      frames: {
        version: '1',
        image: `${baseUrl}/assets/error.png`,
        buttons: [
          {
            label: 'Try Again',
            action: 'post'
          }
        ],
        post_url: `${baseUrl}/api/frame`
      }
    });
  }
}

export async function GET() {
  // Set the base URL - hardcode the production URL to ensure it works
  const baseUrl = "https://bot-unfollower.vercel.app";
  
  // Use a proper image - either from our assets or a placeholder if not available
  const imageUrl = `${baseUrl}/assets/scanner-start.png`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Bot Scanner Frame</title>
        <meta property="og:title" content="Bot Scanner Frame" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="fc:frame" content="1" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:button:1" content="Scan My Following List" />
        <meta property="fc:frame:post_url" content="${baseUrl}/api/frame" />
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