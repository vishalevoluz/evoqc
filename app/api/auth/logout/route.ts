import { NextRequest, NextResponse } from 'next/server';
import { COOKIE } from '@/lib/session';

export function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
