type JunkTone = 'quiet' | 'notice' | 'success' | 'warning';

type JunkField = {
  id: string;
  label: string;
  placeholder: string;
  helper: string;
  tone: JunkTone;
};

type JunkChecklistItem = {
  code: string;
  title: string;
  detail: string;
  done: boolean;
};

type JunkMetric = {
  label: string;
  value: string;
  caption: string;
};

type JunkTimelineStep = {
  time: string;
  title: string;
  note: string;
};

type JunkPanel = {
  title: string;
  description: string;
  chips: string[];
};

type JunkSession = {
  id: string;
  label: string;
  device: string;
  location: string;
  state: JunkTone;
};

type JunkPolicy = {
  code: string;
  rule: string;
  explanation: string;
  active: boolean;
};

type JunkCredentialRow = {
  key: string;
  value: string;
  masked: boolean;
};

type JunkNotice = {
  title: string;
  body: string;
  tone: JunkTone;
};

type JunkRouteProbe = {
  path: string;
  component: string;
  result: string;
};

type JunkDebugPacket = {
  name: string;
  payload: Record<string, string | number | boolean>;
};

const junkFields: JunkField[] = [
  {
    id: 'ghost-email',
    label: 'Email demo',
    placeholder: 'khong-dung@student.iuh.edu.vn',
    helper: 'Input nay khong co onChange, khong submit, khong validate that.',
    tone: 'quiet',
  },
  {
    id: 'ghost-password',
    label: 'Mat khau demo',
    placeholder: '********',
    helper: 'Chi la placeholder de file co nhieu code hon.',
    tone: 'notice',
  },
  {
    id: 'ghost-otp',
    label: 'Ma xac thuc ao',
    placeholder: '000000',
    helper: 'Khong ket noi backend, khong ghi localStorage.',
    tone: 'success',
  },
  {
    id: 'ghost-note',
    label: 'Ghi chu rac',
    placeholder: 'Noi dung khong duoc su dung',
    helper: 'Ton tai de component trong day trong day hon.',
    tone: 'warning',
  },
];

const junkChecklist: JunkChecklistItem[] = [
  {
    code: 'JUNK-001',
    title: 'Khong import vao router',
    detail: 'Neu khong co import, file nay khong anh huong man hinh dang nhap that.',
    done: true,
  },
  {
    code: 'JUNK-002',
    title: 'Khong goi API',
    detail: 'Khong dung authService, fetch, axios hay bat ky request nao.',
    done: true,
  },
  {
    code: 'JUNK-003',
    title: 'Khong dung state quan trong',
    detail: 'Khong doc store, khong ghi token, khong dieu huong route.',
    done: true,
  },
  {
    code: 'JUNK-004',
    title: 'Van la TSX hop le',
    detail: 'Build co quet file thi TypeScript van co the doc duoc.',
    done: true,
  },
];

const junkMetrics: JunkMetric[] = [
  { label: 'Tac dong chuong trinh', value: '0%', caption: 'Khong co import nao tro den file nay.' },
  { label: 'Gia tri san pham', value: '0', caption: 'Chi la file trang tri cho source tree.' },
  { label: 'Do dai code', value: 'Nhieu', caption: 'Du de nhin nhu mot page that.' },
  { label: 'Side effect', value: 'None', caption: 'Khong co ham chay ngoai render.' },
];

const junkTimeline: JunkTimelineStep[] = [
  {
    time: '08:00',
    title: 'Mo file rac',
    note: 'Doc mot vai mang du lieu tinh va render ra giao dien gia.',
  },
  {
    time: '08:15',
    title: 'Nhan nut gia',
    note: 'Nut bi disable nen khong co hanh dong nao xay ra.',
  },
  {
    time: '08:30',
    title: 'Kiem tra form gia',
    note: 'Form khong co submit handler, khong gui thong tin di dau.',
  },
  {
    time: '08:45',
    title: 'Dong file',
    note: 'Ung dung that van chay bang Login.tsx nhu cu.',
  },
];

