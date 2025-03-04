import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate an error image with text for the error frame
 */
export async function GET(request: NextRequest) {
  try {
    // Get error message from URL params if available
    const { searchParams } = new URL(request.url);
    const errorMessage = searchParams.get('message') || 'Unknown error communicating with the frame server';

    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Plain black background (#000000)
    ctx.fillStyle = '#000000'; // Pure black background
    ctx.fillRect(0, 0, width, height);
    
    // Add error text to the image
    // Error title
    ctx.fillStyle = '#ffffff'; // White color
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Frame error', width / 2, height / 3);
    
    // Error message
    ctx.fillStyle = '#cccccc'; // Light gray color
    ctx.font = '36px Arial, sans-serif';
    
    // Handle longer error messages by wrapping text
    const maxLineWidth = width * 0.8; // 80% of canvas width
    const words = errorMessage.split(' ');
    let line = '';
    let lines = [];
    let y = height / 2;
    
    // Simple text wrapping
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxLineWidth && line !== '') {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    
    // Add the last line
    if (line) {
      lines.push(line);
    }
    
    // Draw each line of the error message
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], width / 2, y + (i * 45));
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
    console.error('Error generating error image:', error);
    return new Response('Error generating image', { status: 500 });
  }
} 