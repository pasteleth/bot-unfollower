# Farcaster Moderation Scan Tools

This suite of tools allows you to scan Farcaster accounts for potential moderation issues using the MBD (Moderation By Design) API. The tools scan a user's following list and flag accounts based on configurable spam and AI-generated content thresholds.

## Prerequisites

- Node.js 16+
- An MBD API key (obtainable from [moderationbydesign.com](https://moderationbydesign.com/))

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` or `.env.local` file with your MBD API key:

```
# MBD API Key
MBD_API_KEY=your-mbd-api-key-here
```

## Usage

### Running a Moderation Scan

The main script `scan_following.js` will scan the following list of a specified Farcaster user and check each account against the MBD API for moderation flags.

Basic usage:

```
node scan_following.js
```

By default, this will scan the following list of FID 318473 with thresholds of 60% for both spam and AI-generated content.

### Configurable Parameters

You can configure the scan using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| TARGET_FID | The Farcaster FID to scan | 318473 |
| SPAM_THRESHOLD | Threshold for flagging spam content (0.0-1.0) | 0.6 |
| AI_THRESHOLD | Threshold for flagging AI-generated content (0.0-1.0) | 0.6 |
| BATCH_SIZE | Number of accounts to process in each batch | 50 |
| OUTPUT_FILENAME | Filename for saving results | farcaster_moderation_scan_YYYY-MM-DD.json |

Example with custom parameters:

```
TARGET_FID=12345 SPAM_THRESHOLD=0.7 AI_THRESHOLD=0.5 node scan_following.js
```

### Analyzing Results

After running a scan, use `analyze_scan.js` to generate a detailed report:

```
node analyze_scan.js <results_file.json>
```

Options:
- `--format=text|json` - Output format (default: text)
- `--output=filename` - Save report to file instead of console

Examples:

```
# Generate a text report
node analyze_scan.js farcaster_moderation_scan_2023-07-14.json

# Generate a JSON report
node analyze_scan.js farcaster_moderation_scan_2023-07-14.json --format=json

# Save report to file
node analyze_scan.js farcaster_moderation_scan_2023-07-14.json --output=report.txt
```

## Understanding Results

The scan results include:

- **Flagged accounts**: Accounts that exceed the specified thresholds
- **Spam score**: Probability that the account is producing spam content
- **AI score**: Probability that the account is producing AI-generated content

Accounts are flagged as:
- "high spam" - Spam score exceeds the spam threshold
- "high AI" - AI score exceeds the AI threshold

## Example Report

```
FARCASTER MODERATION SCAN REPORT
================================
Scan Time: 7/14/2023, 10:15:20 AM
Target FID: 12345

PARAMETERS
----------
Spam Threshold: 60.0%
AI Threshold: 60.0%

RESULTS SUMMARY
--------------
Total Accounts Scanned: 674
Flagged Accounts: 3 (0.4%)

BREAKDOWN BY FLAG TYPE
---------------------
High Spam Only: 3 (0.4%)
High AI Only: 0 (0.0%)
Both High Spam & AI: 0 (0.0%)

SCORE STATISTICS
---------------
Average Spam Score: 73.0%
Average AI Score: 0.0%

HIGHEST SPAM SCORE
-----------------
Score: 87.6%
Account: redstone (Redstone Chain)
FID: 498774
AI Score: 0.0%
```

## Notes

- The MBD API has rate limits. The tool processes accounts in batches with a short delay between batches to avoid hitting these limits.
- Some accounts may not have moderation data available.
- Scans of large following lists can take several minutes to complete.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 