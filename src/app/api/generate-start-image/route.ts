import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate a shadcn-style start image for the frame
 */
export async function GET(request: NextRequest) {
  try {
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
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.12)');  // Indigo tint at top
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');    // Nearly black at bottom
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add decorative elements
    drawModernGrid(ctx, width, height);

    // Set font styles - using Helvetica
    const titleFont = 'Helvetica, Arial, sans-serif';
    const bodyFont = 'Helvetica, Arial, sans-serif';
    
    // Title text
    ctx.font = `bold 72px ${titleFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Bot Unfollower', width / 2, 150);

    // Description
    ctx.font = `30px ${bodyFont}`;
    ctx.fillStyle = '#a1a1aa'; // Muted gray
    ctx.fillText('scan your following list for bots', width / 2, 210);

    // Add shadcn-style UI card
    drawCard(ctx, width / 2 - 400, 240, 800, 280);
    
    // Draw scanner symbol
    drawScannerSymbol(ctx, width / 2, 380, 80);

    // Draw modern app logo/branding
    drawLogo(ctx, 50, 50, 40);
    
    // Add call to action at bottom
    ctx.font = `bold 24px ${bodyFont}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Click "Scan My Following List" to start', width / 2, height - 50);

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
  ctx.fillStyle = 'rgba(99, 102, 241, 0.15)'; // Indigo accent
  ctx.beginPath();
  ctx.arc(width - 200, 150, 180, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'rgba(99, 102, 241, 0.07)';
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
 * Draws a scanner symbol with animation effect
 */
function drawScannerSymbol(ctx: import('canvas').CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Scanner circle
  ctx.strokeStyle = '#6366f1'; // Indigo color
  ctx.lineWidth = size / 20;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  
  // Scanning lines effect
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.7)';
  ctx.lineWidth = size / 30;
  
  // Draw scanning lines (horizontal)
  for (let i = 0; i < 3; i++) {
    const offset = i * (size / 4) - size / 3;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.8, y + offset);
    ctx.lineTo(x + size * 0.8, y + offset);
    ctx.stroke();
  }
  
  // Draw scanning target
  ctx.beginPath();
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x + size / 2, y);
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x, y + size / 2);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
  ctx.lineWidth = size / 40;
  ctx.stroke();
  
  // Draw small corner markers
  const markerSize = size / 5;
  
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x - size * 0.7, y - size * 0.5);
  ctx.lineTo(x - size * 0.7, y - size * 0.5 + markerSize);
  ctx.moveTo(x - size * 0.7, y - size * 0.5);
  ctx.lineTo(x - size * 0.7 + markerSize, y - size * 0.5);
  
  // Top-right
  ctx.moveTo(x + size * 0.7, y - size * 0.5);
  ctx.lineTo(x + size * 0.7, y - size * 0.5 + markerSize);
  ctx.moveTo(x + size * 0.7, y - size * 0.5);
  ctx.lineTo(x + size * 0.7 - markerSize, y - size * 0.5);
  
  // Bottom-left
  ctx.moveTo(x - size * 0.7, y + size * 0.5);
  ctx.lineTo(x - size * 0.7, y + size * 0.5 - markerSize);
  ctx.moveTo(x - size * 0.7, y + size * 0.5);
  ctx.lineTo(x - size * 0.7 + markerSize, y + size * 0.5);
  
  // Bottom-right
  ctx.moveTo(x + size * 0.7, y + size * 0.5);
  ctx.lineTo(x + size * 0.7, y + size * 0.5 - markerSize);
  ctx.moveTo(x + size * 0.7, y + size * 0.5);
  ctx.lineTo(x + size * 0.7 - markerSize, y + size * 0.5);
  
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = size / 25;
  ctx.stroke();
  
  // Add text
  const titleFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.font = `bold 28px ${titleFont}`;
  ctx.fillStyle = '#6366f1';
  ctx.textAlign = 'center';
  ctx.fillText('Find Bot Accounts', x, y + size + 30);
  
  // Additional message
  ctx.font = `20px ${titleFont}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText('Analyze your Farcaster following', x, y + size + 65);
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
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  
  // Logo symbol - shield with scanner
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + size * 0.25);
  ctx.lineTo(x + size * 0.75, y + size * 0.35);
  ctx.lineTo(x + size * 0.65, y + size * 0.75);
  ctx.lineTo(x + size / 2, y + size * 0.85);
  ctx.lineTo(x + size * 0.35, y + size * 0.75);
  ctx.lineTo(x + size * 0.25, y + size * 0.35);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
  ctx.fill();
  
  // Scanner symbol
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = size / 20;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 5, 0, Math.PI * 2);
  ctx.stroke();
  
  // Scanning line
  ctx.beginPath();
  ctx.moveTo(x + size * 0.35, y + size / 2);
  ctx.lineTo(x + size * 0.65, y + size / 2);
  ctx.stroke();
  
  // App name
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('Bot Scanner', x + size + 10, y + size / 2 + 7);
} 