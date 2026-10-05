import { NextRequest, NextResponse } from 'next/server';
import { MCP_COOKIE, mcpUrl, openSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

// Save the Zoho MCP link (checked first) in an httpOnly cookie so it can be entered before sign-in.
export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({ url: '' }));
  const clean = String(url || '').trim();
  if (!/^https:\/\//i.test(clean)) return NextResponse.json({ error: 'The MCP link must start with https://' }, { status: 400 });
  try {
    const { tools } = await openSession(clean);
    if (!tools.length) throw new Error('Connected, but the server lists no tools.');
  } catch (e: any) {
    return NextResponse.json({ error: `Could not connect: ${e.message}` }, { status: 502 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MCP_COOKIE, encodeURIComponent(clean), {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export function GET() {
  return NextResponse.json({ configured: !!mcpUrl() });
}

export function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MCP_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
