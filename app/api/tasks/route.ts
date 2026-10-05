import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { buildArgs, findTool, openSession, setPaging } from '@/lib/mcp';
import { list, name } from '@/lib/zoho';

export const dynamic = 'force-dynamic';

// Short server-side cache so re-opening a project never costs another Zoho call.
const cache = new Map<string, { at: number; tasks: any[] }>();
const TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  if (!getUser()) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const project = sp.get('project') || '';
  const portal = sp.get('portal') || process.env.ZOHO_PORTAL_ID || '';
  const ck = `${portal}:${project}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL && !sp.get('refresh')) return NextResponse.json({ tasks: hit.tasks, cached: true });
  try {
    const { tools, call } = await openSession();
    const tool = findTool(tools, [/task/, /project/], /count|tasklist|portal|comment|subtask|user|create|update|delete|add|filter|search/);
    if (!tool) return NextResponse.json({ tasks: [], note: 'No tasks-by-project tool on this MCP server.' });
    const args = buildArgs(tool.inputSchema, { portal, project });
    let raw: any[] = [];
    for (let page = 1; page <= 10; page++) {
      setPaging(args, tool.inputSchema, page, raw.length);
      const res = await call(tool, args);
      const got = list(res, 'tasks');
      raw = raw.concat(got);
      if (!res?.page_info?.has_next_page || !got.length) break;
    }
    const tasks = raw.map(t => ({
      id: String(t.id_string ?? t.id),
      name: String(t.name ?? t.title ?? 'Untitled task'),
      status: name(t.status),
      owner: t.owner_name ?? t.owners_and_work?.owners?.map((o: any) => o.name).join(', ') ?? t.details?.owners?.map((o: any) => o.name).join(', ') ?? name(t.owner) ?? '',
      due: String(t.end_date ?? t.due_date ?? '').slice(0, 10),
      desc: String(t.description ?? ''),
    })).filter(t => t.id !== 'undefined');
    cache.set(ck, { at: Date.now(), tasks });
    return NextResponse.json({ tasks });
  } catch (e: any) {
    const m = String(e.message);
    const wait = m.match(/after (\d+) minu/);
    return NextResponse.json({ error: m.includes('THROTTLES') ? `Zoho rate limit reached. Try again${wait ? ` in ${wait[1]} minutes` : ' in a few minutes'}.` : m.slice(0, 300) }, { status: 502 });
  }
}
