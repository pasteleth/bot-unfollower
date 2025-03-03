import { NextResponse } from 'next/server';
import { getFollowing } from '@/lib/farcaster';
import { analyzeContent, getUserModeration } from '@/lib/mbd';

interface ApiDiagnostics {
  apiName: string;
  key: {
    value: string;
    format: string;
    validFormat: boolean;
  };
  testResult: {
    success: boolean;
    message: string;
    error?: string;
    data?: unknown;
  };
  documentation: string;
}

interface ApiTestResult {
  timestamp: string;
  neynarTest: ApiDiagnostics;
  mbdTest: ApiDiagnostics;
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const result: ApiTestResult = {
    timestamp,
    neynarTest: {
      apiName: "Neynar (Farcaster) API",
      key: {
        value: '****', // Masked for security
        format: '',
        validFormat: false
      },
      testResult: {
        success: false,
        message: 'No test performed yet'
      },
      documentation: 'https://docs.neynar.com/reference/get-followers'
    },
    mbdTest: {
      apiName: "MBD API",
      key: {
        value: '****', // Masked for security
        format: '',
        validFormat: false
      },
      testResult: {
        success: false,
        message: 'No test performed yet'
      },
      documentation: 'https://docs.mbd.xyz'
    }
  };

  // Test Neynar API
  const neynarKey = process.env.NEYNAR_API_KEY || '';
  // Check the format and mask most of the key
  if (neynarKey) {
    result.neynarTest.key.value = `${neynarKey.substring(0, 4)}****${neynarKey.substring(neynarKey.length - 4)}`;
    
    // Check for common Neynar key formats
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(neynarKey);
    const isNeynarAlphaNum = /^NEYNAR_[A-Z0-9]{24}$/i.test(neynarKey); 
    const isHexFormat = /^[0-9A-F]{32}$/i.test(neynarKey);
    
    if (isUUID) {
      result.neynarTest.key.format = 'UUID format';
      result.neynarTest.key.validFormat = true;
    } else if (isNeynarAlphaNum) {
      result.neynarTest.key.format = 'NEYNAR_XXXXX format';
      result.neynarTest.key.validFormat = true;
    } else if (isHexFormat) {
      result.neynarTest.key.format = 'Hex string format';
      result.neynarTest.key.validFormat = true;
    } else {
      result.neynarTest.key.format = 'Unknown format';
      result.neynarTest.key.validFormat = false;
    }
  } else {
    result.neynarTest.key.format = 'Missing';
    result.neynarTest.testResult.message = 'No Neynar API key found in environment variables.';
  }

  // Test the actual API if we have a key
  if (neynarKey) {
    try {
      // Use a known FID for testing
      const testFid = 1; // Farcaster user #1
      console.log(`Testing Neynar API with FID: ${testFid}`);
      
      const followingData = await getFollowing(testFid);
      
      result.neynarTest.testResult = {
        success: true,
        message: `Successfully retrieved following data for FID ${testFid}`,
        data: {
          userCount: followingData?.length || 0,
          sample: followingData?.slice(0, 2) || []
        }
      };
    } catch (error) {
      console.error('Neynar API test error:', error);
      result.neynarTest.testResult = {
        success: false,
        message: 'Failed to fetch data from Neynar API',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Test MBD API
  const mbdKey = process.env.MBD_API_KEY || '';
  // Check the format and mask most of the key
  if (mbdKey) {
    result.mbdTest.key.value = `${mbdKey.substring(0, 4)}****${mbdKey.substring(mbdKey.length - 4)}`;
    
    // Check for common MBD key formats
    const isMbdPrefixed = /^mbd-[a-zA-Z0-9]{32,}$/i.test(mbdKey);
    
    if (isMbdPrefixed) {
      result.mbdTest.key.format = 'mbd-xxxx format';
      result.mbdTest.key.validFormat = true;
    } else {
      result.mbdTest.key.format = 'Unknown format';
      result.mbdTest.key.validFormat = false;
    }
  } else {
    result.mbdTest.key.format = 'Missing';
    result.mbdTest.testResult.message = 'No MBD API key found in environment variables.';
  }

  // Test MBD API if a key is provided
  if (mbdKey && result.mbdTest.key.validFormat) {
    try {
      // Test message for user moderation
      const testUserIds = ['3', '4']; // Sample user IDs for testing
      
      console.log('Testing MBD API with sample user IDs');
      
      // Call getUserModeration directly (already imported)
      const moderationResults = await getUserModeration(testUserIds);
      
      // API call successful
      result.mbdTest.testResult = {
        success: true,
        message: 'Successfully retrieved user moderation data',
        data: {
          userCount: Object.keys(moderationResults).length,
          sampleResults: Object.entries(moderationResults).slice(0, 2).map(([userId, data]) => ({
            userId,
            moderationScores: data.moderation
          }))
        }
      };
    } catch (error) {
      console.error('MBD API test error:', error);
      result.mbdTest.testResult = {
        success: false,
        message: 'Failed to analyze content with MBD API',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } else {
    // Invalid or missing API key
    result.mbdTest.key.validFormat = false;
    result.mbdTest.testResult.message = 'Invalid or missing MBD API key format';
    result.mbdTest.testResult.error = 'Invalid or missing MBD API key format';
    result.mbdTest.testResult.data = null;
  }

  return NextResponse.json(result);
} 