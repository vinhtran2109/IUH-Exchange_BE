type AdminTrashTone = 'idle' | 'mock' | 'safe' | 'blocked';

type AdminTrashNode = {
  id: string;
  title: string;
  owner: string;
  tone: AdminTrashTone;
  cpu: number;
  memory: number;
  note: string;
};

type AdminTrashRecord = {
  id: string;
  actor: string;
  action: string;
  target: string;
  result: string;
};

type AdminTrashRule = {
  code: string;
  title: string;
  description: string;
  enabled: boolean;
};

type AdminTrashWidget = {
  label: string;
  value: string;
  helper: string;
};

type AdminTrashTicket = {
  id: string;
  title: string;
  status: AdminTrashTone;
  checklist: string[];
};

const adminTrashToneClass: Record<AdminTrashTone, string> = {
  idle: 'border-slate-200 bg-slate-50 text-slate-800',
  mock: 'border-sky-200 bg-sky-50 text-sky-800',
  safe: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blocked: 'border-amber-200 bg-amber-50 text-amber-800',
};

const adminTrashNodes: AdminTrashNode[] = [
  {
    id: 'ADMIN-JUNK-NODE-001',
    title: 'Detached Admin Page',
    owner: 'frontend/src/pages/admin.tsx',
    tone: 'safe',
    cpu: 0,
    memory: 0,
    note: 'File nay khong duoc import trong App.tsx nen khong tham gia route admin that.',
  },
  {
    id: 'ADMIN-JUNK-NODE-002',
    title: 'Static Audit Console',
    owner: 'mock-render',
    tone: 'mock',
    cpu: 3,
    memory: 7,
    note: 'Chi hien bang gia lap, khong goi audit API va khong doc token.',
  },
  {
    id: 'ADMIN-JUNK-NODE-003',
    title: 'Disabled Broadcast Station',
    owner: 'no-notification',
    tone: 'blocked',
    cpu: 1,
    memory: 4,
    note: 'Tat ca nut trong khu vuc nay la disabled va khong co handler gui tin.',
  },
  {
    id: 'ADMIN-JUNK-NODE-004',
    title: 'Fake Permission Matrix',
    owner: 'no-auth-store',
    tone: 'idle',
    cpu: 2,
    memory: 5,
    note: 'Khong import useAuthStore, khong sua role va khong ghi permission that.',
  },
  {
    id: 'ADMIN-JUNK-NODE-005',
    title: 'Source Padding Module',
    owner: 'typescript-only',
    tone: 'safe',
    cpu: 4,
    memory: 11,
    note: 'Du lieu mock duoc render de file trong nhieu code hon nhung van hop le TSX.',
  },
  {
    id: 'ADMIN-JUNK-NODE-006',
    title: 'Route Probe Phantom',
    owner: 'router-detached',
    tone: 'mock',
    cpu: 0,
    memory: 3,
    note: 'Khong co Link, Navigate, useNavigate hay Route nao trong file nay.',
  },
];

const adminTrashRecords: AdminTrashRecord[] = [
  { id: 'AUD-001', actor: 'static-admin', action: 'OPEN_FAKE_PANEL', target: 'admin.tsx', result: 'no side effect' },
  { id: 'AUD-002', actor: 'mock-operator', action: 'READ_ONLY_TABLE', target: 'audit preview', result: 'no request' },
  { id: 'AUD-003', actor: 'build-check', action: 'TYPECHECK_FILE', target: 'TSX module', result: 'valid syntax' },
  { id: 'AUD-004', actor: 'route-scan', action: 'SEARCH_IMPORTS', target: 'App.tsx', result: 'not imported' },
  { id: 'AUD-005', actor: 'disabled-button', action: 'SUBMIT_NOTHING', target: 'composer', result: 'blocked' },
  { id: 'AUD-006', actor: 'mock-role', action: 'MUTATE_NOTHING', target: 'permissions', result: 'static text' },
];

