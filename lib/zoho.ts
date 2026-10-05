// Helpers for reading Zoho Projects v3 payloads returned through MCP tools.
export const name = (v: any): string => (typeof v === 'string' ? v : v?.name ?? v?.display_name ?? '');
export const list = (raw: any, ...keys: string[]): any[] => {
  if (Array.isArray(raw)) return raw;
  for (const k of [...keys, 'data', 'items']) if (Array.isArray(raw?.[k])) return raw[k];
  return [];
};
