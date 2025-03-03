import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate static frame images for the account scanner
 * This generates all the placeholder images needed for the frame flow
 */
export async function GET(request: NextRequest) {
  try {
    // Get the image type from the URL
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'start';
    
    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set up the base dark theme
    ctx.fillStyle = '#09090B'; // Shadcn dark background
    ctx.fillRect(0, 0, width, height);
    
    // Add decorative elements
    drawModernGrid(ctx, width, height);
    
    // Set font styles
    const titleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const bodyFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    
    // Choose the gradient and content based on type
    switch (type) {
      case 'start':
        drawStartFrame(ctx, width, height, titleFont, bodyFont);
        break;
      case 'error':
        drawErrorFrame(ctx, width, height, titleFont, bodyFont);
        break;
      case 'no-following':
        drawNoFollowingFrame(ctx, width, height, titleFont, bodyFont);
        break;
      case 'scanning-complete':
        drawScanningCompleteFrame(ctx, width, height, titleFont, bodyFont);
        break;
      default:
        drawStartFrame(ctx, width, height, titleFont, bodyFont);
    }

    // Convert canvas to PNG Buffer
    const buffer = canvas.toBuffer('image/png');

    // Return the image with appropriate headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}

/**
 * Draw the start frame image
 */
function drawStartFrame(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number, titleFont: string, bodyFont: string) {
  // Purple gradient for start screen
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(111, 63, 245, 0.2)');  // Purple tint at top
  gradient.addColorStop(1, 'rgba(24, 24, 27, 0.8)');    // Darker at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Title
  ctx.font = `bold 48px ${titleFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Account Scanner', width / 2, 140);
  
  // Description
  ctx.font = `28px ${bodyFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('Scan your following list for potentially', width / 2, 200);
  ctx.fillText('problematic accounts', width / 2, 240);
  
  // Draw icon
  const centerX = width / 2;
  const centerY = height / 2 + 20;
  
  // Scanner icon
  drawScannerIcon(ctx, centerX, centerY, 80);
  
  // Call to action
  ctx.font = `bold 32px ${bodyFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Click to scan your following list', width / 2, height - 150);
  
  // Footer
  ctx.font = `18px ${bodyFont}`;
  ctx.fillStyle = '#71717a';
  ctx.fillText('Powered by MBD Moderation API', width / 2, height - 80);
}

/**
 * Draw the error frame image
 */
function drawErrorFrame(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number, titleFont: string, bodyFont: string) {
  // Red gradient for error screen
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(225, 29, 72, 0.2)');  // Red tint at top
  gradient.addColorStop(1, 'rgba(24, 24, 27, 0.8)');   // Darker at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Title
  ctx.font = `bold 48px ${titleFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Error', width / 2, 140);
  
  // Description
  ctx.font = `28px ${bodyFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('Something went wrong while scanning', width / 2, 200);
  ctx.fillText('your following list', width / 2, 240);
  
  // Draw icon
  const centerX = width / 2;
  const centerY = height / 2 + 20;
  
  // Error icon
  drawErrorIcon(ctx, centerX, centerY, 80);
  
  // Call to action
  ctx.font = `bold 32px ${bodyFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Click to try again', width / 2, height - 150);
  
  // Footer
  ctx.font = `18px ${bodyFont}`;
  ctx.fillStyle = '#71717a';
  ctx.fillText('Powered by MBD Moderation API', width / 2, height - 80);
}

/**
 * Draw the no following frame image
 */
function drawNoFollowingFrame(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number, titleFont: string, bodyFont: string) {
  // Blue gradient for no following screen
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');  // Blue tint at top
  gradient.addColorStop(1, 'rgba(24, 24, 27, 0.8)');    // Darker at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Title
  ctx.font = `bold 48px ${titleFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('No Following Found', width / 2, 140);
  
  // Description
  ctx.font = `28px ${bodyFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('We couldn\'t find any accounts', width / 2, 200);
  ctx.fillText('you\'re following', width / 2, 240);
  
  // Draw icon
  const centerX = width / 2;
  const centerY = height / 2 + 20;
  
  // Empty state icon
  drawEmptyStateIcon(ctx, centerX, centerY, 80);
  
  // Call to action
  ctx.font = `bold 32px ${bodyFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Click to try again', width / 2, height - 150);
  
  // Footer
  ctx.font = `18px ${bodyFont}`;
  ctx.fillStyle = '#71717a';
  ctx.fillText('Powered by MBD Moderation API', width / 2, height - 80);
}

/**
 * Draw the scanning complete frame image
 */
function drawScanningCompleteFrame(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number, titleFont: string, bodyFont: string) {
  // Teal gradient for scanning complete screen
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(20, 184, 166, 0.2)');  // Teal tint at top
  gradient.addColorStop(1, 'rgba(24, 24, 27, 0.8)');    // Darker at bottom
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Title
  ctx.font = `bold 48px ${titleFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Scanning Complete', width / 2, 140);
  
  // Description
  ctx.font = `28px ${bodyFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('We\'ve analyzed your following list', width / 2, 200);
  ctx.fillText('and have results ready for you', width / 2, 240);
  
  // Draw icon
  const centerX = width / 2;
  const centerY = height / 2 + 20;
  
  // Success icon
  drawSuccessIcon(ctx, centerX, centerY, 80);
  
  // Call to action
  ctx.font = `bold 32px ${bodyFont}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Click to view results', width / 2, height - 150);
  
  // Footer
  ctx.font = `18px ${bodyFont}`;
  ctx.fillStyle = '#71717a';
  ctx.fillText('Powered by MBD Moderation API', width / 2, height - 80);
}

/**
 * Draw a scanner icon
 */
function drawScannerIcon(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  const radius = size;
  
  // Purple circle with glow
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(111, 63, 245, 0.2)';
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 6;
  ctx.stroke();
  
  // Scanner lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  
  // Horizontal scan line
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.7, y);
  ctx.lineTo(x + radius * 0.7, y);
  ctx.stroke();
  
  // Vertical lines for scan frame
  // Left
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.7, y - radius * 0.4);
  ctx.lineTo(x - radius * 0.7, y + radius * 0.4);
  ctx.stroke();
  
  // Right
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.7, y - radius * 0.4);
  ctx.lineTo(x + radius * 0.7, y + radius * 0.4);
  ctx.stroke();
}

/**
 * Draw an error icon
 */
function drawErrorIcon(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  const radius = size;
  
  // Red circle with glow
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 6;
  ctx.stroke();
  
  // X mark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  
  // First line of X
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.5, y - radius * 0.5);
  ctx.lineTo(x + radius * 0.5, y + radius * 0.5);
  ctx.stroke();
  
  // Second line of X
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.5, y - radius * 0.5);
  ctx.lineTo(x - radius * 0.5, y + radius * 0.5);
  ctx.stroke();
}

/**
 * Draw an empty state icon
 */
function drawEmptyStateIcon(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  const radius = size;
  
  // Blue circle with glow
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 6;
  ctx.stroke();
  
  // Empty folder icon
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  
  // Folder bottom
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.5, y - radius * 0.2);
  ctx.lineTo(x - radius * 0.5, y + radius * 0.4);
  ctx.lineTo(x + radius * 0.5, y + radius * 0.4);
  ctx.lineTo(x + radius * 0.5, y - radius * 0.2);
  ctx.stroke();
  
  // Folder top
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.5, y - radius * 0.2);
  ctx.lineTo(x - radius * 0.3, y - radius * 0.4);
  ctx.lineTo(x + radius * 0.1, y - radius * 0.4);
  ctx.lineTo(x + radius * 0.3, y - radius * 0.2);
  ctx.stroke();
}

/**
 * Draw a success icon
 */
function drawSuccessIcon(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  const radius = size;
  
  // Teal circle with glow
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 184, 166, 0.2)';
  ctx.fill();
  
  // Border
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 6;
  ctx.stroke();
  
  // Check mark
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.4, y);
  ctx.lineTo(x - radius * 0.1, y + radius * 0.3);
  ctx.lineTo(x + radius * 0.5, y - radius * 0.3);
  ctx.stroke();
}

/**
 * Draw a modern grid background pattern
 */
function drawModernGrid(ctx: import('canvas').CanvasRenderingContext2D, width: number, height: number) {
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