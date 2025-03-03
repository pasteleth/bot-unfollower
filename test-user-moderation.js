#!/usr/bin/env node
/**
 * Test script for user moderation
 * 
 * Usage:
 * node test-user-moderation.js <fid>
 * 
 * Example:
 * node test-user-moderation.js 123456
 */

import readline from 'readline';
import http from 'http';
import https from 'https';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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

// Main function
async function main() {
  try {
    // Get FID from command line arguments or prompt user
    let fid = process.argv[2];
    
    if (!fid) {
      fid = await new Promise(resolve => {
        rl.question(`${colors.yellow}Enter your Farcaster ID (FID): ${colors.reset}`, (answer) => {
          resolve(answer.trim());
        });
      });
    }
    
    if (!fid || isNaN(parseInt(fid))) {
      console.error(`${colors.red}Invalid FID. Please provide a valid numeric FID.${colors.reset}`);
      process.exit(1);
    }
    
    console.log(`${colors.blue}Testing user moderation for FID: ${fid}${colors.reset}`);
    
    // First check if the local server is running
    console.log(`${colors.cyan}Checking if local server is running...${colors.reset}`);
    
    try {
      // Try to get the test-keys endpoint first to verify the server is running
      const testKeysResponse = await makeRequest('http://localhost:3000/api/test-keys');
      console.log(`${colors.green}Server is running.${colors.reset}`);
      
      // Call the user-moderation endpoint
      console.log(`${colors.cyan}Testing user moderation API...${colors.reset}`);
      const moderationResponse = await makeRequest(`http://localhost:3000/api/user-moderation?fid=${fid}`);
      
      // Display the results
      console.log(`\n${colors.green}Results for FID ${fid}:${colors.reset}`);
      console.log(JSON.stringify(moderationResponse, null, 2));
      
      // Display moderation scores in a more readable format
      if (moderationResponse.moderationData && moderationResponse.moderationData.moderation) {
        const { moderation } = moderationResponse.moderationData;
        
        console.log(`\n${colors.cyan}Moderation Scores:${colors.reset}`);
        
        // Display key scores with formatted percentages
        const spamScore = moderation.spam_probability || 0;
        const aiScore = moderation.ai_generated_probability || 0;
        
        console.log(`${colors.yellow}Spam Probability:     ${formatScore(spamScore)}${colors.reset}`);
        console.log(`${colors.yellow}AI Generated:         ${formatScore(aiScore)}${colors.reset}`);
        
        // Display other scores
        console.log(`\n${colors.cyan}Other Moderation Indicators:${colors.reset}`);
        Object.entries(moderation)
          .filter(([key]) => key !== 'spam_probability' && key !== 'ai_generated_probability')
          .sort((a, b) => b[1] - a[1]) // Sort by score descending
          .forEach(([key, value]) => {
            console.log(`${key.padEnd(20)}: ${formatScore(value)}`);
          });
      }
      
    } catch (error) {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
      console.log(`\n${colors.yellow}Is the server running? Make sure to start it with:${colors.reset}`);
      console.log(`npm run dev`);
    }
    
  } finally {
    rl.close();
  }
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
  } else {
    return `${colors.green}${percent}${colors.reset}`;
  }
}

// Run the main function
main().catch(err => {
  console.error(`${colors.red}Unhandled error: ${err.message}${colors.reset}`);
  process.exit(1);
}); 