import { NextRequest } from 'next/server';
import { createCanvas } from 'canvas';

/**
 * Generate a simple black image with text for the frame
 */
export async function GET(request: NextRequest) {
  try {
    // Create canvas with frame dimensions
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Plain black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Add heading text with system font
    ctx.fillStyle = '#FFFFFF'; // White text
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('bot unfollower', width/2, height/2 - 30);
    
    // Add subheading text with system font
    ctx.fillStyle = '#CCCCCC'; // Light gray text
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('scan your following list for bots', width/2, height/2 + 30);
    
    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Return the image
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
} 