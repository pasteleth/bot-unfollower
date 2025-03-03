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
  // Set the base URL from environment variables or default to localhost
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
    
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
      version: 'vNext',
      image: `${baseUrl}/assets/scanning-complete.png`,
      buttons: [
        {
          label: 'View Results',
          action: 'post'
        }
      ],
      // Direct the user to the results page after scanning
      post_url: `${baseUrl}/frames/account-scanner?step=results&fid=${fid}&count=5`
    }
  });
}

export async function GET(request: NextRequest) {
  // Set the base URL from environment variables or default to localhost
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_HOST || "http://localhost:3000";
  
  // Use a proper image - either from our assets or a placeholder if not available
  const imageUrl = `${baseUrl}/assets/scanner-start.png`;
  
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:button:1" content="Scan My Following List" />
        <meta property="fc:frame:post_url" content="${baseUrl}/frames/account-scanner?step=scanning" />
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