import { NextRequest } from 'next/server';
import { createCanvas, registerFont } from 'canvas';
import path from 'path';

// Register Inter font
// Using a try-catch so the app doesn't crash if the font path is incorrect
try {
  registerFont(path.resolve('./public/fonts/Inter-Regular.ttf'), { family: 'Inter', weight: 'normal' });
  registerFont(path.resolve('./public/fonts/Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });
  console.log('Inter font registered successfully');
} catch (error) {
  console.error('Failed to register Inter font:', error);
  // The canvas will fall back to system fonts if registration fails
}

/**
 * Generate an image for the scanning frame that shows scanning is in progress
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

    // Plain black background (#000000)
    ctx.fillStyle = '#000000'; // Pure black background
    ctx.fillRect(0, 0, width, height);
    
    // Add text to the image
    // Title
    ctx.fillStyle = '#ffffff'; // White color
    ctx.font = 'bold 64px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Scanning in progress...', width / 2, height / 3);
    
    // Description
    ctx.fillStyle = '#cccccc'; // Light gray color
    ctx.font = '36px Inter, Arial, sans-serif';
    ctx.fillText('Checking your following list for potential bots', width / 2, height / 2);
    
    // Loading indicator text
    ctx.fillStyle = '#999999'; // Medium gray color
    ctx.font = '24px Inter, Arial, sans-serif';
    ctx.fillText('This may take a few moments', width / 2, height / 1.5);
    
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