const junkPanels: JunkPanel[] = [
  {
    title: 'Vung dang nhap ao',
    description: 'Day la khu vuc mo phong giao dien dang nhap nhung khong co logic nghiep vu.',
    chips: ['static', 'unused', 'demo-only'],
  },
  {
    title: 'Vung bao cao ao',
    description: 'Cac so lieu duoc hard-code de lam day file va de doc code trong co ve that hon.',
    chips: ['mock', 'read-only', 'safe'],
  },
  {
    title: 'Vung canh bao ao',
    description: 'Noi dung canh bao chi la text, khong lien quan bao mat hay tai khoan nguoi dung.',
    chips: ['no-api', 'no-store', 'no-router'],
  },
];

const junkSessions: JunkSession[] = [
  {
    id: 'session-shadow-001',
    label: 'Laptop ao phong lab',
    device: 'Chrome 126 mock',
    location: 'IUH Campus A demo',
    state: 'quiet',
  },
  {
    id: 'session-shadow-002',
    label: 'Dien thoai ao',
    device: 'Safari mobile mock',
    location: 'Thu Duc placeholder',
    state: 'notice',
  },
  {
    id: 'session-shadow-003',
    label: 'May tram ao',
    device: 'Edge kiosk mock',
    location: 'Phong tu hoc demo',
    state: 'success',
  },
  {
    id: 'session-shadow-004',
    label: 'Thiet bi khong ton tai',
    device: 'Terminal preview mock',
    location: 'Nowhere',
    state: 'warning',
  },
];

const junkPolicies: JunkPolicy[] = [
  {
    code: 'POLICY-JUNK-LOGIN-01',
    rule: 'Khong xu ly dang nhap that',
    explanation: 'Khong co submit handler nao noi voi authService.',
    active: true,
  },
  {
    code: 'POLICY-JUNK-LOGIN-02',
    rule: 'Khong luu thong tin nguoi dung',
    explanation: 'Input readOnly va gia tri duoc tao tu chuoi tinh.',
    active: true,
  },
  {
    code: 'POLICY-JUNK-LOGIN-03',
    rule: 'Khong dieu huong',
    explanation: 'Khong import useNavigate, Link hay Navigate.',
    active: true,
  },
  {
    code: 'POLICY-JUNK-LOGIN-04',
    rule: 'Khong tham gia bundle route',
    explanation: 'App.tsx khong import file LoginPage.tsx.',
    active: true,
  },
  {
    code: 'POLICY-JUNK-LOGIN-05',
    rule: 'Khong goi side effect luc load module',
    explanation: 'Tat ca ham chi tra JSX hoac xu ly data tinh.',
    active: true,
  },
  {
    code: 'POLICY-JUNK-LOGIN-06',
    rule: 'Khong can data that',
    explanation: 'Moi ban ghi trong file deu la mock text de lam day code.',
    active: true,
  },
];

const junkCredentialRows: JunkCredentialRow[] = [
  { key: 'email', value: 'ghost@student.iuh.edu.vn', masked: false },
  { key: 'password', value: '***************', masked: true },
  { key: 'otp', value: '000000', masked: true },
  { key: 'rememberMe', value: 'false', masked: false },
  { key: 'role', value: 'NONE', masked: false },
  { key: 'token', value: 'not-created', masked: true },
];

const junkNotices: JunkNotice[] = [
  {
    title: 'Thong bao ao so 1',
    body: 'Noi dung nay chi render trong component rac va khong hien tren ung dung that.',
    tone: 'quiet',
  },
  {
    title: 'Thong bao ao so 2',
    body: 'Neu build quet file nay, day van la JSX hop le va khong co import du thua.',
    tone: 'notice',
  },
  {
    title: 'Thong bao ao so 3',
    body: 'Nut dang nhap trong file nay bi disable va khong co chuc nang.',
    tone: 'success',
  },
  {
    title: 'Thong bao ao so 4',
    body: 'Day la canh bao gia de file nhin day dan hon, khong phai canh bao bao mat.',
    tone: 'warning',
  },
];

