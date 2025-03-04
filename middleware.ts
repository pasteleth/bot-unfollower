import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // For API routes, add the protection bypass header
  if (request.nextUrl.pathname.startsWith('/api/frame') || 
      request.nextUrl.pathname.startsWith('/api/frames/')) {
    // Create a new response
    const response = NextResponse.next();
    
    // Add the protection bypass header
    response.headers.set('x-vercel-protection-bypass', 'fdhsgioepfdgoissdifhiuads848hsdi');
    
    // Set CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-vercel-protection-bypass');
    
    // Set Cache-Control for consistent caching behavior
    if (request.method === 'GET') {
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    } else if (request.method === 'POST') {
      // Don't cache POST responses
      response.headers.set('Cache-Control', 'no-store, max-age=0');
    }
    
    return response;
  }

  // For all other routes, proceed normally
  return NextResponse.next();
}

// Configure the middleware to run only for API routes
export const config = {
  matcher: ['/api/:path*'],
}; 