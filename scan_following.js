import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env and .env.local files
dotenv.config();
// Also try to load from .env.local if it exists
try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envLocal = dotenv.parse(fs.readFileSync(envLocalPath));
    for (const k in envLocal) {
      process.env[k] = envLocal[k];
    }
    console.log("Loaded environment variables from .env.local");
  }
} catch (error) {
  console.warn("Could not load .env.local file:", error.message);
}

// Configurable parameters (can be passed as environment variables)
const CONFIG = {
  targetFid: process.env.TARGET_FID || "318473", // Default: leopastel
  spamThreshold: parseFloat(process.env.SPAM_THRESHOLD || "0.6"),
  aiThreshold: parseFloat(process.env.AI_THRESHOLD || "0.6"),
  batchSize: parseInt(process.env.BATCH_SIZE || "50"),
  outputFilename: process.env.OUTPUT_FILENAME || `farcaster_moderation_scan_${new Date().toISOString().split('T')[0]}.json`
};

// Function to make HTTP requests
async function makeRequest(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Get following list for a Farcaster user with pagination
async function getFollowing(fid) {
  let allFollowing = [];
  let cursor = null;
  let hasMore = true;
  let page = 1;
  
  console.log(`Fetching accounts followed by FID ${fid} with pagination...`);
  
  while (hasMore) {
    // Build URL with cursor if available
    let url = `https://api.warpcast.com/v2/following?fid=${fid}&limit=100`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }
    
    console.log(`Fetching page ${page}...`);
    const response = await makeRequest(url, { method: 'GET' });
    
    if (!response.result || !response.result.users) {
      console.error('Unexpected API response:', response);
      break;
    }
    
    const users = response.result.users;
    console.log(`Retrieved ${users.length} accounts on page ${page}`);
    
    // Map and add users to our collection
    const mappedUsers = users.map(user => ({
      fid: user.fid,
      username: user.username || `fid:${user.fid}`,
      displayName: user.displayName || `User ${user.fid}`,
      pfp_url: user.pfp?.url || '',
      bio: user.profile?.bio?.text || '',
    }));
    
    allFollowing = [...allFollowing, ...mappedUsers];
    
    // Check if there's more data to fetch
    if (response.next && response.next.cursor) {
      cursor = response.next.cursor;
      page++;
    } else {
      hasMore = false;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return allFollowing;
}

// Call MBD API for user moderation
async function getUserModeration(userIds) {
  // Check if we have an MBD API key
  const apiKey = process.env.MBD_API_KEY;
  
  if (!apiKey) {
    throw new Error("No MBD API key provided. Add your API key to .env or .env.local file.");
  }

  const url = 'https://api.mbd.xyz/v2/farcaster/users/labels/for-users';
  
  try {
    // Make the API request
    const response = await makeRequest(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://nuonu.xyz',
          'X-Title': 'Nuonu Frame'
        }
      },
      {
        users_list: userIds,
        label_category: 'moderation'
      }
    );
    
    if (response && response.status_code === 200 && response.body) {
      // Process and return the results
      const results = {};
      
      response.body.forEach((userData) => {
        const userId = userData.user_id;
        const moderation = {};
        
        // Extract moderation labels
        if (userData.ai_labels && userData.ai_labels.moderation) {
          userData.ai_labels.moderation.forEach((item) => {
            const { label, score } = item;
            
            if (label === 'spam') {
              moderation['spam_probability'] = score;
            } else if (label === 'llm_generated') {
              moderation['ai_generated_probability'] = score;
            } else {
              moderation[label] = score;
            }
          });
        }
        
        results[userId] = { moderation };
      });
      
      return results;
    } else {
      console.error('MBD API error response:', response);
      throw new Error(`MBD API error: ${response.status_code} - ${response.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error calling MBD API:', error);
    throw error;
  }
}

// Process users in batches to avoid overloading the API
async function getModerationScores(users, batchSize = CONFIG.batchSize) {
  const results = {};
  const totalUsers = users.length;
  let processed = 0;
  
  console.log(`Processing ${totalUsers} users in batches of ${batchSize}`);
  
  while (processed < totalUsers) {
    const batch = users.slice(processed, processed + batchSize);
    const userIds = batch.map(user => user.fid.toString());
    
    console.log(`Processing batch ${Math.floor(processed/batchSize) + 1} of ${Math.ceil(totalUsers/batchSize)}: ${userIds.length} users`);
    
    try {
      const batchResults = await getUserModeration(userIds);
      
      // Merge batch results into main results
      Object.assign(results, batchResults);
      
      processed += batch.length;
      console.log(`Progress: ${processed}/${totalUsers} users (${Math.round(processed/totalUsers*100)}%)`);
      
      // Short delay between batches to be nice to the API
      if (processed < totalUsers) {
        const delay = 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Error processing batch, will continue with next batch:`, error);
      processed += batch.length;
    }
  }
  
  return results;
}