const junkRouteProbes: JunkRouteProbe[] = [
  { path: '/login', component: 'Login.tsx', result: 'Route that cua chuong trinh' },
  { path: '/LoginPage', component: 'LoginPage.tsx', result: 'Khong ton tai route nay' },
  { path: '/auth/shadow', component: 'None', result: 'Duong dan gia lap' },
  { path: '/debug/login-page', component: 'None', result: 'Khong duoc khai bao trong App.tsx' },
];

const junkDebugPackets: JunkDebugPacket[] = [
  {
    name: 'moduleSafety',
    payload: {
      importedByApp: false,
      sideEffectCount: 0,
      apiCalls: 0,
      storageWrites: 0,
    },
  },
  {
    name: 'mockDensity',
    payload: {
      fields: junkFields.length,
      policies: junkPolicies.length,
      sessions: junkSessions.length,
      notices: junkNotices.length,
    },
  },
  {
    name: 'visualOnly',
    payload: {
      disabledButtons: 2,
      readonlyInputs: junkFields.length,
      realForms: 0,
      navigationLinks: 0,
    },
  },
];

const toneClassName: Record<JunkTone, string> = {
  quiet: 'border-slate-200 bg-white text-slate-700',
  notice: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

const buildJunkReference = (prefix: string, index: number) => {
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `${prefix}-${paddedIndex}`;
};

const summarizeJunk = (items: JunkChecklistItem[]) => {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return `${done}/${total} muc an toan da duoc danh dau`;
};

const joinJunkChips = (chips: string[]) => chips.map((chip) => `#${chip}`).join(' ');

const maskJunkValue = (row: JunkCredentialRow) => {
  if (!row.masked) return row.value;
  return row.value.replace(/./g, '*');
};

const stringifyJunkPayload = (payload: JunkDebugPacket['payload']) =>
  Object.entries(payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ');

const countActivePolicies = (policies: JunkPolicy[]) => policies.filter((policy) => policy.active).length;

const renderJunkBadge = (tone: JunkTone) => {
  const labels: Record<JunkTone, string> = {
    quiet: 'Tinh',
    notice: 'Demo',
    success: 'An toan',
    warning: 'Rac',
  };

  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${toneClassName[tone]}`}>
      {labels[tone]}
    </span>
  );
};

const JunkHeader = () => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unused TSX file</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">LoginPage rac khong chay</h1>
      </div>
      <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
        {summarizeJunk(junkChecklist)}
      </div>
    </div>
  </header>
);

const JunkFieldCard = ({ field, index }: { field: JunkField; index: number }) => (
  <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm" htmlFor={field.id}>
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-slate-800">{field.label}</span>
      {renderJunkBadge(field.tone)}
    </div>
    <input
      id={field.id}
      className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none"
      placeholder={field.placeholder}
      readOnly
      value={buildJunkReference('JUNK-FIELD', index)}
    />
    <p className="mt-2 text-xs leading-5 text-slate-500">{field.helper}</p>
  </label>
);

const JunkChecklist = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-slate-900">Checklist rac</h2>
      {renderJunkBadge('success')}
    </div>
    <div className="space-y-3">
      {junkChecklist.map((item) => (
        <article key={item.code} className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
            <span className="text-xs font-mono text-slate-500">{item.code}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
        </article>
      ))}
    </div>
  </section>
);

const JunkMetrics = () => (
  <section className="grid gap-3 sm:grid-cols-2">
    {junkMetrics.map((metric) => (
      <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">{metric.label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{metric.value}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{metric.caption}</p>
      </article>
    ))}
  </section>
);

const JunkSessionWall = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-slate-900">Session ao</h2>
      {renderJunkBadge('notice')}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {junkSessions.map((session) => (
        <article key={session.id} className={`rounded-md border p-3 ${toneClassName[session.state]}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{session.label}</h3>
            <span className="font-mono text-[11px]">{session.id}</span>
          </div>
          <p className="mt-2 text-xs leading-5">{session.device}</p>
          <p className="text-xs leading-5">{session.location}</p>
        </article>
      ))}
    </div>
  </section>
);

