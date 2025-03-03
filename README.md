# Account Scanner Frame

A Farcaster Frame that scans a user's following list for potentially problematic accounts and provides a detailed report.

## Features

- **Interactive Frame**: A fully interactive Farcaster Frame experience
- **Account Scanning**: Automatically scans a user's following list
- **Moderation Flags**: Identifies accounts with potentially problematic content
- **Detailed Report**: Provides a complete report with flagged accounts
- **Modern UI**: Clean, modern design with Shadcn-style visuals

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- [Neynar API key](https://neynar.com) for Farcaster integration
- [Moderation by Design API key](https://moderationbydesign.com) for content analysis

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

4. Add your API keys to the `.env.local` file.

### Running Locally

```bash
npm run dev
```

The application will be available at http://localhost:3000.

### Testing Your Frame

For Frame testing, use the [Warpcast Frame Validator](https://warpcast.com/~/developers/frames).

You can either:
1. Use a service like localtunnel to expose your local server:
   ```
   npx localtunnel --port 3000
   ```
2. Or deploy to Vercel (see DEPLOYMENT.md)

The entry point for the Frame is at `/api/frame`.

## Development

### Project Structure

- `/src/app/api/frame/route.ts` - Main Frame API entry point
- `/src/app/frames/account-scanner/page.tsx` - Account scanner implementation
- `/src/app/api/generate-scanner-image/route.ts` - Dynamic image generation API
- `/src/lib/farcaster.ts` - Farcaster API integration
- `/src/lib/moderation.ts` - Content moderation logic
- `/public/assets/` - Static assets for Frame images

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## License

MIT
