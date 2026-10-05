import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export type User = { name: string; email: string };
const NAME = 'evoqc_session';
const secret = () => process.env.SESSION_SECRET || 'dev-only-secret';
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

export const encode = (u: User) => {
  const v = Buffer.from(JSON.stringify(u)).toString('base64url');
  return `${v}.${sign(v)}`;
};

export function getUser(): User | null {
  const raw = cookies().get(NAME)?.value;
  if (!raw) return null;
  const [v, s] = raw.split('.');
  if (!v || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(v));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString()); } catch { return null; }
}

export const COOKIE = NAME;