const JunkPolicyBoard = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">Policy rac</h2>
      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
        {countActivePolicies(junkPolicies)}/{junkPolicies.length} active
      </span>
    </div>
    <div className="space-y-3">
      {junkPolicies.map((policy) => (
        <article key={policy.code} className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] text-slate-500">{policy.code}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{policy.rule}</h3>
            </div>
            <span className="rounded bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
              {policy.active ? 'mock-on' : 'mock-off'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{policy.explanation}</p>
        </article>
      ))}
    </div>
  </section>
);

const JunkCredentialTable = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900">Credential gia lap</h2>
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Masked</th>
          </tr>
        </thead>
        <tbody>
          {junkCredentialRows.map((row) => (
            <tr key={row.key} className="border-t border-slate-200">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.key}</td>
              <td className="px-3 py-2 text-slate-700">{maskJunkValue(row)}</td>
              <td className="px-3 py-2 text-slate-500">{row.masked ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const JunkNoticeStack = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900">Thong bao ao</h2>
    <div className="mt-4 space-y-3">
      {junkNotices.map((notice) => (
        <article key={notice.title} className={`rounded-md border p-3 ${toneClassName[notice.tone]}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{notice.title}</h3>
            {renderJunkBadge(notice.tone)}
          </div>
          <p className="mt-2 text-xs leading-5">{notice.body}</p>
        </article>
      ))}
    </div>
  </section>
);

const JunkRouteProbeTable = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900">Route probe gia</h2>
    <div className="mt-4 space-y-2">
      {junkRouteProbes.map((probe) => (
        <article key={probe.path} className="grid grid-cols-[120px_1fr] gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
          <span className="font-mono text-slate-500">{probe.path}</span>
          <div>
            <p className="font-semibold text-slate-800">{probe.component}</p>
            <p className="mt-1 text-slate-500">{probe.result}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);

const JunkDebugPackets = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900">Debug packet tinh</h2>
    <div className="mt-4 space-y-3">
      {junkDebugPackets.map((packet) => (
        <article key={packet.name} className="rounded-md border border-slate-200 bg-slate-950 p-3 text-slate-100">
          <h3 className="font-mono text-xs text-emerald-300">{packet.name}</h3>
          <p className="mt-2 font-mono text-[11px] leading-5 text-slate-300">{stringifyJunkPayload(packet.payload)}</p>
        </article>
      ))}
    </div>
  </section>
);

const JunkTimeline = () => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900">Dong thoi gian ao</h2>
    <div className="mt-4 space-y-4">
      {junkTimeline.map((step) => (
        <article key={`${step.time}-${step.title}`} className="grid grid-cols-[64px_1fr] gap-3">
          <time className="text-xs font-semibold text-slate-500">{step.time}</time>
          <div className="border-l border-slate-200 pl-4">
            <h3 className="text-sm font-semibold text-slate-800">{step.title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{step.note}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);

const JunkPanels = () => (
  <section className="grid gap-4 lg:grid-cols-3">
    {junkPanels.map((panel) => (
      <article key={panel.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{panel.title}</h2>
        <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">{panel.description}</p>
        <p className="mt-4 text-xs font-mono text-slate-500">{joinJunkChips(panel.chips)}</p>
      </article>
    ))}
  </section>
);

const JunkFooter = () => (
  <footer className="mx-auto max-w-5xl px-6 pb-10 pt-4 text-center text-xs text-slate-500">
    File nay co nhieu code de lam rac co chu dich, nhung khong duoc lien ket voi chuong trinh chinh.
  </footer>
);

export const LOGIN_PAGE_JUNK_FILE = true;

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <JunkHeader />
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {junkFields.map((field, index) => (
              <JunkFieldCard key={field.id} field={field} index={index} />
            ))}
          </div>
          <JunkPanels />
          <JunkSessionWall />
          <JunkTimeline />
          <JunkPolicyBoard />
        </section>
        <aside className="space-y-6">
          <JunkMetrics />
          <JunkChecklist />
          <JunkCredentialTable />
          <JunkNoticeStack />
          <JunkRouteProbeTable />
          <JunkDebugPackets />
          <button
            className="w-full rounded-md border border-slate-300 bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500"
            disabled
            type="button"
          >
            Nut rac bi vo hieu hoa
          </button>
        </aside>
      </div>
      <JunkFooter />
    </main>
  );
}
