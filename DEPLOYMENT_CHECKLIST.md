# Deployment Checklist for Account Scanner Frame

## About This Project
This is a Farcaster frame that allows any user to scan their following list for potential bots. When a user clicks on the frame, it will analyze the accounts they follow and report any suspicious activity based on moderation thresholds.

The standalone scripts (`scan_following.js`, `analyze_scan.js`, etc.) are NOT part of the deployment - they are utility scripts for separate analysis.

## Pre-Deployment Tasks

- [x] Update AI threshold to DEFAULT value (0.75 or 75%) in `src/lib/moderation.ts`
- [ ] Verify all environment variables are set in `.env.local` for local testing
- [ ] Ensure all API endpoints are working correctly
- [ ] Test the frame locally with a tunneling service

## Environment Variables to Configure in Vercel

- [ ] `NEYNAR_API_KEY` - Required for Farcaster API access
- [ ] `MBD_API_KEY` - Required for Moderation By Design API
- [ ] `NEXT_PUBLIC_HOST` - Your production domain
- [ ] `VERCEL_URL` - Automatically set by Vercel
- [ ] `AI_THRESHOLD` - Set to "0.75" (optional, defaults to 0.75)
- [ ] `SPAM_THRESHOLD` - Set to "0.4" (optional, defaults to 0.4)

## Deployment Steps on Vercel

1. Push your latest code to GitHub
2. Connect your repository to Vercel if not already connected
3. Configure the project settings:
   - Framework: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Add all required environment variables
5. Deploy the project

## Post-Deployment Verification

- [ ] Test the frame using the Warpcast Frame Validator
- [ ] Verify image generation endpoints work correctly
- [ ] Test the frame by scanning your own following list
- [ ] Check that accounts are flagged correctly using the default thresholds

## Frame URLs to Test

- Main Frame: `https://your-domain.vercel.app/frames/account-scanner`
- API Endpoint: `https://your-domain.vercel.app/api/scan-following?fid=YOUR_TEST_FID`
- Report View: `https://your-domain.vercel.app/report?fid=YOUR_TEST_FID`

## Resources

- [Farcaster Frames Documentation](https://docs.farcaster.xyz/reference/frames/spec)
- [Warpcast Frame Validator](https://warpcast.com/~/developers/frames)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables) 