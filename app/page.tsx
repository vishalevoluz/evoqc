'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Landing from './Landing';

const STATUSES = ['Pending', 'Pass', 'Fail'] as const;
const TYPES = ['Functional', 'Workflow / Automation', 'Integration / API', 'Deluge function', 'UI / Layout', 'Permissions / Profiles', 'Data / Import', 'Regression'];
const PRIOS = ['High', 'Medium', 'Low'];
type Status = (typeof STATUSES)[number];
type Case = {
  id: string; code: string; title: string; area: string; type: string; priority: string;
  pre: string; steps: string; expected: string; actual: string;
  owner: string; due: string; status: Status; testedBy: string; testedAt: string;
};
type Task = { id: string; name: string; status: string; owner: string; due: string; desc: string };
type Project = { id: string; name: string; status: string; owner: string; tasks: Task[] };
type Loaded = Record<string, true | string>; // project id -> loaded, or an error message
type Comment = { who: string; at: string; text: string };
type User = { name: string; email: string };

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const days = (d: string) => Math.round((Date.parse(d) - Date.parse(today())) / 86400000);
const isOverdue = (c: Case) => c.status === 'Pending' && !!c.due && days(c.due) < 0;
const dueNote = (c: Case) => {
  if (!c.due) return '';
  if (c.status !== 'Pending') return c.due;
  const n = days(c.due);
  return `${c.due} · ${n < 0 ? `${-n}d overdue` : n === 0 ? 'due today' : `in ${n}d`}`;
};
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(/^\d+$/.test(iso) ? Number(iso) : iso);
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
const tally = (l: Case[]) => {
  const t = { total: l.length, Pass: 0, Fail: 0, Pending: 0 };
  l.forEach(c => t[c.status || 'Pending']++);
  return t;
};
const verdict = (t: ReturnType<typeof tally>): [string, string] =>
  !t.total ? ['v-none', 'No test cases']
    : t.Fail ? ['v-fix', 'Fixes needed']
    : t.Pending ? ['v-prog', 'Testing in progress']
    : ['v-ready', 'Ready for release'];
const initials = (n: string) => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

function Bar({ t }: { t: ReturnType<typeof tally> }) {
  const w = (k: Status) => (t.total ? `${(t[k] / t.total) * 100}%` : '0%');
  return (
    <div className="bar" role="img" aria-label={`${t.Pass} passed, ${t.Fail} failed, ${t.Pending} pending`}>
      <span className="p" style={{ width: w('Pass') }} /><span className="f" style={{ width: w('Fail') }} />
    </div>
  );
}

