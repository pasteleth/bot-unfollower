import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate a modern Shadcn-style image for the scanner results
 * This version is for when no flagged accounts are found
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the request URL
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');

    if (!fid) {
      return new Response('Missing FID parameter', { status: 400 });
    }

    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Modern dark background
    ctx.fillStyle = '#09090B'; // Shadcn dark background
    ctx.fillRect(0, 0, width, height);

    // Add a subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.1)');  // Green tint at top
    gradient.addColorStop(1, 'rgba(24, 24, 27, 0.8)');   // Darker at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add decorative elements
    drawModernGrid(ctx, width, height);

    // Set font styles - using system fonts that are similar to Shadcn style
    const titleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const bodyFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    
    // Title text
    ctx.font = `bold 48px ${titleFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Account Scanner Results', width / 2, 140);

    // Description
    ctx.font = `28px ${bodyFont}`;
    ctx.fillStyle = '#a1a1aa'; // Muted gray
    ctx.fillText('Great news! We did not find any potentially', width / 2, 200);
    ctx.fillText('problematic accounts in your following list', width / 2, 240);

    // Draw check mark circle
    const centerX = width / 2;
    const centerY = height / 2 + 20;
    const size = 100;
    
    // Circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'; // Translucent green
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#22c55e'; // Green
    ctx.lineWidth = 6;
    ctx.stroke();
    
    // Check mark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(centerX - 40, centerY);
    ctx.lineTo(centerX - 10, centerY + 30);
    ctx.lineTo(centerX + 40, centerY - 30);
    ctx.stroke();

    // Call to action
    ctx.font = `bold 32px ${bodyFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Your following list looks clean!', width / 2, height - 150);

    // Footer text
    ctx.font = `18px ${bodyFont}`;
    ctx.fillStyle = '#71717a'; // Subtle gray
    ctx.fillText('Powered by MBD Moderation API', width / 2, height - 80);

    // Convert canvas to PNG Buffer
    const buffer = canvas.toBuffer('image/png');

    // Return the image with appropriate headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}

/**
 * Draw a modern grid background pattern
 */
function drawModernGrid(ctx: any, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  // Draw horizontal lines
  const gridSpacing = 30;
  for (let y = gridSpacing; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Draw some vertical lines, but not everywhere (for style)
  for (let x = gridSpacing; x < width; x += gridSpacing * 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
} 