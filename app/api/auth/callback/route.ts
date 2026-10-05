import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, encode } from '@/lib/session';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const home = (q = '') => NextResponse.redirect(new URL(`/${q}`, req.url));
  if (!code) return home('?error=denied');
  const base = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
  const tok = await fetch(`${base}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      redirect_uri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    }),
  }).then(r => r.json());
  if (!tok.access_token) {
    console.error('Zoho token exchange failed:', JSON.stringify(tok));
    return home(`?error=token&reason=${encodeURIComponent(String(tok.error || 'unknown'))}`);
  }

  const me = await fetch(`${base}/oauth/user/info`, {
    headers: { Authorization: `Zoho-oauthtoken ${tok.access_token}` },
  }).then(r => r.json());
  const email = me.Email || me.email;
  if (!email) return home('?error=profile');

  const res = home();
  res.cookies.set(COOKIE, encode({ name: me.Display_Name || me.name || email, email }), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
