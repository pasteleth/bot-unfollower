import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

// Get the API key from environment variables
const apiKey = process.env.NEYNAR_API_KEY || '';

// Create a configuration with the API key
const config = new Configuration({
  apiKey: apiKey,
});

// Initialize the Neynar client
const neynarClient = new NeynarAPIClient(config);

export default neynarClient; 