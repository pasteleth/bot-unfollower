import fs from 'fs';

// Read the file with the results
const filename = process.argv[2] || 'leopastel_following_scan_real_mbd.json';
const data = JSON.parse(fs.readFileSync(filename, 'utf8'));

console.log('REAL MBD FLAGGED ACCOUNTS DETAILS');
console.log('================================');
console.log(`Based on thresholds: Spam ≥ 60%, AI ≥ 60%`);
console.log(`Total accounts checked: ${data.totalFollowing}`);
console.log(`Flagged accounts: ${data.flaggedAccounts.length}`);
console.log('\nDetailed information for each flagged account:');

// Sort flagged accounts by spam score (highest first)
const sortedAccounts = [...data.flaggedAccounts].sort((a, b) => {
  return parseFloat(b.spamScore) - parseFloat(a.spamScore);
});

// Display each flagged account with more details
sortedAccounts.forEach((account, index) => {
  console.log(`\n${index + 1}. ${account.username} (@${account.username})`);
  console.log(`   FID: ${account.fid}`);
  console.log(`   Display Name: ${account.displayName}`);
  console.log(`   Spam Score: ${account.spamScore}`);
  console.log(`   AI Score: ${account.aiScore}`);
  console.log(`   Flags: ${account.flags.join(', ')}`);
  
  // Display all raw scores if available
  if (account.rawScores) {
    console.log('   All Moderation Scores:');
    Object.entries(account.rawScores).forEach(([key, value]) => {
      console.log(`     - ${key}: ${(value * 100).toFixed(1)}%`);
    });
  }
});

console.log('\nNote: All scores are from real MBD API calls.'); 