import { NextResponse } from 'next/server';
import { getUser } from '@/lib/session';
import { buildArgs, findTool, openSession } from '@/lib/mcp';
import { list, name } from '@/lib/zoho';

export const dynamic = 'force-dynamic';

const owner = (p: any) => p.owner_name ?? name(p.owner) ?? p.details?.owners?.[0]?.name ?? '';

// Only the project list is fetched here. Tasks load per project when it is opened,
// which keeps us well under Zoho's 200 requests / 2 minutes limit per API.
export async function GET() {
  if (!getUser()) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const { tools, call } = await openSession();
    const portalsTool = findTool(tools, [/getportals$/]);
    let portal = process.env.ZOHO_PORTAL_ID || '';
    if (!portal && portalsTool) {
      const ps = list(await call(portalsTool, {}), 'portals');
      portal = String(ps[0]?.id_string ?? ps[0]?.id ?? '');
    }
    const projectsTool = findTool(tools, [/(get|list)projects(list)?$/], /task|user|comment|count|portal/) ?? findTool(tools, [/project/, /(get|list)/], /task|user|comment|count|portal|member|document|forum|bug|issue|timesheet|milestone|phase|tasklist|detail/);
    if (!projectsTool) throw new Error('No projects tool found on this MCP server. Tools available: ' + (tools.map(t => t.name).join(', ') || 'none'));
    const hasTasks = !!findTool(tools, [/task/, /project/], /count|tasklist|portal|comment|subtask|user|create|update|delete|add|filter|search/);

    const projects = list(await call(projectsTool, buildArgs(projectsTool.inputSchema, { portal })), 'projects').map(p => ({
      id: String(p.id_string ?? p.id ?? p.project_id ?? p.name),
      name: String(p.name ?? p.project_name ?? 'Untitled'),
      status: name(p.status) || name(p.project_status),
      owner: owner(p),
    }));
    return NextResponse.json({ projects, hasTasks, portal });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
