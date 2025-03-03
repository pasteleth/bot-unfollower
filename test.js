// Simple script to test API endpoints directly
const fetch = require('node-fetch');

async function testEndpoints() {
  console.log('Testing API endpoints...');
  
  try {
    // Test API keys endpoint
    console.log('\nTesting /api/test-keys endpoint:');
    const keysResponse = await fetch('http://localhost:3000/api/test-keys');
    const keysData = await keysResponse.json();
    console.log('Status:', keysResponse.status);
    console.log('Response:', JSON.stringify(keysData, null, 2));
    
    // Test followers endpoint with your FID
    const yourFid = 318473; // Using the sample FID from the component code
    console.log(`\nTesting /api/followers endpoint with FID: ${yourFid}`);
    const followersResponse = await fetch(`http://localhost:3000/api/followers?fid=${yourFid}`);
    const followersData = await followersResponse.json();
    console.log('Status:', followersResponse.status);
    
    if (followersResponse.status !== 200) {
      console.log('Error:', followersData);
    } else {
      console.log(`Found ${followersData.length} following accounts`);
      if (followersData.length > 0) {
        console.log('First account:', followersData[0]);
      }
    }
    
  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
}

testEndpoints(); 