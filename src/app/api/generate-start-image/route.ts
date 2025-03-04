import { NextRequest } from 'next/server';

/**
 * Redirect to the hosted image URL
 */
export async function GET(request: NextRequest) {
  try {
    // Redirect to the image URL
    return Response.redirect('https://i.ibb.co/v401MZtB/Frame-1-9.png', 302);
  } catch (error) {
    console.error('Error redirecting to image:', error);
    return new Response('Error redirecting to image', { status: 500 });
  }
} 