// Analyze accounts using real moderation scores from MBD
async function analyzeAccounts(accounts) {
  // Define thresholds from config
  const SPAM_THRESHOLD = CONFIG.spamThreshold; 
  const AI_THRESHOLD = CONFIG.aiThreshold;
  
  console.log(`Getting moderation scores from MBD API for ${accounts.length} accounts...`);
  console.log(`Using thresholds: Spam ≥ ${SPAM_THRESHOLD * 100}%, AI ≥ ${AI_THRESHOLD * 100}%`);
  
  const moderationResults = await getModerationScores(accounts);
  
  console.log(`Processing moderation results...`);
  const flaggedAccounts = [];
  const missingDataAccounts = [];
  
  accounts.forEach(account => {
    const fid = account.fid.toString();
    const result = moderationResults[fid];
    
    if (!result || !result.moderation) {
      missingDataAccounts.push(account.username);
      return;
    }
    
    const spamScore = result.moderation.spam_probability || 0;
    const aiScore = result.moderation.ai_generated_probability || 0;
    
    // Check if account should be flagged
    const flags = [];
    
    // Flag for high spam
    if (spamScore >= SPAM_THRESHOLD) {
      flags.push('high spam');
    }
    
    // Flag for high AI
    if (aiScore >= AI_THRESHOLD) {
      flags.push('high AI');
    }
    
    if (flags.length > 0) {
      flaggedAccounts.push({
        username: account.username,
        displayName: account.displayName,
        fid: account.fid,
        spamScore: (spamScore * 100).toFixed(1) + '%',
        aiScore: (aiScore * 100).toFixed(1) + '%',
        flags: flags,
        rawScores: result.moderation
      });
    }
  });

  // Log counts of accounts with missing data
  if (missingDataAccounts.length > 0) {
    console.log(`No moderation data available for ${missingDataAccounts.length} accounts`);
  }

  return flaggedAccounts;
}

// Main function
async function main() {
  try {
    const targetFid = CONFIG.targetFid;
    console.log(`Starting moderation scan with parameters:`);
    console.log(`- Target FID: ${targetFid}`);
    console.log(`- Spam threshold: ${CONFIG.spamThreshold * 100}%`);
    console.log(`- AI threshold: ${CONFIG.aiThreshold * 100}%`);
    console.log(`- Batch size: ${CONFIG.batchSize}`);
    console.log(`- Output file: ${CONFIG.outputFilename}`);
    
    console.log(`\nRetrieving following list for FID ${targetFid}...`);
    const following = await getFollowing(targetFid);
    
    if (following && following.length > 0) {
      console.log(`Found ${following.length} accounts. Analyzing using MBD API...`);
      
      const flaggedAccounts = await analyzeAccounts(following);
      
      console.log(`\nFlagged ${flaggedAccounts.length} accounts based on thresholds:`);
      console.log(`- spam: ${CONFIG.spamThreshold * 100}%`);
      console.log(`- AI: ${CONFIG.aiThreshold * 100}%`);
      
      if (flaggedAccounts.length > 0) {
        console.log('\nTop 5 flagged accounts:');
        
        // Sort by spam score and show top 5
        const sortedAccounts = [...flaggedAccounts].sort((a, b) => {
          return parseFloat(b.spamScore) - parseFloat(a.spamScore);
        }).slice(0, 5);
        
        sortedAccounts.forEach((account, index) => {
          console.log(`\n${index + 1}. ${account.username} (FID: ${account.fid})`);
          console.log(`   Display Name: ${account.displayName}`);
          console.log(`   Spam Score: ${account.spamScore}`);
          console.log(`   AI Score: ${account.aiScore}`);
          console.log(`   Flags: ${account.flags.join(', ')}`);
        });
        
        if (flaggedAccounts.length > 5) {
          console.log(`\n... and ${flaggedAccounts.length - 5} more accounts.`);
        }
      } else {
        console.log("No accounts were flagged with the current thresholds.");
      }
      
      // Save results to file
      const results = {
        timestamp: new Date().toISOString(),
        scanParameters: {
          targetFid: CONFIG.targetFid,
          spamThreshold: CONFIG.spamThreshold,
          aiThreshold: CONFIG.aiThreshold
        },
        totalScanned: following.length,
        flaggedCount: flaggedAccounts.length,
        flaggedRate: (flaggedAccounts.length / following.length * 100).toFixed(2) + '%',
        flaggedAccounts: flaggedAccounts
      };
      
      fs.writeFileSync(CONFIG.outputFilename, JSON.stringify(results, null, 2));
      console.log(`\nResults saved to ${CONFIG.outputFilename}`);
    } else {
      console.log('Failed to retrieve or process following data.');
    }
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

main(); 