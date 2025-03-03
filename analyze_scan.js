import fs from 'fs';

/**
 * Generates a moderation report from scan results
 * 
 * Usage:
 * node analyze_scan.js <results_file.json>
 * 
 * Options:
 * --format=text|json   Output format (default: text)
 * --output=filename    Save report to file instead of console
 */

// Process command line arguments
const args = process.argv.slice(2);
const filename = args.find(arg => !arg.startsWith('--')) || 'farcaster_moderation_scan.json';
const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'text';
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || null;

// Helper functions
function formatPercent(value) {
  return `${parseFloat(value).toFixed(1)}%`;
}

function sortByScore(accounts, scoreField = 'spamScore') {
  return [...accounts].sort((a, b) => {
    return parseFloat(b[scoreField]) - parseFloat(a[scoreField]);
  });
}

// Read and parse the JSON file
try {
  if (!fs.existsSync(filename)) {
    console.error(`Error: File '${filename}' not found`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  
  // Extract data
  const scanTime = new Date(data.timestamp).toLocaleString();
  const targetFid = data.scanParameters?.targetFid || "unknown";
  const spamThreshold = data.scanParameters?.spamThreshold || 0.6;
  const aiThreshold = data.scanParameters?.aiThreshold || 0.6;
  const totalAccounts = data.totalScanned || data.totalFollowing;
  const flaggedAccounts = data.flaggedAccounts;
  const flaggedCount = flaggedAccounts.length;
  const flaggedRate = data.flaggedRate || formatPercent(flaggedCount / totalAccounts * 100);
  
  // Calculate statistics
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
  
  // Calculate averages and find max scores
  let totalSpamScore = 0;
  let totalAiScore = 0;
  let maxSpamScore = 0;
  let maxAiScore = 0;
  let accountWithMaxSpam = null;
  let accountWithMaxAi = null;
  
  flaggedAccounts.forEach(account => {
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

  // Generate report
  let report = '';
  
  if (format === 'text') {
    report = `
FARCASTER MODERATION SCAN REPORT
================================
Scan Time: ${scanTime}
Target FID: ${targetFid}

PARAMETERS
----------
Spam Threshold: ${formatPercent(spamThreshold * 100)}
AI Threshold: ${formatPercent(aiThreshold * 100)}

RESULTS SUMMARY
--------------
Total Accounts Scanned: ${totalAccounts}
Flagged Accounts: ${flaggedCount} (${flaggedRate})

BREAKDOWN BY FLAG TYPE
---------------------
High Spam Only: ${highSpamCount} (${formatPercent(highSpamCount / totalAccounts * 100)})
High AI Only: ${highAiCount} (${formatPercent(highAiCount / totalAccounts * 100)})
Both High Spam & AI: ${bothCount} (${formatPercent(bothCount / totalAccounts * 100)})

SCORE STATISTICS
---------------
Average Spam Score: ${formatPercent(avgSpamScore)}
Average AI Score: ${formatPercent(avgAiScore)}
`;

    if (accountWithMaxSpam) {
      report += `
HIGHEST SPAM SCORE
-----------------
Score: ${accountWithMaxSpam.spamScore}
Account: ${accountWithMaxSpam.username} (${accountWithMaxSpam.displayName})
FID: ${accountWithMaxSpam.fid}
AI Score: ${accountWithMaxSpam.aiScore}
`;
    }

    if (accountWithMaxAi) {
      report += `
HIGHEST AI SCORE
---------------
Score: ${accountWithMaxAi.aiScore}
Account: ${accountWithMaxAi.username} (${accountWithMaxAi.displayName})
FID: ${accountWithMaxAi.fid}
Spam Score: ${accountWithMaxAi.spamScore}
`;
    }

    if (flaggedCount > 0) {
      report += `
TOP 10 ACCOUNTS BY SPAM SCORE
----------------------------
`;
      sortByScore(flaggedAccounts, 'spamScore').slice(0, 10).forEach((account, index) => {
        report += `
${index + 1}. ${account.username} (${account.displayName})
   FID: ${account.fid}
   Spam Score: ${account.spamScore}
   AI Score: ${account.aiScore}
   Flags: ${account.flags.join(', ')}
`;
      });

      if (highAiCount > 0) {
        report += `
TOP 10 ACCOUNTS BY AI SCORE
--------------------------
`;
        sortByScore(flaggedAccounts, 'aiScore').slice(0, 10).forEach((account, index) => {
          report += `
${index + 1}. ${account.username} (${account.displayName})
   FID: ${account.fid}
   AI Score: ${account.aiScore}
   Spam Score: ${account.spamScore}
   Flags: ${account.flags.join(', ')}
`;
        });
      }
    }
    
  } else if (format === 'json') {
    // Create structured report data
    const reportData = {
      scanInfo: {
        scanTime,
        targetFid,
        parameters: {
          spamThreshold: spamThreshold * 100,
          aiThreshold: aiThreshold * 100
        }
      },
      summary: {
        totalAccounts,
        flaggedAccounts: flaggedCount,
        flaggedRate: parseFloat(flaggedRate),
      },
      breakdown: {
        highSpamOnly: {
          count: highSpamCount,
          percentage: highSpamCount / totalAccounts * 100
        },
        highAiOnly: {
          count: highAiCount,
          percentage: highAiCount / totalAccounts * 100
        },
        bothHighSpamAndAi: {
          count: bothCount,
          percentage: bothCount / totalAccounts * 100
        }
      },
      statistics: {
        averageSpamScore: avgSpamScore,
        averageAiScore: avgAiScore,
        highestSpamAccount: accountWithMaxSpam ? {
          username: accountWithMaxSpam.username,
          displayName: accountWithMaxSpam.displayName,
          fid: accountWithMaxSpam.fid,
          spamScore: parseFloat(accountWithMaxSpam.spamScore),
          aiScore: parseFloat(accountWithMaxSpam.aiScore)
        } : null,
        highestAiAccount: accountWithMaxAi ? {
          username: accountWithMaxAi.username,
          displayName: accountWithMaxAi.displayName,
          fid: accountWithMaxAi.fid,
          spamScore: parseFloat(accountWithMaxAi.spamScore),
          aiScore: parseFloat(accountWithMaxAi.aiScore)
        } : null
      },
      topAccounts: {
        bySpamScore: sortByScore(flaggedAccounts, 'spamScore').slice(0, 10),
        byAiScore: sortByScore(flaggedAccounts, 'aiScore').slice(0, 10)
      }
    };
    
    report = JSON.stringify(reportData, null, 2);
  }

  // Output the report
  if (outputFile) {
    fs.writeFileSync(outputFile, report);
    console.log(`Report saved to ${outputFile}`);
  } else {
    console.log(report);
  }
  
} catch (error) {
  console.error(`Error analyzing results: ${error.message}`);
  console.log('Make sure the file exists and contains valid JSON data');
  process.exit(1);
} 