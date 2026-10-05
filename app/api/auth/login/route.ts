import { NextRequest, NextResponse } from 'next/server';
import { mcpUrl } from '@/lib/mcp';

export function GET(req: NextRequest) {
  const clientId = process.env.ZOHO_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL('/?error=config', req.url));
  if (!mcpUrl()) return NextResponse.redirect(new URL('/?error=mcp', req.url));
  const base = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    scope: 'AaaServer.profile.READ,email,profile',
    access_type: 'online',
  });
  return NextResponse.redirect(`${base}/oauth/v2/auth?${p}`);
}
