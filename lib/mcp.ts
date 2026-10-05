import { cookies } from 'next/headers';

// Minimal MCP client (streamable HTTP) for the Zoho MCP server.
export const MCP_COOKIE = 'evoqc_mcp';

export function mcpUrl(): string {
  const c = cookies().get(MCP_COOKIE)?.value;
  if (c) { try { return decodeURIComponent(c); } catch { return c; } }
  return process.env.ZOHO_MCP_URL || '';
}

type Tool = { name: string; description?: string; inputSchema?: any };

async function rpc(url: string, body: object, session?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(session ? { 'Mcp-Session-Id': session } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`MCP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  if (!text.trim()) return { msg: {} as any, session: res.headers.get('mcp-session-id') || session };
  // Response is either plain JSON or an SSE stream with `data: {...}` lines.
  const json = text.trimStart().startsWith('{')
    ? text
    : text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).pop() || '{}';
  return { msg: JSON.parse(json), session: res.headers.get('mcp-session-id') || session };
}

export async function openSession(url = mcpUrl()) {
  if (!url) throw new Error('Zoho MCP link is not set. Add it on the home page first.');
  const init = await rpc(url, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'evoqc', version: '1.0.0' } },
  });
  if (init.msg.error) throw new Error(init.msg.error.message || 'MCP initialize failed');
  await rpc(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.session).catch(() => {});
  const list = await rpc(url, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, init.session);
  const tools: Tool[] = list.msg.result?.tools ?? [];
  let n = 10;

  async function call(tool: Tool, args: object) {
    const { msg } = await rpc(url, { jsonrpc: '2.0', id: n++, method: 'tools/call', params: { name: tool.name, arguments: args } }, init.session);
    if (msg.error) throw new Error(msg.error.message || `${tool.name} failed`);
    const text = msg.result?.content?.find((c: any) => c.type === 'text')?.text;
    if (msg.result?.isError) throw new Error(String(text || `${tool.name} failed`).slice(0, 300));
    try { return JSON.parse(text); } catch { return text; }
  }
  return { tools, call };
}

// Find a tool by name patterns (Zoho tool names can differ slightly between MCP servers).
export function findTool(tools: Tool[], all: RegExp[], not?: RegExp) {
  // Compare on a normalised name so get_projects, getProjects and ZohoProjects_getProjects all match.
  const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return tools.find(t => all.every(r => r.test(norm(t.name))) && !(not && not.test(norm(t.name))));
}

// Fill a tool's input schema from known ids. Handles flat args and Zoho's nested
// path_variables / query_params style by recursing into object properties.
export function buildArgs(schema: any, ids: { portal?: string; project?: string; task?: string }): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, def] of Object.entries<any>(schema?.properties ?? {})) {
    const k = key.toLowerCase();
    if (def?.type === 'object' && def.properties) {
      const inner = buildArgs(def, ids);
      if (Object.keys(inner).length || schema.required?.includes(key)) out[key] = inner;
    } else if (k.includes('portal') && ids.portal) out[key] = ids.portal;
    else if (k.includes('project') && ids.project) out[key] = ids.project;
    else if (k.includes('task') && !k.includes('list') && ids.task) out[key] = ids.task;
  }
  return out;
}

export function setPaging(args: Record<string, any>, schema: any, page: number, have: number) {
  const walk = (a: any, s: any) => {
    for (const [key, def] of Object.entries<any>(s?.properties ?? {})) {
      if (def?.type === 'object' && def.properties) { a[key] = a[key] ?? {}; walk(a[key], def); continue; }
      if (key === 'page') a[key] = page;
      if (key === 'index') a[key] = have + 1;
    }
  };
  walk(args, schema);
}
