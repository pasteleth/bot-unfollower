import fs from 'fs';

// Read the results file
const data = JSON.parse(fs.readFileSync('leopastel_following_scan_default.json', 'utf8'));

// Count accounts by flag type
const combinedSpamAndAiCount = data.flaggedAccounts.filter(a => a.flags.hasCombinedSpamAndAi).length;
const highSpamCount = data.flaggedAccounts.filter(a => a.flags.hasHighSpam).length;
const highAiCount = data.flaggedAccounts.filter(a => a.flags.hasHighAi).length;

// Count accounts that were flagged ONLY by a specific criteria
const onlyCombinedSpamAndAi = data.flaggedAccounts.filter(a => 
  a.flags.hasCombinedSpamAndAi && !a.flags.hasHighSpam && !a.flags.hasHighAi
).length;

const onlyHighSpam = data.flaggedAccounts.filter(a => 
  !a.flags.hasCombinedSpamAndAi && a.flags.hasHighSpam && !a.flags.hasHighAi
).length;

const onlyHighAi = data.flaggedAccounts.filter(a => 
  !a.flags.hasCombinedSpamAndAi && !a.flags.hasHighSpam && a.flags.hasHighAi
).length;

// Print the results
console.log('SUMMARY OF FLAGGED ACCOUNTS (DEFAULT PARAMETERS)');
console.log('--------------------------------------------');
console.log(`Total Accounts Checked: ${data.followingCount}`);
console.log(`Total Flagged Accounts: ${data.flaggedCount}`);
console.log(`Flagged Rate: ${(data.flaggedCount / data.followingCount * 100).toFixed(1)}%`);
console.log('\nFLAG BREAKDOWN');
console.log('--------------');
console.log(`Combined Spam & AI (≥20% spam AND ≥5% AI): ${combinedSpamAndAiCount} accounts`);
console.log(`High Spam (≥40%): ${highSpamCount} accounts`);
console.log(`High AI (≥10%): ${highAiCount} accounts`);
console.log('\nFLAGGED ONLY BY SPECIFIC CRITERIA');
console.log('--------------------------------');
console.log(`Only Combined Spam & AI: ${onlyCombinedSpamAndAi} accounts`);
console.log(`Only High Spam: ${onlyHighSpam} accounts`);
console.log(`Only High AI: ${onlyHighAi} accounts`);
