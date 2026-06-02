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
          <JunkTimeline />
        </section>
        <aside className="space-y-6">
          <JunkMetrics />
          <JunkChecklist />
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
