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

  // Return the next frame state - redirect to the scanning process
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
      // Use the correct post_url that points to our API
      post_url: `${baseUrl}/api/frame`
    }
  });
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