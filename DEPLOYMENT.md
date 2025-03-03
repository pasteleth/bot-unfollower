# Deployment Guide for Account Scanner Frame

This guide will walk you through deploying your Account Scanner Frame to production using Vercel.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. A [Neynar](https://neynar.com) API key
3. A [Moderation by Design](https://moderationbydesign.com) API key

## Environment Setup

Make sure you have the following environment variables set in your production environment:

- `NEYNAR_API_KEY`: Your Neynar API key
- `MBD_API_KEY`: Your Moderation by Design API key
- `NEXT_PUBLIC_HOST`: Your production domain (e.g., https://your-project.vercel.app)

## Deployment Steps

### 1. Push your code to GitHub

Make sure your code is in a GitHub repository.

### 2. Deploy to Vercel

1. Log in to your Vercel account
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Add the environment variables listed above
6. Click "Deploy"

### 3. Test Your Deployed Frame

After deployment is complete, use the Warpcast Frame Validator to test your frame:

1. Go to [https://warpcast.com/~/developers/frames](https://warpcast.com/~/developers/frames)
2. Enter your frame URL: `https://your-project.vercel.app/api/frame`
3. Test that all buttons and transitions work correctly

### 4. Share Your Frame

Once everything is working correctly, share your frame by creating a cast on Warpcast that includes your frame URL.

## Troubleshooting

If you encounter issues:

- Check the Vercel deployment logs
- Ensure all environment variables are set correctly
- Verify API keys are valid and have sufficient quota
- Test the frame with the Warpcast validator

## Local Development Testing

For local testing:

1. Run your Next.js server: `npm run dev`
2. Use localtunnel to expose your local server:
   ```
   npx localtunnel --port 3000
   ```
3. Use the provided URL with the Warpcast Frame Validator

## Additional Resources

- [Farcaster Frames Documentation](https://docs.farcaster.xyz/reference/frames/spec)
- [Vercel Deployment Documentation](https://vercel.com/docs/deployments/overview)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment) 