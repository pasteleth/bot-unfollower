import { NextRequest } from 'next/server';

/**
 * Redirect to the hosted image URL
 */
export async function GET(request: NextRequest) {
  try {
    // Redirect to the image URL
    return Response.redirect('https://i.ibb.co/jrxzwxb/bot-unfollower-image.png', 302);
  } catch (error) {
    console.error('Error redirecting to image:', error);
    return new Response('Error redirecting to image', { status: 500 });
  }
} 