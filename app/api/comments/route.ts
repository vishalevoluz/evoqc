import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { buildArgs, findTool, openSession } from '@/lib/mcp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!getUser()) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const project = req.nextUrl.searchParams.get('project') || '';
  const task = req.nextUrl.searchParams.get('task') || '';
  const portal = req.nextUrl.searchParams.get('portal') || process.env.ZOHO_PORTAL_ID || '';
  try {
    const { tools, call } = await openSession();
    const tool = findTool(tools, [/task/, /comment/], /tasklist|subtask|create|update|delete|add|count/);
    if (!tool) return NextResponse.json({ comments: [], note: 'No task-comments tool on this MCP server.' });
    const raw = await call(tool, buildArgs(tool.inputSchema, { portal, project, task }));
    const arr: any[] = Array.isArray(raw) ? raw : raw?.comments ?? raw?.data ?? [];
    return NextResponse.json({
      comments: arr.map(c => ({
        who: String(c.user?.name ?? c.added_by?.name ?? c.created_by?.name ?? c.added_by_name ?? c.author ?? ''),
        at: String(c.created_time ?? c.added_time ?? c.created_time_long ?? ''),
        text: String(c.content ?? c.comment ?? '').replace(/<[^>]+>/g, ''),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
