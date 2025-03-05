import { NextRequest } from 'next/server';
import { createCanvas, registerFont } from 'canvas';
import path from 'path';

// Register the Inter variable fonts
try {
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-VariableFont_opsz,wght.ttf'), {
    family: 'Inter',
    weight: '400',
  });
  registerFont(path.resolve(process.cwd(), 'public/fonts/Inter-VariableFont_opsz,wght.ttf'), {
    family: 'Inter',
    weight: '700',
  });
  console.log('✅ Fonts loaded successfully!');
} catch (e) {
  console.error('❌ Font loading error:', e);
}

/**
 * Generate an image for the scanning frame that shows scanning is in progress
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the request URL
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const message = searchParams.get('message');

    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Plain black background (#000000)
    ctx.fillStyle = '#000000'; // Pure black background
    ctx.fillRect(0, 0, width, height);
    
    // Add text to the image
    // Title
    ctx.fillStyle = '#ffffff'; // White color
    ctx.font = 'bold 64px "Inter", Arial, sans-serif'; // Use Inter with fallbacks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Scanning in progress...', width / 2, height / 3);
    
    // Description
    ctx.fillStyle = '#cccccc'; // Light gray color
    ctx.font = '36px "Inter", Arial, sans-serif'; // Use Inter with fallbacks
    
    // Change text based on whether FID is available
    if (fid) {
      ctx.fillText(`Checking following list for account ${fid}`, width / 2, height / 2);
    } else {
      ctx.fillText('Checking your following list for potential bots', width / 2, height / 2);
    }
    
    // Loading indicator text
    ctx.fillStyle = '#999999'; // Medium gray color
    ctx.font = '24px "Inter", Arial, sans-serif'; // Use Inter with fallbacks
    ctx.fillText('This may take a few moments', width / 2, height / 1.5);
    
    // Custom instruction message (if provided)
    if (message) {
      ctx.fillStyle = '#FF9900'; // Orange color for emphasis
      ctx.font = 'bold 28px "Inter", Arial, sans-serif'; // Use Inter with fallbacks
      ctx.fillText(decodeURIComponent(message), width / 2, height / 1.25);
    }
    
    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Return the image
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating scanning image:', error);
    return new Response('Error generating image', { status: 500 });
  }
} 