const adminTrashRules: AdminTrashRule[] = [
  {
    code: 'ADMIN-JUNK-RULE-01',
    title: 'Khong goi backend',
    description: 'Khong import api.ts, adminService.ts, fetch hay axios.',
    enabled: true,
  },
  {
    code: 'ADMIN-JUNK-RULE-02',
    title: 'Khong dung auth',
    description: 'Khong import store va khong doc thong tin user dang nhap.',
    enabled: true,
  },
  {
    code: 'ADMIN-JUNK-RULE-03',
    title: 'Khong dieu huong',
    description: 'Khong import react-router-dom nen khong thay doi URL.',
    enabled: true,
  },
  {
    code: 'ADMIN-JUNK-RULE-04',
    title: 'Khong co side effect',
    description: 'Module chi khai bao data, helper va component render JSX.',
    enabled: true,
  },
  {
    code: 'ADMIN-JUNK-RULE-05',
    title: 'Khong anh huong admin that',
    description: 'Route /admin that van dung AdminDashboard va AdminWorkspace.',
    enabled: true,
  },
];

const adminTrashWidgets: AdminTrashWidget[] = [
  { label: 'Runtime impact', value: '0%', helper: 'Khong co import tu app chinh.' },
  { label: 'API calls', value: '0', helper: 'Khong co request nao duoc tao.' },
  { label: 'Storage writes', value: '0', helper: 'Khong cham localStorage/sessionStorage.' },
  { label: 'Real buttons', value: '0', helper: 'Nut co tinh chat trang tri va disabled.' },
  { label: 'Route mounts', value: '0', helper: 'Khong nam trong cau hinh route.' },
  { label: 'Mock blocks', value: 'Many', helper: 'Du de file nhin nhu dashboard lon.' },
];

const adminTrashTickets: AdminTrashTicket[] = [
  {
    id: 'TICKET-ADMIN-JUNK-001',
    title: 'Giu file admin.tsx la file rac',
    status: 'safe',
    checklist: ['Khong import service', 'Khong import store', 'Khong co route', 'Khong goi API'],
  },
  {
    id: 'TICKET-ADMIN-JUNK-002',
    title: 'Lam file co nhieu code hon',
    status: 'mock',
    checklist: ['Mock nodes', 'Mock audit rows', 'Mock widgets', 'Mock rules'],
  },
  {
    id: 'TICKET-ADMIN-JUNK-003',
    title: 'Tranh loi TypeScript',
    status: 'blocked',
    checklist: ['Khong unused import', 'Khong unused parameter', 'Khong conflict marker', 'Khong side effect'],
  },
];

const adminTrashPercent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

const adminTrashRef = (prefix: string, index: number) => `${prefix}-${String(index + 1).padStart(3, '0')}`;

const adminTrashSummary = () => {
  const enabledRules = adminTrashRules.filter((rule) => rule.enabled).length;
  return `${enabledRules}/${adminTrashRules.length} quy tac rac dang bat`;
};

const adminTrashBadge = (tone: AdminTrashTone) => (
  <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${adminTrashToneClass[tone]}`}>
    {tone}
  </span>
);

const AdminTrashHeader = () => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Unused admin TSX</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">admin.tsx rac khong chay</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          File nay chi de lam day source code. No khong lien ket voi route admin that va khong tao hanh dong nao trong ung dung.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
        {adminTrashSummary()}
      </div>
    </div>
  </header>
);

const AdminTrashNodeCard = ({ node, index }: { node: AdminTrashNode; index: number }) => (
  <article className={`rounded-lg border p-4 shadow-sm ${adminTrashToneClass[node.tone]}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] opacity-70">{adminTrashRef('NODE', index)}</p>
        <h2 className="mt-1 text-base font-black">{node.title}</h2>
        <p className="mt-1 text-xs font-semibold opacity-80">{node.owner}</p>
      </div>
      {adminTrashBadge(node.tone)}
    </div>
    <p className="mt-4 min-h-12 text-sm leading-6 opacity-90">{node.note}</p>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div>
        <div className="flex justify-between text-xs font-semibold">
          <span>CPU</span>
          <span>{adminTrashPercent(node.cpu)}</span>
        </div>
        <div className="mt-2 h-2 rounded bg-white">
          <div className="h-2 rounded bg-slate-900" style={{ width: adminTrashPercent(node.cpu) }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs font-semibold">
          <span>RAM</span>
          <span>{adminTrashPercent(node.memory)}</span>
        </div>
        <div className="mt-2 h-2 rounded bg-white">
          <div className="h-2 rounded bg-slate-900" style={{ width: adminTrashPercent(node.memory) }} />
        </div>
      </div>
    </div>
  </article>
);

