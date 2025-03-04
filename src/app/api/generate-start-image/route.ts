import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Serve the static image instead of generating one
 */
export async function GET(request: NextRequest) {
  try {
    // Path to the static image file
    const imagePath = path.join(process.cwd(), 'public', 'frame_image.png');
    
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Return the image
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return new Response('Error serving image', { status: 500 });
  }
} 