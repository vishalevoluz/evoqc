'use client';
import { useState } from 'react';

const LOGIN = '/api/auth/login';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
);

export default function Landing({ error, mcp, onMcp }: { error?: string; mcp: boolean; onMcp: (v: boolean) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [change, setChange] = useState(false);
  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const r = await fetch('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || 'Could not connect'); return; }
    setUrl(''); setChange(false); onMcp(true);
  };
  const Connect = (
    <div className="mcp">
      {mcp && !change ? (
        <div className="mcp-ok"><span><i />Zoho MCP connected</span><button className="btn sm" type="button" onClick={() => setChange(true)}>Change link</button></div>
      ) : (
        <form onSubmit={connect}>
          <label className="f" htmlFor="mcpUrl"><span>Step 1 of 2 · Zoho MCP link</span>
            <input type="text" id="mcpUrl" required placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} autoComplete="off" /></label>
          <div className="actions"><button className="btn pri" disabled={busy}>{busy ? 'Checking…' : 'Connect'}</button>{change && <button className="btn" type="button" onClick={() => setChange(false)}>Cancel</button>}</div>
          {msg && <div className="notice err">{msg}</div>}
        </form>
      )}
    </div>
  );
  const Cta = mcp && !change ? <a className="btn pri lg" href={LOGIN}>Step 2 · Sign in with Zoho</a> : <span className="count">Connect the MCP link above to unlock sign-in.</span>;
  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="EvoQC">
        <div className="brand"><h1>Evo<b>QC</b></h1></div>
        <div className="grow" />
        <a href="#how">How it works</a><a href="#features">Features</a><a href="#roles">Roles</a>
        {mcp ? <a className="btn pri" href={LOGIN}>Sign in with Zoho</a> : <a className="btn pri" href="#mcpUrl">Connect Zoho</a>}
      </nav>
      {error && <div className="lp-err"><div className="notice err">{error}</div></div>}

      <section className="lp-hero">
        <div>
          <span className="eyebrow">Quality control for Evoluz builds</span>
          <h2>Every Zoho task tested <em>before it ships.</em></h2>
          <p className="lead">EvoQC pulls your projects and tasks from Zoho Projects, lets admins write test cases against each task, and gives testers one place to record Pass, Fail or Pending. Each project and task then shows whether it is ready to release.</p>
          {Connect}
          <div className="lp-cta">{Cta}<a className="btn lg" href="#how">See how it works</a></div>
          <div className="lp-meta"><span><i />Zoho CRM, Books, Creator and native apps</span><span><i />Read-only towards Zoho</span><span><i />Admin and tester roles</span></div>
        </div>
        <div className="mock" aria-label="Example task in EvoQC">
          <div className="mock-h">
            <span className="crumbs">Lead Management Revamp › <span className="mini">EV1-T1</span></span><div className="grow" /><span className="verdict v-fix">Fixes needed</span>
            <b>Lead Blueprint: New → Qualified → Converted</b>
          </div>
          <div className="mock-src">
            <div><div className="sec"><i>Zoho</i> Developer</div>Rohit Sharma · <span className="zstat">In Review</span></div>
            <div><div className="sec"><i>Zoho</i> Last comment</div>“Done. Ready for QC.”</div>
          </div>
          <table>
            <thead><tr><th>ID</th><th>Scenario</th><th className="hide-s">Priority</th><th>Result</th></tr></thead>
            <tbody>
              <tr><td className="id">TC-001</td><td>Qualify blocked without Budget</td><td className="hide-s"><span className="prio High">High</span></td><td><span className="pill p">Pass</span></td></tr>
              <tr><td className="id">TC-002</td><td>Convert creates Deal with mapped fields</td><td className="hide-s"><span className="prio High">High</span></td><td><span className="pill f">Fail</span></td></tr>
              <tr><td className="id">TC-003</td><td>Disqualify requires a reason</td><td className="hide-s"><span className="prio Medium">Medium</span></td><td><span className="pill n">Pending</span></td></tr>
            </tbody>
          </table>
          <div className="mock-f"><span className="mono">1/3 pass</span><div className="bar"><span className="p" style={{ width: '33.3%' }} /><span className="f" style={{ width: '33.3%' }} /></div><span>Tested by Neha Gupta</span></div>
        </div>
      </section>

      <div className="lp-band"><section className="lp-sec" id="how">
        <span className="eyebrow">How it works</span>
        <h3>From Zoho task to release decision</h3>
        <p className="sub">EvoQC follows the work as it already exists in Zoho Projects. Nothing needs to be re-entered.</p>
        <ol className="flow">
          <li><div className="rule" /><h4>Sign in and sync</h4><p>Sign in with your Zoho account. Your projects appear automatically with their owner, status and dates.</p><span className="src"><i>Zoho</i> projects</span></li>
          <li><div className="rule" /><h4>Browse the tasks</h4><p>Each project lists its tasks with the developer, Zoho status, due date, description and the full comment thread.</p><span className="src"><i>Zoho</i> tasks · comments</span></li>
          <li><div className="rule" /><h4>Write test cases</h4><p>Admins add test cases to each task: scenario, type, priority, steps and expected result, numbered TC-001 onwards.</p><span className="src">EvoQC test cases</span></li>
          <li><div className="rule" /><h4>Test and decide</h4><p>Testers mark each case Pass, Fail or Pending with notes. Task and project verdicts update straight away.</p><span className="src">EvoQC results</span></li>
        </ol>
      </section></div>

      <section className="lp-sec" id="features">
        <span className="eyebrow">Features</span>
        <h3>What the team gets</h3>
        <p className="sub">Built for agencies running many Zoho and native builds in parallel, where QC must keep up with delivery.</p>
        <div className="feats">
          <div className="feat"><Icon><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></Icon><h4>Zoho Projects sync</h4><p>Projects and tasks come straight from your portal. A re-sync adds new tasks and comments and keeps every test case and result.</p></div>
          <div className="feat"><Icon><path d="M4 5h16M4 12h16M4 19h10" /><path d="M8 5v14" /></Icon><h4>Project › task hierarchy</h4><p>Expand any project to see its tasks, the developer on each one, and how far testing has got.</p></div>
          <div className="feat"><Icon><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></Icon><h4>Task context alongside tests</h4><p>The Zoho description and comments sit right above the test table, so testers know what was built and what changed.</p></div>
          <div className="feat"><Icon><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M9 9v11" /></Icon><h4>Test-case table</h4><p>Scenario, preconditions, type, priority, steps, expected and actual results in one editable table per task.</p></div>
          <div className="feat"><Icon><path d="M5 12l4 4 10-10" /></Icon><h4>One-click results</h4><p>Pass, Fail or Pending. Each result is stamped with the tester's name and time, and failures carry defect notes.</p></div>
          <div className="feat"><Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon><h4>Release verdicts</h4><p>Totals for projects, tasks, pass rate, open failures and overdue cases, plus a Ready / Fixes needed / In progress verdict for every project.</p></div>
        </div>
      </section>

      <div className="lp-band"><section className="lp-sec" id="roles">
        <span className="eyebrow">Roles</span>
        <h3>Admins own the test plan. Testers own the results.</h3>
        <p className="sub">Keeping the two apart means a test case can't be quietly changed to make a failing build pass.</p>
        <div className="roles">
          <div className="rolecard"><h4>Admin <span>QC lead · PM</span></h4><ul>
            <li>Sync projects from Zoho</li><li>Add, edit and delete test cases</li><li>Set priority, test type and due date</li><li>Record results like any tester</li></ul></div>
          <div className="rolecard"><h4>Tester <span>QA · reviewer</span></h4><ul>
            <li>Read task descriptions and Zoho comments</li><li>Mark cases Pass, Fail or Pending</li><li>Write actual results and defect notes</li><li className="no">Cannot change test cases or the Zoho link</li></ul></div>
        </div>
      </section></div>

      <section className="lp-sec">
        <span className="eyebrow">Coverage</span>
        <h3>One QC process for every platform you build on</h3>
        <p className="sub">Whatever the build, it is tested the same way and judged by the same verdict.</p>
        <div className="plats">
          {['Zoho CRM', 'Zoho Books', 'Zoho Creator', 'Zoho Desk', 'Zoho FSM', 'Zoho Analytics', 'Zoho People', 'Zoho Flow', 'Deluge functions', 'AWS Lambda integrations', 'Next.js / React', 'Supabase'].map(p => <span className="plat" key={p}><i />{p}</span>)}
        </div>
        <div className="verd">
          <div><span className="verdict v-ready">Ready</span><p>Every case run and passed.</p></div>
          <div><span className="verdict v-fix">Fixes needed</span><p>At least one case failed.</p></div>
          <div><span className="verdict v-prog">In progress</span><p>Cases still pending.</p></div>
          <div><span className="verdict v-none">No test cases</span><p>Nothing has a test plan yet.</p></div>
        </div>
      </section>

      <div className="lp-band"><div className="lp-end"><h3>Ready to test? Connect Zoho and sign in.</h3>{mcp ? <a className="btn pri lg" href={LOGIN}>Sign in with Zoho</a> : <a className="btn pri lg" href="#mcpUrl">Connect Zoho</a>}</div></div>
      <footer className="lp-foot"><span>EvoQC · Evoluz Global Solutions</span></footer>
    </div>
  );
}
