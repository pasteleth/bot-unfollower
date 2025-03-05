import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate a sleek, modern Shadcn-style image for the scanner results
 */
export async function GET(request: NextRequest) {
  try {
    // Get parameters from the request URL
    const { searchParams } = new URL(request.url);
    const count = searchParams.get('count') || '0';
    const fid = searchParams.get('fid');

    if (!fid) {
      return new Response('Missing FID parameter', { status: 400 });
    }

    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Modern black background (shadcn style)
    ctx.fillStyle = '#000000'; // Pure black background
    ctx.fillRect(0, 0, width, height);

    // Add a subtle gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(113, 42, 255, 0.12)');  // Purple tint at top
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');    // Nearly black at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add decorative elements
    drawModernGrid(ctx, width, height);

    // Set font styles - using system fonts that look clean and modern
    const titleFont = 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    const bodyFont = 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    
    // Title text
    ctx.font = `bold 48px ${titleFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Account Scanner Results', width / 2, 140);

    // Description
    ctx.font = `28px ${bodyFont}`;
    ctx.fillStyle = '#a1a1aa'; // Muted gray
    
    let messageText;
    if (count === '0') {
      messageText = "Good news! No problematic accounts found.";
    } else {
      messageText = `We found ${count} potentially problematic accounts.`;
    }
    ctx.fillText(messageText, width / 2, 200);

    // Add shadcn-style UI card
    drawCard(ctx, width / 2 - 300, 240, 600, 280);
    
    // Draw statistics box
    if (count !== '0') {
      const countNum = parseInt(count, 10);
      drawStatistics(ctx, countNum, width, 300, titleFont);
    } else {
      // Draw checkmark for clean result
      drawCheckmark(ctx, width / 2, 380, 80, titleFont);
    }

    // Draw modern app logo/branding
    drawLogo(ctx, 50, 50, 40);
    
    // Add FID label at bottom
    ctx.font = `16px ${bodyFont}`;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'left';
    ctx.fillText(`FID: ${fid}`, 50, height - 25);

    // Add timestamp
    const now = new Date();
    ctx.textAlign = 'right';
    ctx.fillText(now.toISOString().split('T')[0], width - 50, height - 25);

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Return the image
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'max-age=10',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}

/**
 * Draws a modern grid backdrop
 */
function drawModernGrid(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number) {
  // Draw grid lines with shadcn styling
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  // Vertical lines
  const vSpacing = 80;
  for (let x = vSpacing; x < width; x += vSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  const hSpacing = 80;
  for (let y = hSpacing; y < height; y += hSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Draw accent circles - shadcn style
  ctx.fillStyle = 'rgba(113, 42, 255, 0.15)'; // Purple accent
  ctx.beginPath();
  ctx.arc(width - 200, 150, 180, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'rgba(113, 42, 255, 0.07)';
  ctx.beginPath();
  ctx.arc(150, height - 120, 100, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a shadcn-style card
 */
function drawCard(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  // Card background
  ctx.fillStyle = 'rgba(22, 22, 22, 0.8)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  // Draw rounded rectangle
  const radius = 8;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.fill();
  ctx.stroke();
}

/**
 * Draws statistics in the card
 */
function drawStatistics(ctx: import('canvas').CanvasRenderingContext2D, count: number, width: number, y: number, titleFont: string) {
  // Main count
  ctx.font = `bold 80px ${titleFont}`;
  ctx.fillStyle = 'rgba(113, 42, 255, 0.9)'; // Purple for count
  ctx.textAlign = 'center';
  ctx.fillText(count.toString(), width / 2, y + 80);
  
  // Label
  ctx.font = `bold 24px ${titleFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Potentially Harmful Accounts', width / 2, y + 130);
  
  // Decorative bar
  ctx.fillStyle = 'rgba(113, 42, 255, 0.7)';
  const barWidth = 120;
  ctx.fillRect(width / 2 - barWidth / 2, y + 150, barWidth, 4);
  
  // Action text
  ctx.font = `20px ${titleFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('Tap "View Detailed Report" to see more', width / 2, y + 190);
}

/**
 * Draws a checkmark for clean results
 */
function drawCheckmark(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number, titleFont: string) {
  ctx.strokeStyle = '#10b981'; // Green color for success
  ctx.lineWidth = size / 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  ctx.beginPath();
  // Draw checkmark
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x - size / 6, y + size / 2);
  ctx.lineTo(x + size / 2, y - size / 3);
  ctx.stroke();
  
  // Add circle around checkmark
  ctx.beginPath();
  ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.stroke();
  
  // Add success text
  ctx.font = `bold 28px ${titleFont}`;
  ctx.fillStyle = '#10b981';
  ctx.textAlign = 'center';
  ctx.fillText('All Clear!', x, y + size + 30);
}

/**
 * Draws a modern logo
 */
function drawLogo(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Logo background
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Logo border
  ctx.strokeStyle = 'rgba(113, 42, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  
  // Logo symbol - shield with eye
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + size * 0.25);
  ctx.lineTo(x + size * 0.75, y + size * 0.35);
  ctx.lineTo(x + size * 0.65, y + size * 0.75);
  ctx.lineTo(x + size / 2, y + size * 0.85);
  ctx.lineTo(x + size * 0.35, y + size * 0.75);
  ctx.lineTo(x + size * 0.25, y + size * 0.35);
  ctx.closePath();
  ctx.fillStyle = 'rgba(113, 42, 255, 0.9)';
  ctx.fill();
  
  // Eye
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 6, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  
  // App name
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('Bot Scanner', x + size + 10, y + size / 2 + 7);
} 