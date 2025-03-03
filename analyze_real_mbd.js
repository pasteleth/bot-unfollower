import fs from 'fs';

// Check if file name is provided as an argument
const filename = process.argv[2] || 'leopastel_following_scan_real_mbd.json';

// Read and parse the JSON file
try {
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  
  // Calculate statistics
  const totalAccounts = data.totalFollowing;
  const flaggedAccounts = data.flaggedAccounts;
  const flaggedCount = flaggedAccounts.length;
  const flaggedRate = ((flaggedCount / totalAccounts) * 100).toFixed(1);
  
  // Count types of flags
  let highSpamCount = 0;
  let highAiCount = 0;
  let bothCount = 0;
  
  flaggedAccounts.forEach(account => {
    const hasSpam = account.flags.includes('high spam');
    const hasAi = account.flags.includes('high AI');
    
    if (hasSpam && hasAi) {
      bothCount++;
    } else if (hasSpam) {
      highSpamCount++;
    } else if (hasAi) {
      highAiCount++;
    }
  });
  
  // Display results
  console.log('\n===== MODERATION ANALYSIS USING REAL MBD API =====');
  console.log(`Total accounts checked: ${totalAccounts}`);
  console.log(`Total flagged accounts: ${flaggedCount} (${flaggedRate}% of total)`);
  console.log('\nBreakdown by flag type:');
  console.log(`- High Spam only: ${highSpamCount} (${((highSpamCount / totalAccounts) * 100).toFixed(1)}% of total)`);
  console.log(`- High AI only: ${highAiCount} (${((highAiCount / totalAccounts) * 100).toFixed(1)}% of total)`);
  console.log(`- Both High Spam and High AI: ${bothCount} (${((bothCount / totalAccounts) * 100).toFixed(1)}% of total)`);
  
  // Calculate average scores
  let totalSpamScore = 0;
  let totalAiScore = 0;
  let maxSpamScore = 0;
  let maxAiScore = 0;
  let accountWithMaxSpam = null;
  let accountWithMaxAi = null;
  
  data.flaggedAccounts.forEach(account => {
    const spamScore = parseFloat(account.spamScore) / 100;
    const aiScore = parseFloat(account.aiScore) / 100;
    
    totalSpamScore += spamScore;
    totalAiScore += aiScore;
    
    if (spamScore > maxSpamScore) {
      maxSpamScore = spamScore;
      accountWithMaxSpam = account;
    }
    
    if (aiScore > maxAiScore) {
      maxAiScore = aiScore;
      accountWithMaxAi = account;
    }
  });
  
  const avgSpamScore = flaggedCount > 0 ? (totalSpamScore / flaggedCount) * 100 : 0;
  const avgAiScore = flaggedCount > 0 ? (totalAiScore / flaggedCount) * 100 : 0;
  
  console.log('\nScore statistics for flagged accounts:');
  console.log(`- Average Spam Score: ${avgSpamScore.toFixed(1)}%`);
  console.log(`- Average AI Score: ${avgAiScore.toFixed(1)}%`);
  
  if (accountWithMaxSpam) {
    console.log(`\nHighest Spam Score: ${accountWithMaxSpam.spamScore}`);
    console.log(`- Account: ${accountWithMaxSpam.username} (${accountWithMaxSpam.displayName})`);
    console.log(`- FID: ${accountWithMaxSpam.fid}`);
    console.log(`- AI Score: ${accountWithMaxSpam.aiScore}`);
  }
  
  if (accountWithMaxAi) {
    console.log(`\nHighest AI Score: ${accountWithMaxAi.aiScore}`);
    console.log(`- Account: ${accountWithMaxAi.username} (${accountWithMaxAi.displayName})`);
    console.log(`- FID: ${accountWithMaxAi.fid}`);
    console.log(`- Spam Score: ${accountWithMaxAi.spamScore}`);
  }
  
  console.log('\nNote: The results are based on real moderation scores from MBD API');
  console.log('==============================================\n');
  
} catch (error) {
  console.error(`Error analyzing results: ${error.message}`);
  console.log('Make sure the file exists and contains valid JSON data');
} 