const blank = { title: '', area: '', type: TYPES[0], priority: 'Medium', pre: '', steps: '', expected: '', owner: '', due: '' };

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [mcp, setMcp] = useState(false);
  const [checked, setChecked] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [hasTasks, setHasTasks] = useState(true);
  const [portal, setPortal] = useState('');
  const [tload, setTload] = useState<Record<string, true | 'loading' | string>>({});
  const fresh = useRef(false); // set by Sync so the next task fetch bypasses the server cache
  const [cases, setCases] = useState<Record<string, Case[]>>({}); // keyed by task id (or project id when it has no tasks)
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [tester, setTester] = useState('');
  const [selP, setSelP] = useState<string | null>(null);
  const [selT, setSelT] = useState<string | null>(null);
  const [openP, setOpenP] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[] | 'loading' | string>>({});
  const [q, setQ] = useState('');
  const [caseFilter, setCaseFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [draft, setDraft] = useState<Case | null>(null);
  const [armDelete, setArmDelete] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const e = sp.get('error'), reason = sp.get('reason');
    if (e) setLoginError(({
      config: 'Zoho is not configured. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env.local and restart the server.',
      mcp: 'Add your Zoho MCP link first (step 1), then sign in.',
      denied: 'Sign-in was cancelled or Zoho returned no code.',
      token: 'Zoho rejected the sign-in (check the client secret, redirect URI and data centre).',
      profile: 'Could not read your Zoho profile or email.',
    } as Record<string, string>)[e] + (e === 'token' && reason ? ` Zoho said: ${reason}` : '') || 'Sign-in failed.');
    try { setCases(JSON.parse(localStorage.getItem('evoqc.cases.v3') || '{}')); } catch {}
    try { setTester(localStorage.getItem('evoqc.tester') || ''); } catch {}
    setLoaded(true);
    fetch('/api/me').then(r => r.json()).then(d => { setUser(d.user); setMcp(!!d.mcp); }).finally(() => setChecked(true));
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem('evoqc.cases.v3', JSON.stringify(cases)); } catch {} }, [cases, loaded]);
  useEffect(() => { if (loaded) try { localStorage.setItem('evoqc.tester', tester); } catch {} }, [tester, loaded]);
  useEffect(() => { if (user && !tester) setTester(user.name); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = useCallback(async () => {
    setSyncing(true); setErr('');
    try {
      const r = await fetch('/api/projects');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Sync failed');
      setProjects(d.projects.map((p: Project) => ({ ...p, tasks: [] })));
      setTload({});
      fresh.current = true;
      setHasTasks(d.hasTasks);
      setPortal(d.portal || '');
      setSelP(s => s && d.projects.some((p: Project) => p.id === s) ? s : d.projects[0]?.id ?? null);
      setOpenP(s => (s.size ? s : new Set(d.projects[0] ? [d.projects[0].id] : [])));
    } catch (e: any) { setErr(e.message); }
    setSyncing(false);
  }, []);
  // Projects, their tasks and (on opening a task) comments appear once the user is signed in.
  useEffect(() => { if (user) sync(); }, [user, sync]);

  // Tasks load for the selected project only (keeps Zoho API usage low); the server caches them.
  useEffect(() => {
    if (!selP || !user || (!portal && hasTasks && !projects.length) || tload[selP]) return;
    const pid = selP, refresh = fresh.current ? '&refresh=1' : '';
    fresh.current = false;
    setTload(s => ({ ...s, [pid]: 'loading' }));
    fetch(`/api/tasks?portal=${encodeURIComponent(portal)}&project=${encodeURIComponent(pid)}${refresh}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setTload(s => ({ ...s, [pid]: d.error || 'Could not load tasks' })); return; }
        setProjects(ps => ps.map(p => (p.id === pid ? { ...p, tasks: d.tasks } : p)));
        setTload(s => ({ ...s, [pid]: true }));
      })
      .catch(() => setTload(s => ({ ...s, [pid]: 'Could not load tasks' })));
  }, [selP, user, portal, tload, hasTasks, projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = selT ?? selP; // the item whose test cases are shown
  const project = projects.find(p => p.id === selP) || null;
  const task = project?.tasks.find(t => t.id === selT) || null;

  useEffect(() => {
    if (!selT || !selP || comments[selT]) return;
    setComments(c => ({ ...c, [selT]: 'loading' }));
    fetch(`/api/comments?portal=${encodeURIComponent(portal)}&project=${encodeURIComponent(selP)}&task=${encodeURIComponent(selT)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => setComments(c => ({ ...c, [selT]: ok ? d.comments : `Could not load comments: ${d.error}` })))
      .catch(() => setComments(c => ({ ...c, [selT]: 'Could not load comments.' })));
  }, [selT, selP]); // eslint-disable-line react-hooks/exhaustive-deps

  const casesOfProject = (p: Project) => (p.tasks.length ? p.tasks.flatMap(t => cases[t.id] || []) : cases[p.id] || []);
  const flat = useMemo(() => projects.flatMap(p => (p.tasks.length ? p.tasks.flatMap(t => cases[t.id] || []) : cases[p.id] || [])), [projects, cases]);
  const allTasks = projects.flatMap(p => p.tasks);
  const T = tally(flat);
  const run = T.Pass + T.Fail;
  const overdue = flat.filter(isOverdue).length;
  const soon = flat.filter(c => c.status === 'Pending' && c.due && days(c.due) >= 0 && days(c.due) <= 7).length;
  const covered = allTasks.filter(t => (cases[t.id] || []).length).length;

  const all = key ? cases[key] || [] : [];
  const AT = tally(all);
  const shown = caseFilter === 'All' ? all : caseFilter === 'Overdue' ? all.filter(isOverdue) : all.filter(c => c.status === caseFilter);
  const ql = q.toLowerCase();

  const setList = (k: string, fn: (l: Case[]) => Case[]) => setCases(s => ({ ...s, [k]: fn(s[k] || []) }));
  const patch = (k: string, id: string, p: Partial<Case>) => setList(k, l => l.map(c => (c.id === id ? { ...c, ...p } : c)));
  const reset = () => { setOpenCase(null); setDraft(null); setShowForm(false); setArmDelete(null); setCaseFilter('All'); };

  const addCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !form.title.trim()) return;
    const seq = Math.max(0, ...all.map(c => parseInt(c.code.slice(3)) || 0)) + 1;
    const code = 'TC-' + String(seq).padStart(3, '0');
    setList(key, l => [...l, { ...form, id: uid(), code, title: form.title.trim(), owner: form.owner.trim() || user?.name || '', actual: '', status: 'Pending', testedBy: '', testedAt: '' }]);
    setForm(blank);
    say(code + ' added');
  };
  const setStatus = (c: Case, s: Status) => {
    if (!key || c.status === s) return;
    if (s !== 'Pending' && !tester.trim()) { say('Enter your name under "Testing as" first'); return; }
    patch(key, c.id, { status: s, testedBy: s === 'Pending' ? '' : tester.trim(), testedAt: s === 'Pending' ? '' : new Date().toISOString() });
  };
  const toggle = (c: Case) => {
    if (openCase === c.id) { setOpenCase(null); setDraft(null); } else { setOpenCase(c.id); setDraft(c); }
    setArmDelete(null);
  };
  const saveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !draft) return;
    patch(key, draft.id, { title: draft.title.trim(), area: draft.area, type: draft.type, priority: draft.priority, pre: draft.pre, steps: draft.steps, expected: draft.expected, actual: draft.actual, owner: draft.owner, due: draft.due });
    setOpenCase(null); setDraft(null); say('Case saved');
  };
  const resetRun = () => {
    if (!key) return;
    setList(key, l => l.map(c => ({ ...c, status: 'Pending', testedBy: '', testedAt: '', actual: '' })));
    say('Results cleared for a new run');
  };
  const csv = () => {
    if (!key) return;
    const rows = [['ID', 'Scenario', 'Module', 'Type', 'Priority', 'QC owner', 'Due', 'Preconditions', 'Steps', 'Expected', 'Actual', 'Status', 'Tested by', 'Tested at']]
      .concat(all.map(c => [c.code, c.title, c.area, c.type, c.priority, c.owner, c.due, c.pre, c.steps, c.expected, c.actual, c.status, c.testedBy, c.testedAt]));
    const body = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    a.download = `EvoQC_${(task?.name || project?.name || 'cases').replace(/[^\w]+/g, '_')}.csv`;
    a.click();
  };
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); setProjects([]); setSelP(null); setSelT(null); };

  const Top = (
    <header className="top"><div className="top-in">
      <div className="brand"><h1>Evo<b>QC</b></h1><span>Quality control register · Evoluz</span></div>
      <div className="grow" />
      {user && (
        <>
          <label className="tester" htmlFor="testerName">Testing as <input type="text" id="testerName" placeholder="Your name" value={tester} onChange={e => setTester(e.target.value)} /></label>
          <span className="count">{user.email}</span>
          <button className="btn sm" onClick={logout}>Sign out</button>
        </>
      )}
    </div></header>
  );

  if (!checked) return <>{Top}<main className="wrap"><div className="empty">Loading...</div></main></>;
  if (!user) return <Landing error={loginError} mcp={mcp} onMcp={setMcp} />;

  const heading = task ? task.name : project?.name;
  const hv = verdict(AT);

  return (
    <>
      {Top}
      <main className="wrap">
        {err && <div className="notice err">Could not sync from Zoho: {err}</div>}
        {!err && !syncing && projects.length > 0 && !hasTasks && <div className="notice">This MCP server has no "tasks by project" tool, so test cases attach to projects.</div>}

        <section className="kpis" aria-label="Summary">
          <div className="kpi"><span className="l">Projects</span><span className="v">{projects.length}</span><span className="s">{allTasks.length} tasks synced</span></div>
          <div className="kpi"><span className="l">Tasks with tests</span><span className="v">{allTasks.length ? covered : '–'}</span><span className="s">{allTasks.length ? `${allTasks.length - covered} without test cases` : 'Sync to begin'}</span></div>
          <div className="kpi"><span className="l">Test cases</span><span className="v">{T.total}</span><span className="s">{T.Pending} pending</span></div>
          <div className="kpi"><span className="l">Pass rate</span><span className="v">{run ? Math.round((T.Pass / run) * 100) + '%' : '–'}</span><span className="s">{run} executed</span></div>
          <div className={'kpi' + (T.Fail ? ' bad' : '')}><span className="l">Open failures</span><span className="v">{T.Fail}</span><span className="s">{T.Pass} passed</span></div>
          <div className={'kpi' + (overdue ? ' bad' : '')}><span className="l">Overdue</span><span className="v">{overdue}</span><span className="s">{soon} due in 7 days</span></div>
        </section>

        <div className="panes">
          <section className="pane" aria-label="Projects and tasks">
            <div className="pane-h">
              <h2>Projects &amp; tasks</h2><span className="count">{projects.length ? `${projects.length} projects` : ''}</span>
              <div className="grow" />
              <button className="btn pri sm" onClick={sync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync from Zoho'}</button>
            </div>
            <div className="filters">
              <input type="text" placeholder="Search project or task" aria-label="Search" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <ul className="tree">
              {syncing && !projects.length && <li className="empty">Syncing projects and tasks from Zoho...</li>}
              {!syncing && !projects.length && !err && <li className="empty"><strong>No projects found</strong>Projects from Zoho appear here automatically.</li>}
              {projects.map(p => {
                const tasks = p.tasks.filter(t => !ql || (p.name + ' ' + t.name).toLowerCase().includes(ql));
                if (ql && !tasks.length && !p.name.toLowerCase().includes(ql)) return null;
                const open = openP.has(p.id) || !!ql;
                const tp = tally(casesOfProject(p)), [vc, vt] = verdict(tp);
                return (
                  <li key={p.id} className={'proj' + (open ? ' open' : '')}>
                    <button aria-expanded={open} aria-current={selP === p.id && !selT} onClick={() => {
                      setOpenP(s => { const n = new Set(s); if (selP === p.id && !selT && n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; });
                      setSelP(p.id); setSelT(null); reset();
                    }}>
                      <span className="caret">▶</span><span className="pn">{p.name}</span><span className={'verdict ' + vc}>{vt}</span>
                      <span className="pm">{p.status && <span className="zstat">{p.status}</span>}{p.owner && <span>{p.owner}</span>}{tload[p.id] === true && <span>{p.tasks.length} tasks</span>}</span>
                      <span className="pbar"><Bar t={tp} /></span>
                    </button>
                    {open && tload[p.id] === 'loading' && <div className="tasks-note">Loading tasks...</div>}
                    {open && typeof tload[p.id] === 'string' && tload[p.id] !== 'loading' && (
                      <div className="tasks-note err">{tload[p.id] as string} <button className="btn sm" onClick={() => setTload(s => { const n = { ...s }; delete n[p.id]; return n; })}>Retry</button></div>
                    )}
                    {open && tload[p.id] === true && tasks.length === 0 && <div className="tasks-note">No tasks in this project.</div>}
                    {open && tasks.length > 0 && (
                      <ul className="tasks">
                        {tasks.map(t => {
                          const tt = tally(cases[t.id] || []);
                          return (
                            <li key={t.id}>
                              <button className="task" aria-current={selT === t.id} onClick={() => { setSelP(p.id); setSelT(t.id); reset(); }}>
                                <span className="tn">{t.name}</span><span className="verdict">{tt.total ? `${tt.Pass}/${tt.total}` : '–'}</span>
                                <span className="tm">{t.owner && <span>{t.owner}</span>}{t.status && <span className="zstat">{t.status}</span>}{t.due && <span>Due {t.due}</span>}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="pane" aria-label="Details">
            {!project || !key ? (
              <div className="empty"><strong>Select a project or task</strong>Its Zoho details, comments and QC test cases appear here.</div>
            ) : (
              <>
                <div className="dh">
                  <div className="crumb">
                    {task ? <><button onClick={() => { setSelT(null); reset(); }}>{project.name}</button><span>›</span><span>Task</span></> : <span>Zoho project</span>}
                  </div>
                  <div className="row"><h2>{heading}</h2><span className={'verdict ' + hv[0]}>{hv[1]}</span></div>
                  <div className="facts">
                    {task ? (
                      <>
                        <div className="fact"><div className="l">Developed by</div><div className="v">{task.owner || '—'}</div></div>
                        <div className="fact"><div className="l">Zoho status</div><div className="v">{task.status || '—'}</div></div>
                        <div className="fact"><div className="l">Due</div><div className="v">{task.due || '—'}</div></div>
                      </>
                    ) : (
                      <>
                        <div className="fact"><div className="l">Zoho status</div><div className="v">{project.status || '—'}</div></div>
                        <div className="fact"><div className="l">Project owner</div><div className="v">{project.owner || '—'}</div></div>
                        <div className="fact"><div className="l">Tasks</div><div className="v">{project.tasks.length}</div></div>
                      </>
                    )}
                    <div className="fact"><div className="l">Overdue cases</div><div className="v">{all.filter(isOverdue).length}</div></div>
                  </div>
                  <Bar t={AT} />
                  <div className="tally">
                    <span><b>{AT.total}</b> test cases</span>
                    <span><i className="dot" style={{ background: 'var(--pass)' }} /><b>{AT.Pass}</b> pass</span>
                    <span><i className="dot" style={{ background: 'var(--fail)' }} /><b>{AT.Fail}</b> fail</span>
                    <span><i className="dot" style={{ background: 'var(--idle)' }} /><b>{AT.Pending}</b> pending</span>
                  </div>
                  <div className="actions">
                    <button className="btn sm" onClick={resetRun} disabled={!AT.total}>Start new test run</button>
                    <button className="btn sm" onClick={csv} disabled={!AT.total}>Export CSV</button>
                  </div>
                </div>

                {!task && project.tasks.length > 0 && (
                  <div className="tbl-wrap"><table className="cases">
                    <thead><tr><th>Task</th><th>Developer</th><th>Zoho status</th><th>Due</th><th>Cases</th><th>Pass</th><th>Fail</th><th>Verdict</th></tr></thead>
                    <tbody>
                      {project.tasks.map(t => {
                        const tt = tally(cases[t.id] || []), [vc, vt] = verdict(tt);
                        return (
                          <tr key={t.id} className="clickrow" tabIndex={0} onClick={() => { setSelT(t.id); reset(); }} onKeyDown={e => e.key === 'Enter' && (setSelT(t.id), reset())}>
                            <td>{t.name}</td><td>{t.owner || '–'}</td><td>{t.status || '–'}</td><td>{t.due || '–'}</td>
                            <td className="mono">{tt.total}</td><td className="mono">{tt.Pass}</td><td className="mono">{tt.Fail}</td>
                            <td><span className={'verdict ' + vc}>{vt}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                )}

                {task && (
                  <div className="zsrc">
                    <div><h4 className="sec"><i>Zoho</i> Task description</h4><div className="desc">{task.desc ? task.desc.replace(/<[^>]+>/g, '') : <span className="muted">No description in Zoho.</span>}</div></div>
                    <div>
                      <h4 className="sec"><i>Zoho</i> Comments{Array.isArray(comments[task.id]) ? ` · ${(comments[task.id] as Comment[]).length}` : ''}</h4>
                      {comments[task.id] === 'loading' || !comments[task.id] ? <span className="muted">Loading comments...</span>
                        : typeof comments[task.id] === 'string' ? <span className="muted">{comments[task.id] as string}</span>
                        : (comments[task.id] as Comment[]).length === 0 ? <span className="muted">No comments yet.</span>
                        : (
                          <ul className="comments">
                            {(comments[task.id] as Comment[]).map((c, i) => (
                              <li className="cm" key={i}><span className="av">{initials(c.who || '?')}</span>
                                <div><div className="who"><b>{c.who || 'Unknown'}</b> · {fmtDate(c.at)}</div><p>{c.text}</p></div></li>
                            ))}
                          </ul>
                        )}
                    </div>
                  </div>
                )}

                {(task || !project.tasks.length) && (
                  <>
                    <div className="toolbar">
                      <h3 style={{ margin: 0, fontSize: 16 }}>Test cases</h3>
                      <select aria-label="Show cases" value={caseFilter} onChange={e => setCaseFilter(e.target.value)}>
                        {['All', ...STATUSES, 'Overdue'].map(s => <option key={s}>{s}</option>)}
                      </select>
                      <span className="count">{shown.length} shown</span>
                      <div className="grow" />
                      <button className="btn pri sm" onClick={() => setShowForm(!showForm)}>Add test case</button>
                    </div>

                    {showForm && (
                      <form className="form" onSubmit={addCase}>
                        <h3>New test case</h3>
                        <label className="f full">Scenario<input type="text" required autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Lead converts to Deal with correct owner" /></label>
                        <label className="f">Module / area<input type="text" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} /></label>
                        <label className="f">Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
                        <label className="f">Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIOS.map(t => <option key={t}>{t}</option>)}</select></label>
                        <label className="f">Due date<input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></label>
                        <label className="f">QC owner<input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} placeholder={user.name} /></label>
                        <label className="f">Preconditions<input type="text" value={form.pre} onChange={e => setForm({ ...form, pre: e.target.value })} /></label>
                        <label className="f full">Steps<textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} /></label>
                        <label className="f full">Expected result<textarea value={form.expected} onChange={e => setForm({ ...form, expected: e.target.value })} /></label>
                        <div className="actions full"><button className="btn pri" type="submit">Add test case</button><button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
                      </form>
                    )}

                    {!shown.length && <div className="empty">{AT.total ? 'No cases match this filter.' : <><strong>No test cases yet</strong>Write the scenarios QC must cover before this can be released.</>}</div>}
                    {shown.length > 0 && (
                      <div className="tbl-wrap"><table className="cases">
                        <thead><tr><th>ID</th><th>Test case</th><th>Priority</th><th>QC owner</th><th>Due</th><th>Result</th></tr></thead>
                        {shown.map(c => (
                          <tbody className={'case' + (isOverdue(c) ? ' late' : '')} key={c.id}>
                            <tr>
                              <td className="id">{c.code}</td>
                              <td>
                                <button className="tt" aria-expanded={openCase === c.id} onClick={() => toggle(c)}>{c.title}</button>
                                <div className="sub">{c.type}{c.area ? ` · ${c.area}` : ''}{c.testedBy && ` · ${c.status} by ${c.testedBy}, ${fmtDate(c.testedAt)}`}</div>
                              </td>
                              <td><span className={'prio ' + c.priority}>{c.priority}</span></td>
                              <td>{c.owner || '–'}</td>
                              <td className={isOverdue(c) ? 'late-t' : ''}>{c.due ? dueNote(c) : '–'}</td>
                              <td>
                                <div className="seg" role="group" aria-label={'Result for ' + c.code}>
                                  {STATUSES.map(s => <button key={s} type="button" data-s={s} aria-pressed={c.status === s} onClick={() => setStatus(c, s)}>{s}</button>)}
                                </div>
                              </td>
                            </tr>
                            {openCase === c.id && draft && (
                              <tr><td colSpan={6} className="edit-cell">
                                <form className="case-edit" onSubmit={saveDraft}>
                                  <label className="f full">Scenario<input type="text" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
                                  <label className="f">Module / area<input type="text" value={draft.area} onChange={e => setDraft({ ...draft, area: e.target.value })} /></label>
                                  <label className="f">Type<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
                                  <label className="f">Priority<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}>{PRIOS.map(t => <option key={t}>{t}</option>)}</select></label>
                                  <label className="f">Due date<input type="date" value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></label>
                                  <label className="f">QC owner<input type="text" value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} /></label>
                                  <label className="f">Preconditions<input type="text" value={draft.pre} onChange={e => setDraft({ ...draft, pre: e.target.value })} /></label>
                                  <label className="f full">Steps<textarea value={draft.steps} onChange={e => setDraft({ ...draft, steps: e.target.value })} /></label>
                                  <label className="f">Expected result<textarea value={draft.expected} onChange={e => setDraft({ ...draft, expected: e.target.value })} /></label>
                                  <label className="f">Actual result / defect notes<textarea value={draft.actual} onChange={e => setDraft({ ...draft, actual: e.target.value })} /></label>
                                  <div className="actions full">
                                    <button className="btn pri sm" type="submit">Save case</button><div className="grow" />
                                    {armDelete === c.id ? (
                                      <>
                                        <span className="count">Delete {c.code}?</span>
                                        <button className="btn sm danger" type="button" onClick={() => { setList(key, l => l.filter(x => x.id !== c.id)); setOpenCase(null); setDraft(null); setArmDelete(null); say('Test case deleted'); }}>Delete</button>
                                        <button className="btn sm" type="button" onClick={() => setArmDelete(null)}>Keep</button>
                                      </>
                                    ) : <button className="btn sm danger" type="button" onClick={() => setArmDelete(c.id)}>Delete case</button>}
                                  </div>
                                </form>
                              </td></tr>
                            )}
                          </tbody>
                        ))}
                      </table></div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
