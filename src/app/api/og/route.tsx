import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          color: '#FFFFFF',
          fontFamily: 'Helvetica',
        }}
      >
        <h1 style={{ fontSize: 60, margin: 0 }}>Bot Detector</h1>
        <p style={{ fontSize: 30, margin: '20px 0 0 0', opacity: 0.8 }}>
          Unfollow bots in your network
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
} 