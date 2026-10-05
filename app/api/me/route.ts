import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { mcpUrl } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const GET = () => NextResponse.json({ user: getUser(), mcp: !!mcpUrl() });
