#!/usr/bin/env node

import fetch from 'node-fetch';

// Get the URL from command line arguments
const frameUrl = process.argv[2];

if (!frameUrl) {
  console.error('\x1b[31mError: Please provide a frame URL to validate\x1b[0m');
  console.log('Usage: npm run validate <frame-url>');
  console.log('Example: npm run validate https://your-domain.com/api/frames/account-scanner');
  process.exit(1);
}

async function validateFrame(url) {
  console.log(`\x1b[36mValidating frame at URL: ${url}\x1b[0m`);
  
  try {
    // Check if the URL is accessible
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`\x1b[31mError: Failed to fetch the frame (HTTP ${response.status})\x1b[0m`);
      process.exit(1);
    }
    
    const html = await response.text();
    
    // Check for required meta tags
    const requiredTags = [
      { name: 'fc:frame', content: 'vNext' },
      { name: 'fc:frame:image' },
      { name: 'fc:frame:button:1' }
    ];
    
    const missingTags = [];
    
    for (const tag of requiredTags) {
      const regex = new RegExp(`<meta\\s+property=["']${tag.name}["'].*?>`, 'i');
      if (!regex.test(html)) {
        missingTags.push(tag.name);
      } else if (tag.content) {
        const contentRegex = new RegExp(`<meta\\s+property=["']${tag.name}["']\\s+content=["']${tag.content}["'].*?>`, 'i');
        if (!contentRegex.test(html)) {
          missingTags.push(`${tag.name} with content="${tag.content}"`);
        }
      }
    }
    
    if (missingTags.length > 0) {
      console.error('\x1b[31mError: The following required meta tags are missing:\x1b[0m');
      missingTags.forEach(tag => console.error(`  - ${tag}`));
      process.exit(1);
    }
    
    // Check for CORS headers
    const corsHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods'
    ];
    
    const missingHeaders = [];
    
    for (const header of corsHeaders) {
      if (!response.headers.has(header)) {
        missingHeaders.push(header);
      }
    }
    
    if (missingHeaders.length > 0) {
      console.warn('\x1b[33mWarning: The following CORS headers might be missing:\x1b[0m');
      missingHeaders.forEach(header => console.warn(`  - ${header}`));
      console.warn('\x1b[33mThis could cause issues with the Frame validator.\x1b[0m');
    }
    
    // Check if the origin allows all (*) or is restricted
    if (response.headers.has('access-control-allow-origin')) {
      const origin = response.headers.get('access-control-allow-origin');
      if (origin !== '*') {
        console.warn(`\x1b[33mWarning: access-control-allow-origin is set to "${origin}" instead of "*"\x1b[0m`);
        console.warn('\x1b[33mThis might restrict which apps can display your frame.\x1b[0m');
      }
    }
    
    // Check for environment variables
    console.log('\n\x1b[36mChecking environment variables:\x1b[0m');
    const requiredEnvVars = [
      'NEYNAR_API_KEY',
      'MBD_API_KEY'
    ];
    
    const missingEnvVars = [];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingEnvVars.push(envVar);
      }
    }
    
    if (missingEnvVars.length > 0) {
      console.warn('\x1b[33mWarning: The following environment variables are not set:\x1b[0m');
      missingEnvVars.forEach(envVar => console.warn(`  - ${envVar}`));
      console.warn('\x1b[33mMake sure to set these in your deployment environment.\x1b[0m');
    } else {
      console.log('\x1b[32mAll required environment variables are set.\x1b[0m');
    }
    
    // Success message
    console.log('\n\x1b[32mFrame validation successful! ✅\x1b[0m');
    console.log('\x1b[32mYour frame appears to meet the basic requirements.\x1b[0m');
    
    // Suggest testing with the Warpcast validator
    console.log('\n\x1b[36mNext steps:\x1b[0m');
    console.log('1. Test your frame with the Warpcast validator:');
    console.log(`   https://warpcast.com/~/developers/frames?url=${encodeURIComponent(url)}`);
    console.log('2. Make sure your frame is working as expected in various clients');
    console.log('3. Share your frame with the world! 🎉');
    
  } catch (error) {
    console.error('\x1b[31mError validating frame:\x1b[0m', error.message);
    process.exit(1);
  }
}

validateFrame(frameUrl); 