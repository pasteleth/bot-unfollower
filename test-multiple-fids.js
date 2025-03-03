#!/usr/bin/env node
/**
 * Test script for checking multiple FIDs at once
 * 
 * Usage:
 * node test-multiple-fids.js 1 3 6 9 318473
 * 
 * Example:
 * node test-multiple-fids.js 1 3 6 9 318473
 */

import http from 'http';
import https from 'https';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bold: '\x1b[1m'
};

// Helper function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (resp) => {
      let data = '';
      
      resp.on('data', (chunk) => {
        data += chunk;
      });
      
      resp.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Parse command line arguments
const fids = process.argv.slice(2);

if (fids.length === 0) {
  console.log(`${colors.yellow}Usage: node test-multiple-fids.js <fid1> <fid2> <fid3> ...${colors.reset}`);
  console.log(`${colors.yellow}Example: node test-multiple-fids.js 1 3 6 9 318473${colors.reset}`);
  process.exit(1);
}

// Format score as percentage with color coding
function formatScore(score) {
  const percent = (score * 100).toFixed(2) + '%';
  
  if (score > 0.75) {
    return `${colors.red}${percent}${colors.reset}`;
  } else if (score > 0.5) {
    return `${colors.yellow}${percent}${colors.reset}`;
  } else if (score > 0.25) {
    return `${colors.cyan}${percent}${colors.reset}`;
  } else if (score > 0.1) {
    return `${colors.blue}${percent}${colors.reset}`;
  } else {
    return `${colors.green}${percent}${colors.reset}`;
  }
}

// Main function
async function main() {
  try {
    console.log(`${colors.bold}${colors.blue}Testing moderation data for ${fids.length} FIDs...${colors.reset}\n`);
    
    // Construct the batch request body
    const body = JSON.stringify({
      fids: fids
    });
    
    // Make the batch request
    console.log(`${colors.cyan}Making batch request to MBD API...${colors.reset}`);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/user-moderation/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    };
    
    const moderationData = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });
      
      req.on('error', (err) => {
        reject(err);
      });
      
      req.write(body);
      req.end();
    });
    
    if (!moderationData.results || Object.keys(moderationData.results).length === 0) {
      console.error(`${colors.red}No moderation data returned for any FID.${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.green}Successfully retrieved moderation data for ${Object.keys(moderationData.results).length} FIDs.${colors.reset}\n`);
    
    // Display results as a table
    console.log(`${colors.bold}Moderation Scores:${colors.reset}`);
    console.log(`${colors.gray}┌───────────┬───────────────┬───────────────┬───────────────┬───────────────┐${colors.reset}`);
    console.log(`${colors.gray}│${colors.reset} ${colors.bold}FID       ${colors.reset} ${colors.gray}│${colors.reset} ${colors.bold}Spam          ${colors.reset} ${colors.gray}│${colors.reset} ${colors.bold}AI Generated   ${colors.reset} ${colors.gray}│${colors.reset} ${colors.bold}Hate          ${colors.reset} ${colors.gray}│${colors.reset} ${colors.bold}Sexual        ${colors.reset} ${colors.gray}│${colors.reset}`);
    console.log(`${colors.gray}├───────────┼───────────────┼───────────────┼───────────────┼───────────────┤${colors.reset}`);
    
    Object.entries(moderationData.results).forEach(([fid, data]) => {
      const m = data.moderation || {};
      const spam = m.spam_probability || 0;
      const aiGenerated = m.ai_generated_probability || 0;
      const hate = m.hate || 0;
      const sexual = m.sexual || 0;
      
      console.log(`${colors.gray}│${colors.reset} ${colors.bold}${fid.padEnd(9)}${colors.reset} ${colors.gray}│${colors.reset} ${formatScore(spam).padEnd(13)} ${colors.gray}│${colors.reset} ${formatScore(aiGenerated).padEnd(13)} ${colors.gray}│${colors.reset} ${formatScore(hate).padEnd(13)} ${colors.gray}│${colors.reset} ${formatScore(sexual).padEnd(13)} ${colors.gray}│${colors.reset}`);
    });
    
    console.log(`${colors.gray}└───────────┴───────────────┴───────────────┴───────────────┴───────────────┘${colors.reset}`);
    
    console.log(`\n${colors.bold}Legend:${colors.reset}`);
    console.log(`${colors.green}0-10%${colors.reset}: Very low probability`);
    console.log(`${colors.blue}10-25%${colors.reset}: Low probability`);
    console.log(`${colors.cyan}25-50%${colors.reset}: Moderate probability`);
    console.log(`${colors.yellow}50-75%${colors.reset}: High probability`);
    console.log(`${colors.red}75-100%${colors.reset}: Very high probability`);
    
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.log(`\n${colors.yellow}Is the server running? Make sure to start it with:${colors.reset}`);
    console.log(`npm run dev`);
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Unhandled error: ${err.message}${colors.reset}`);
  process.exit(1);
}); 