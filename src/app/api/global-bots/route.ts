import { NextResponse } from 'next/server';

// Mock data for testing
const MOCK_BOTS = [
  { fid: 1001, username: 'testbot1' },
  { fid: 1002, username: 'testbot2' },
  { fid: 1003, username: 'testbot3' },
];

export async function GET() {
  return NextResponse.json({
    bots: MOCK_BOTS
  });
} 