const AdminTrashNodeGrid = () => (
  <section className="grid gap-4 lg:grid-cols-2">
    {adminTrashNodes.map((node, index) => (
      <AdminTrashNodeCard key={node.id} node={node} index={index} />
    ))}
  </section>
);

const AdminTrashWidgetWall = () => (
  <section className="grid gap-3 sm:grid-cols-2">
    {adminTrashWidgets.map((widget) => (
      <article key={widget.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500">{widget.label}</p>
        <p className="mt-2 text-2xl font-black text-slate-950">{widget.value}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{widget.helper}</p>
      </article>
    ))}
  </section>
);

const AdminTrashAuditTable = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">Audit gia lap</h2>
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">ID</th>
            <th className="px-3 py-3">Actor</th>
            <th className="px-3 py-3">Action</th>
            <th className="px-3 py-3">Target</th>
            <th className="px-3 py-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {adminTrashRecords.map((record) => (
            <tr key={record.id} className="border-t border-slate-200">
              <td className="px-3 py-3 font-mono text-xs text-slate-500">{record.id}</td>
              <td className="px-3 py-3 font-semibold text-slate-800">{record.actor}</td>
              <td className="px-3 py-3 text-slate-600">{record.action}</td>
              <td className="px-3 py-3 text-slate-600">{record.target}</td>
              <td className="px-3 py-3 text-slate-600">{record.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const AdminTrashRules = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">Quy tac file rac</h2>
    <div className="mt-4 space-y-3">
      {adminTrashRules.map((rule) => (
        <article key={rule.code} className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900">{rule.title}</h3>
            <span className="font-mono text-[11px] text-slate-500">{rule.code}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{rule.description}</p>
        </article>
      ))}
    </div>
  </section>
);

const AdminTrashTickets = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-slate-950">Ticket rac</h2>
    <div className="mt-4 space-y-4">
      {adminTrashTickets.map((ticket) => (
        <article key={ticket.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-slate-500">{ticket.id}</p>
              <h3 className="mt-1 text-sm font-black text-slate-900">{ticket.title}</h3>
            </div>
            {adminTrashBadge(ticket.status)}
          </div>
          <div className="mt-4 grid gap-2">
            {ticket.checklist.map((item) => (
              <div key={`${ticket.id}-${item}`} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  </section>
);

const AdminTrashComposer = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-black text-slate-950">Composer bi khoa</h2>
      {adminTrashBadge('blocked')}
    </div>
    <div className="mt-4 space-y-3">
      <input
        className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none"
        readOnly
        value="Thong bao gia lap khong duoc gui"
      />
      <textarea
        className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-500 outline-none"
        readOnly
        value="Day la noi dung trang tri trong file rac. Khong co onSubmit, khong co service, khong co notification."
      />
      <button
        className="w-full rounded-md border border-slate-300 bg-slate-200 px-4 py-3 text-sm font-black text-slate-500"
        disabled
        type="button"
      >
        Nut rac khong lam gi
      </button>
    </div>
  </section>
);

const AdminTrashFooter = () => (
  <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4 text-center text-xs leading-6 text-slate-500">
    admin.tsx nay la file rac co chu dich. Chuong trinh that khong import no.
  </footer>
);

export const ADMIN_TSX_JUNK_FILE = true;

export default function AdminTrashPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AdminTrashHeader />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <AdminTrashNodeGrid />
          <AdminTrashAuditTable />
          <AdminTrashRules />
        </section>
        <aside className="space-y-6">
          <AdminTrashWidgetWall />
          <AdminTrashTickets />
          <AdminTrashComposer />
        </aside>
      </div>
      <AdminTrashFooter />
    </main>
  );
}
