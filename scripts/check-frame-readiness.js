#!/usr/bin/env node

/**
 * Frame Readiness Check Script
 * 
 * This script verifies that all components needed for the Frame to work in production are in place.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { exit } from 'process';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI color codes for output
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

console.log(`${BLUE}=== Frame Readiness Check ===${RESET}\n`);

let issues = 0;

// Function to check if a file exists
function checkFile(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  console.log(`Checking ${description} (${filePath})...`);
  
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}✓ ${description} found${RESET}`);
    return true;
  } else {
    console.log(`${RED}✗ ${description} not found${RESET}`);
    issues++;
    return false;
  }
}

// Function to check if an environment variable is set
function checkEnvVar(varName, description) {
  console.log(`Checking ${description} (${varName})...`);
  
  // First check .env.local
  const envPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(new RegExp(`${varName}=([^\n]+)`));
    
    if (match && match[1] && match[1].length > 10 && !match[1].includes('your-')) {
      console.log(`${GREEN}✓ ${description} is set in .env.local${RESET}`);
      return true;
    }
  }
  
  // Then check process.env
  if (process.env[varName] && process.env[varName].length > 10) {
    console.log(`${GREEN}✓ ${description} is set in environment${RESET}`);
    return true;
  }
  
  console.log(`${RED}✗ ${description} is missing or invalid${RESET}`);
  issues++;
  return false;
}

// Function to check essential directories
function checkDirectory(dirPath, description) {
  const fullPath = path.join(projectRoot, dirPath);
  console.log(`Checking ${description} (${dirPath})...`);
  
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    console.log(`${GREEN}✓ ${description} found${RESET}`);
    return true;
  } else {
    console.log(`${RED}✗ ${description} not found${RESET}`);
    issues++;
    return false;
  }
}

// Check essential files
console.log(`\n${BLUE}Checking essential files:${RESET}`);
checkFile('src/app/api/frame/route.ts', 'Frame API route');
checkFile('src/app/frames/account-scanner/page.tsx', 'Account scanner page');
checkFile('src/app/api/generate-scanner-image/route.ts', 'Image generator API');
checkFile('src/lib/farcaster.ts', 'Farcaster library');
checkFile('src/lib/moderation.ts', 'Moderation library');
checkFile('src/lib/mbd.ts', 'MBD API client');
checkFile('src/lib/neynar-client.ts', 'Neynar client');

// Check essential directories
console.log(`\n${BLUE}Checking essential directories:${RESET}`);
checkDirectory('public/assets', 'Assets directory');

// Check environment variables
console.log(`\n${BLUE}Checking environment variables:${RESET}`);
checkEnvVar('NEYNAR_API_KEY', 'Neynar API key');
checkEnvVar('MBD_API_KEY', 'MBD API key');

// Check if server is running locally
console.log(`\n${BLUE}Checking if server is running:${RESET}`);
try {
  console.log('Attempting to contact local server...');
  execSync('curl -s http://localhost:3000/api/frame -o /dev/null');
  console.log(`${GREEN}✓ Server is running on http://localhost:3000${RESET}`);
} catch (error) {
  console.log(`${YELLOW}! Server is not running on http://localhost:3000${RESET}`);
  console.log('  Run "npm run dev" to start the server');
  issues++;
}

// Check asset files
console.log(`\n${BLUE}Checking asset files:${RESET}`);
checkFile('public/assets/scanner-start.png', 'Scanner start image');
checkFile('public/assets/scanning-complete.png', 'Scanning complete image');
checkFile('public/assets/error.png', 'Error image');
checkFile('public/assets/no-following.png', 'No following image');

// Summary
console.log(`\n${BLUE}=== Summary ===${RESET}`);
if (issues === 0) {
  console.log(`${GREEN}All checks passed! Your Frame is ready for production.${RESET}`);
  console.log(`See DEPLOYMENT.md for instructions on deploying your Frame.`);
} else {
  console.log(`${RED}Found ${issues} issue(s) that need to be addressed before deployment.${RESET}`);
  console.log(`Please fix the issues above and run this check again.`);
}

// Exit with appropriate code
process.exit(issues > 0 ? 1 : 0); 