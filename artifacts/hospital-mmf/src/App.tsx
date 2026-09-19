import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Columns3,
  Database,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  Hash,
  LayoutDashboard,
  ListFilter,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  getGetImportQueryKey,
  getGetOverviewQueryKey,
  getListImportsQueryKey,
  useCommitImport,
  useCreateImport,
  useGetImport,
  useGetOverview,
  useListDepartments,
  useListImports,
} from '@workspace/api-client-react';
import type { Department, DepartmentInput, ImportSummary, LegacyRowInput, PreviewRow, QualityIssue } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Link, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Command centre', icon: LayoutDashboard, exact: true },
  { href: '/imports', label: 'Import review', icon: FileSpreadsheet },
  { href: '/departments', label: 'Departments', icon: Columns3 },
  { href: '/review-queue', label: 'Review queue', icon: ListFilter },
];

function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en-GB').format(value ?? 0);
}

function initials(label: string) {
  return label.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info';
}) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
    success: 'border-[#b9ded2] bg-[#eef8f4] text-[#1e6856]',
    warning: 'border-[#e9d3a6] bg-[#fff8e8] text-[#85601f]',
    critical: 'border-[#e7b8b0] bg-[#fff1ee] text-[#9c3e31]',
    info: 'border-[#bdcfdf] bg-[#eef4f9] text-[#315d7f]',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'navy',
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone?: 'navy' | 'mint' | 'amber' | 'rose';
  href?: string;
}) {
  const colors = {
    navy: 'bg-[#eef4f9] text-[#315d7f]',
    mint: 'bg-[#edf8f3] text-[#28725e]',
    amber: 'bg-[#fff7e8] text-[#8b641f]',
    rose: 'bg-[#fff1ee] text-[#a34b3d]',
  };
  const body = (
    <div className="group panel-shadow rounded-xl border border-slate-200/90 bg-white p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
        <span className={`grid size-8 place-items-center rounded-lg ${colors[tone]}`}><Icon size={16} strokeWidth={1.8} /></span>
      </div>
      <div className="font-mono text-[28px] font-bold tracking-[-0.06em] text-[#1e3447]" data-testid={`metric-value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
      {href && <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#315d7f]">Open view <ArrowRight size={13} /></span>}
    </div>
  );
  return href ? <Link href={href} className="block" data-testid={`link-metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{body}</Link> : body;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItems.find((item) => item.exact ? location === item.href : location.startsWith(item.href));

  return (
    <div className="min-h-[100dvh] bg-[#f2f6f7] text-[#1e3447]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-[#2b4051] bg-[#152c3b] text-[#dce9ed] transition-transform duration-200 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[84px] items-center justify-between border-b border-[#2b4051] px-6">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid size-9 place-items-center rounded-[10px] bg-[#9ed8c7] text-[#152c3b]"><ShieldCheck size={20} strokeWidth={2.2} /></span>
            <span>
              <span className="block text-sm font-bold tracking-[-0.02em] text-white">MMF Command</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[#93acb6]">Hospital operations</span>
            </span>
          </Link>
          <button className="grid size-8 place-items-center rounded-md text-[#9db4bd] hover:bg-[#203d4d] md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={17} /></button>
        </div>
        <div className="px-4 py-6">
          <div className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#78929c]">Workspace</div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? location === href : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[#27495a] font-semibold text-white' : 'text-[#afc3ca] hover:bg-[#203d4d] hover:text-white'}`}
                  data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                >
                  <Icon size={17} strokeWidth={active ? 2.1 : 1.7} />
                  <span>{label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-[#9ed8c7]" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-[#2b4051] p-4">
          <div className="rounded-xl bg-[#1d3a4b] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#cfe0e5]"><span className="size-1.5 rounded-full bg-[#9ed8c7]" /> Live workspace</div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#8ca8b3]">Changes are logged and baselines are immutable after commit.</p>
          </div>
          <div className="mt-4 flex items-center gap-3 px-2">
            <span className="grid size-8 place-items-center rounded-full bg-[#d4b38a] text-xs font-bold text-[#3e2f20]">RC</span>
            <div className="min-w-0"><div className="truncate text-xs font-semibold text-[#dce9ed]">Rina Clarke</div><div className="truncate text-[10px] text-[#78929c]">Cycle administrator</div></div>
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-[#0c202b]/50 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" data-testid="button-navigation-overlay" />}
      <div className="md:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[84px] items-center justify-between border-b border-slate-200 bg-[#f2f6f7]/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={18} /></button>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">MMF cycle / 2025</div>
              <h1 className="mt-0.5 text-lg font-bold tracking-[-0.03em] text-[#1e3447]">{current?.label ?? 'Workspace'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-[#b9ded2] bg-[#eef8f4] px-3 py-1.5 text-[11px] font-semibold text-[#286b59] sm:flex"><span className="size-1.5 rounded-full bg-[#3b9a7d]" /> All systems normal</div>
            <button className="relative grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="View notifications" data-testid="button-notifications"><Bell size={17} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#d06956]" /></button>
            <button className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 sm:flex" data-testid="button-profile"><span className="grid size-6 place-items-center rounded-full bg-[#d4b38a] text-[10px] text-[#3e2f20]">RC</span> Rina Clarke</button>
          </div>
        </header>
        <main className="mmf-grid min-h-[calc(100dvh-84px)] px-5 py-7 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#5e8194]"><span className="size-1.5 rounded-full bg-[#5eaf93]" /> {eyebrow}</div>
        <h2 className="text-balance text-[30px] font-bold leading-[1.05] tracking-[-0.055em] text-[#1e3447] md:text-[38px]">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SectionCard({ title, eyebrow, action, children, className = '' }: { title: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel-shadow rounded-xl border border-slate-200/90 bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div><h3 className="text-sm font-bold tracking-[-0.02em] text-[#1e3447]">{title}</h3>{eyebrow && <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">{eyebrow}</div>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueryState({ error, onRetry, label = 'data' }: { error?: unknown; onRetry: () => void; label?: string }) {
  if (error) return <div className="panel-shadow rounded-xl border border-[#e7b8b0] bg-[#fff8f6] p-8 text-center"><CircleAlert className="mx-auto text-[#a34b3d]" size={25} /><h3 className="mt-3 text-sm font-bold text-[#7f352b]">Could not load {label}</h3><p className="mx-auto mt-1 max-w-sm text-xs text-[#9c6157]">The workspace is still available. Try the request again or return in a moment.</p><button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#a34b3d] px-3 py-2 text-xs font-bold text-white hover:bg-[#8f3c31]" data-testid={`button-retry-${label}`}><RefreshCw size={14} /> Retry</button></div>;
  return null;
}

function LoadingGrid({ count = 4 }: { count?: number }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: count }).map((_, index) => <div key={index} className="h-[148px] rounded-xl border border-slate-200 bg-white p-4"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton mt-7 h-9 w-20 rounded" /><div className="skeleton mt-3 h-3 w-32 rounded" /></div>)}</div>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center"><span className="grid size-11 place-items-center rounded-xl bg-[#edf3f5] text-[#5e8194]"><Archive size={20} /></span><h3 className="mt-4 text-sm font-bold text-[#1e3447]">{title}</h3><p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function OverviewPage() {
  const overviewQuery = useGetOverview();
  const importsQuery = useListImports();
  if (overviewQuery.isLoading) return <div className="mx-auto max-w-[1440px] rise-in"><PageHeading eyebrow="Operational overview" title="Command centre" description="A clear view of the active Monthly Maintenance Figure cycle." /><LoadingGrid /><div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><div className="skeleton h-80 rounded-xl" /><div className="skeleton h-80 rounded-xl" /></div></div>;
  if (overviewQuery.isError || !overviewQuery.data) return <div className="mx-auto max-w-[1440px] rise-in"><PageHeading eyebrow="Operational overview" title="Command centre" description="A clear view of the active Monthly Maintenance Figure cycle." /><QueryState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} label="overview" /></div>;
  const data = overviewQuery.data;
  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Operational overview" title="Command centre" description="A clear view of the active Monthly Maintenance Figure cycle." action={<Link href="/imports" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#244c65] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5" data-testid="link-start-import"><UploadCloud size={15} /> Review an import</Link>} />
    <section className="mb-6 overflow-hidden rounded-xl border border-[#2b5268] bg-[#1a3d51] text-white panel-shadow">
      <div className="flex flex-col justify-between gap-6 px-5 py-5 md:flex-row md:items-center md:px-7">
        <div className="flex items-start gap-4"><span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg bg-[#9ed8c7] text-[#17384a]"><CalendarClock size={20} /></span><div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9cc3c6]">Active cycle</div><div className="mt-1 text-xl font-bold tracking-[-0.04em]">{data.cycle.name}</div><div className="mt-1 text-xs text-[#b5cbd0]">Deadline {formatDate(data.cycle.deadline)} · {data.cycle.status}</div></div></div>
        <div className="flex items-center gap-6 md:pr-3"><div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9cc3c6]">Time remaining</div><div className="mt-1 font-mono text-3xl font-bold tracking-[-0.07em] text-[#d7f0e8]">{data.cycle.daysRemaining}<span className="ml-2 font-sans text-sm font-medium tracking-normal text-[#b5cbd0]">days</span></div></div><div className="hidden h-10 w-px bg-[#416579] sm:block" /><Badge tone="success"><CheckCircle2 size={12} /> {data.baseline.currentImportStatus}</Badge></div>
      </div>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Baseline rows" value={formatNumber(data.baseline.rowCount)} detail={`${formatNumber(data.baseline.departmentCount)} departments detected`} icon={Database} tone="navy" />
      <MetricCard label="Unique identifiers" value={formatNumber(data.baseline.uniqueIdentifiers)} detail="Identifiers in active baseline" icon={Hash} tone="mint" />
      <MetricCard label="Needs attention" value={formatNumber(data.quality.unresolved)} detail={`${formatNumber(data.quality.conflicts)} conflicts · ${formatNumber(data.quality.warnings)} warnings`} icon={AlertTriangle} tone="rose" href="/review-queue" />
      <MetricCard label="Department readiness" value={`${data.departments.ready}/${data.departments.total}`} detail={`${formatNumber(data.departments.needsReview)} departments need review`} icon={ClipboardCheck} tone="amber" href="/departments" />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.18fr_.82fr]">
      <SectionCard title="Department readiness" eyebrow="Baseline coverage" action={<Link href="/departments" className="text-xs font-bold text-[#315d7f] hover:text-[#244c65]" data-testid="link-view-departments">View departments <ChevronRight className="inline" size={13} /></Link>}>
        <div className="space-y-5 p-5">
          <div className="flex items-end justify-between"><div><div className="font-mono text-4xl font-bold tracking-[-0.08em] text-[#1e3447]">{Math.round((data.departments.ready / Math.max(data.departments.total, 1)) * 100)}<span className="text-xl text-slate-400">%</span></div><div className="mt-1 text-xs text-slate-500">of departments ready for review</div></div><Badge tone={data.departments.needsReview ? 'warning' : 'success'}>{data.departments.needsReview ? 'Review in progress' : 'On track'}</Badge></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#edf1f2]"><div className="h-full rounded-full bg-[#5eaf93]" style={{ width: `${Math.round((data.departments.ready / Math.max(data.departments.total, 1)) * 100)}%` }} /></div>
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4"><div><div className="font-mono text-lg font-bold text-[#28725e]">{data.departments.ready}</div><div className="text-[11px] text-slate-500">Ready</div></div><div><div className="font-mono text-lg font-bold text-[#8b641f]">{data.departments.inProgress}</div><div className="text-[11px] text-slate-500">In progress</div></div><div><div className="font-mono text-lg font-bold text-[#a34b3d]">{data.departments.needsReview}</div><div className="text-[11px] text-slate-500">Needs review</div></div></div>
        </div>
      </SectionCard>
      <SectionCard title="Quality signal" eyebrow="Current baseline" action={<Link href="/review-queue" className="text-xs font-bold text-[#315d7f] hover:text-[#244c65]" data-testid="link-view-quality">Open queue <ChevronRight className="inline" size={13} /></Link>}>
        <div className="divide-y divide-slate-100">
          {[{ label: 'Unresolved conflicts', value: data.quality.conflicts, tone: 'critical', icon: CircleAlert }, { label: 'Missing identifiers', value: data.quality.unresolved, tone: 'warning', icon: Hash }, { label: 'Warnings to monitor', value: data.quality.warnings, tone: 'neutral', icon: Activity }].map(({ label, value, tone, icon: Icon }) => <div className="flex items-center justify-between px-5 py-4" key={label}><div className="flex items-center gap-3"><span className={`grid size-8 place-items-center rounded-lg ${tone === 'critical' ? 'bg-[#fff1ee] text-[#a34b3d]' : tone === 'warning' ? 'bg-[#fff7e8] text-[#8b641f]' : 'bg-[#eef4f9] text-[#315d7f]'}`}><Icon size={15} /></span><span className="text-xs font-semibold text-slate-600">{label}</span></div><span className="font-mono text-lg font-bold text-[#1e3447]">{formatNumber(value)}</span></div>)}
        </div>
      </SectionCard>
    </div>
    <SectionCard title="Recent activity" eyebrow="Audit trail" className="mt-6" action={<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Latest events</span>}>
      {importsQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /></div> : data.recentActivity.length === 0 ? <EmptyState title="No activity recorded" detail="Actions taken during this cycle will appear here." /> : <div className="divide-y divide-slate-100">{data.recentActivity.slice(0, 5).map((item) => <div key={item.id} className="flex items-start gap-3 px-5 py-4" data-testid={`activity-${item.id}`}><span className={`mt-1 size-2 rounded-full ${item.tone === 'critical' ? 'bg-[#d06956]' : item.tone === 'warning' ? 'bg-[#d4a247]' : item.tone === 'success' ? 'bg-[#5eaf93]' : 'bg-[#7c9caf]'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2 text-xs"><span className="font-bold text-[#1e3447]">{item.action}</span><span className="text-slate-500">{item.detail}</span></div><div className="mt-1 text-[11px] text-slate-400">{formatDate(item.timestamp, true)}</div></div></div>)}</div>}
    </SectionCard>
  </div>;
}

function ImportStatusBadge({ status }: { status: string }) {
  return <Badge tone={status === 'committed' ? 'success' : 'warning'}>{status === 'committed' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />} {status === 'committed' ? 'Committed' : 'In review'}</Badge>;
}

type ImportDraft = {
  sourceFileName: string;
  sourceFileHash: string;
  fileSize: number;
  worksheetName: string;
  rowCount: number;
  columnCount: number;
  departmentCount: number;
  uniqueIdentifierCount: number;
  missingIdentifierCount: number;
  conflictGroupCount: number;
  warnings: number;
  errors: number;
  previewRows: PreviewRow[];
  legacyRows: LegacyRowInput[];
  departments: DepartmentInput[];
  issues: QualityIssue[];
};

const expectedBaseHeaders = [
  'System ID',
  'PVMS/NIV No.',
  'Nomecluature',
  'A/U',
  'Previous MMF(PVMS)',
  'Current MMF(PVMS)',
  'Previous MMF(DGLP)',
  'Current MMF(DGLP)',
  'Previous MMF(ECHS)',
  'Current MMF(ECHS)',
  'LPR',
];

function cellText(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numericCell(value: unknown) {
  const text = cellText(value).replaceAll(',', '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function inspectWorkbook(file: File): Promise<ImportDraft> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });
  const worksheetName = workbook.SheetNames[0] ?? 'Worksheet';
  const sheet = workbook.Sheets[worksheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
  const headerGroups = matrix[0] ?? [];
  const headers = matrix[1] ?? [];
  const sourceRows = matrix.slice(2).filter((row) => row.some((cell) => cellText(cell) !== ''));
  const columnCount = Math.max(headerGroups.length, headers.length);
  const departmentCount = headerGroups.filter((cell) => cellText(cell) !== '').length;
  const departmentDefinitions = Array.from({ length: Math.max(0, Math.floor((columnCount - 11) / 3)) }, (_, index) => ({
    name: cellText(headerGroups[11 + index * 3]) || `Department ${index + 1}`,
    sourceColumnStart: 12 + index * 3,
    index,
  }));
  const identifierGroups = new Map<string, { row: number; name: string }[]>();
  const missingRows: number[] = [];
  const malformedRows: number[] = [];

  const previewRows: PreviewRow[] = sourceRows.map((row, index) => {
    const sourceRow = index + 3;
    const identifier = cellText(row[1]) || null;
    const nomenclature = cellText(row[2]) || null;
    if (!identifier) missingRows.push(sourceRow);
    if ((cellText(row[7]) && numericCell(row[7]) === null) || (cellText(row[9]) && numericCell(row[9]) === null)) malformedRows.push(sourceRow);
    if (identifier) {
      const group = identifierGroups.get(identifier) ?? [];
      group.push({ row: sourceRow, name: nomenclature ?? '' });
      identifierGroups.set(identifier, group);
    }
    return {
      sourceRow,
      systemId: cellText(row[0]) || null,
      identifier,
      nomenclature,
      unit: cellText(row[3]) || null,
      currentDglp: numericCell(row[7]),
      currentEchs: numericCell(row[9]),
    };
  });
  const legacyRows: LegacyRowInput[] = sourceRows.map((row, index) => {
    const sourceRow = index + 3;
    const identifier = cellText(row[1]) || null;
    const pvms = identifier && /^pvms(?:[/:\s]|$)/i.test(identifier) ? identifier : null;
    const niv = identifier && /^niv(?:[/:\s]|$)/i.test(identifier) ? identifier : null;
    return {
      sourceRow,
      systemId: cellText(row[0]) || null,
      identifier,
      nomenclature: cellText(row[2]) || null,
      specification: null,
      unit: cellText(row[3]) || null,
      pvms,
      niv,
      previousPvmsMmf: numericCell(row[4]),
      currentPvmsMmf: numericCell(row[5]),
      previousDglpMmf: numericCell(row[6]),
      currentDglpMmf: numericCell(row[7]),
      previousEchsMmf: numericCell(row[8]),
      currentEchsMmf: numericCell(row[9]),
      lpr: cellText(row[10]) || null,
      sourceValues: row.map((cell) => cell ?? null),
      departments: departmentDefinitions
        .map((department) => ({
          departmentIndex: department.index,
          pvms: cellText(row[11 + department.index * 3]) || null,
          dglp: numericCell(row[12 + department.index * 3]),
          echs: numericCell(row[13 + department.index * 3]),
        }))
        .filter((department) => department.pvms !== null || department.dglp !== null || department.echs !== null),
    };
  });

  const conflictGroups = Array.from(identifierGroups.entries()).filter(([, group]) => new Set(group.map((entry) => entry.name)).size > 1);
  const issues: QualityIssue[] = conflictGroups.map(([identifier, group]) => ({
    code: 'IDENTIFIER_CONFLICT',
    severity: 'review',
    title: `${identifier} maps to different descriptions`,
    detail: 'Matching identifiers are not proof of clinical equivalence. Keep the records separate until a human reviewer decides.',
    rowNumbers: group.map((entry) => entry.row),
  }));
  if (missingRows.length) {
    issues.push({
      code: 'MISSING_IDENTIFIER',
      severity: 'warning',
      title: `${missingRows.length} record${missingRows.length === 1 ? '' : 's'} have no PVMS/NIV identifier`,
      detail: 'Blank identifiers are review warnings, not automatic import errors.',
      rowNumbers: missingRows.slice(0, 25),
    });
  }
  if (malformedRows.length) {
    issues.push({
      code: 'MALFORMED_MMF',
      severity: 'error',
      title: `${malformedRows.length} MMF value${malformedRows.length === 1 ? '' : 's'} could not be read`,
      detail: 'Current DGLP and ECHS MMF values must be numeric before the baseline can be committed.',
      rowNumbers: malformedRows.slice(0, 25),
    });
  }
  const unexpectedHeaders = expectedBaseHeaders.filter((header, index) => cellText(headers[index]) !== header);
  if (unexpectedHeaders.length) {
    issues.unshift({
      code: 'HEADER_MISMATCH',
      severity: 'error',
      title: 'Required legacy headers do not match',
      detail: `Expected the supplied legacy column order. Mismatches include ${unexpectedHeaders.slice(0, 3).join(', ')}.`,
      rowNumbers: [2],
    });
  }
  const previewSourceRows = [
    ...previewRows.slice(0, 2),
    ...conflictGroups.flatMap(([, group]) => group.map((entry) => previewRows[entry.row - 3])).filter(Boolean),
    ...missingRows.map((row) => previewRows[row - 3]).filter(Boolean),
  ];
  const uniquePreviewRows = Array.from(new Map(previewSourceRows.map((row) => [row.sourceRow, row])).values()).slice(0, 12);
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    sourceFileName: file.name,
    sourceFileHash: await sha256(file),
    fileSize: file.size,
    worksheetName,
    rowCount: sourceRows.length,
    columnCount,
    departmentCount,
    uniqueIdentifierCount: identifierGroups.size,
    missingIdentifierCount: missingRows.length,
    conflictGroupCount: conflictGroups.length,
    warnings,
    errors,
    previewRows: uniquePreviewRows,
    legacyRows,
    departments: departmentDefinitions.map(({ name, sourceColumnStart }) => ({ name, sourceColumnStart })),
    issues,
  };
}

function ImportsPage() {
  const [, setLocation] = useLocation();
  const importsQuery = useListImports();
  const createImport = useCreateImport();
  const queryClientInstance = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (file?: File) => {
    if (!file) return;
    const isWorkbook = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isWorkbook) { setFileError('Select an Excel workbook or CSV file.'); setSelectedFile(null); return; }
    setFileError('');
    setSaved(false);
    setSelectedFile(file);
    setDraft(null);
    setIsInspecting(true);
    void inspectWorkbook(file).then(setDraft).catch(() => setFileError('The workbook could not be read. Check that it is a valid Excel file.')).finally(() => setIsInspecting(false));
  };
  const saveReview = () => {
    if (!selectedFile || !draft) return;
    createImport.mutate({ data: draft }, {
      onSuccess: (created) => {
        setSaved(true);
        void queryClientInstance.invalidateQueries({ queryKey: getListImportsQueryKey() });
        void queryClientInstance.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        if (created.id) setLocation(`/imports/${created.id}`);
      },
    });
  };
  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Governed intake" title="Import review" description="Bring a legacy workbook into a reviewable state before it becomes the cycle baseline." action={<button onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#244c65] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5" data-testid="button-select-workbook"><UploadCloud size={15} /> Select workbook</button>} />
    <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(event) => handleFile(event.target.files?.[0])} data-testid="input-workbook" />
    {fileError && <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#e7b8b0] bg-[#fff1ee] px-4 py-3 text-xs font-semibold text-[#9c3e31]" data-testid="status-file-error"><CircleAlert size={15} /> {fileError}</div>}
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <SectionCard title="Guided review" eyebrow="Step 01 / select and inspect">
        <div className="p-5">
          <div className={`rounded-xl border-2 border-dashed p-7 text-center transition-colors ${selectedFile ? 'border-[#8dc8b4] bg-[#f2fbf7]' : 'border-[#c9d8dd] bg-[#f8fbfb]'}`} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} data-testid="dropzone-workbook">
            {selectedFile ? <><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#dff2ea] text-[#28725e]"><FileSpreadsheet size={24} /></span><div className="mt-4 text-sm font-bold text-[#1e3447]">{selectedFile.name}</div><div className="mt-1 text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {isInspecting ? 'inspecting workbook…' : draft ? `${formatNumber(draft.rowCount)} rows parsed` : 'awaiting inspection'}</div><button className="mt-4 text-xs font-bold text-[#315d7f] underline underline-offset-4" onClick={(event) => { event.stopPropagation(); setSelectedFile(null); setDraft(null); setSaved(false); }} data-testid="button-remove-workbook">Choose another file</button></> : <><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf3f5] text-[#5e8194]"><FolderOpen size={23} /></span><div className="mt-4 text-sm font-bold text-[#1e3447]">Choose a legacy workbook</div><div className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">XLSX, XLS, or CSV files are inspected against the hospital’s legacy column contract before they can be saved.</div><button className="mt-5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#315d7f]" data-testid="button-browse-workbook">Browse files</button></>}
          </div>
          <div className="mt-5 space-y-3">
             {[['1', 'Select workbook', !!selectedFile], ['2', 'Validate structure', !!draft && !isInspecting], ['3', 'Save review', saved]].map(([step, label, complete]) => <div key={String(step)} className="flex items-center gap-3 text-xs"><span className={`grid size-6 place-items-center rounded-full font-mono text-[10px] font-bold ${complete ? 'bg-[#dff2ea] text-[#28725e]' : 'bg-[#edf3f5] text-slate-500'}`}>{complete ? <Check size={13} /> : step}</span><span className={complete ? 'font-semibold text-[#28725e]' : 'text-slate-500'}>{label}</span>{complete && <span className="ml-auto text-[10px] font-semibold text-[#28725e]">Complete</span>}</div>)}
          </div>
           {draft && <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-[#f8fbfb] p-3 text-center"><div><div className="font-mono text-sm font-bold text-[#1e3447]">{formatNumber(draft.rowCount)}</div><div className="text-[10px] text-slate-400">Rows</div></div><div><div className="font-mono text-sm font-bold text-[#a34b3d]">{formatNumber(draft.conflictGroupCount)}</div><div className="text-[10px] text-slate-400">Conflicts</div></div><div><div className="font-mono text-sm font-bold text-[#8b641f]">{formatNumber(draft.missingIdentifierCount)}</div><div className="text-[10px] text-slate-400">Missing IDs</div></div></div>}
           {selectedFile && <button disabled={createImport.isPending || saved || isInspecting || !draft} onClick={saveReview} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#244c65] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-save-review">{createImport.isPending ? <><RefreshCw className="animate-spin" size={14} /> Saving review…</> : isInspecting ? <><RefreshCw className="animate-spin" size={14} /> Inspecting workbook…</> : saved ? <><Check size={14} /> Review saved</> : <><ClipboardCheck size={14} /> Save review</>}</button>}
          {createImport.isError && <p className="mt-3 text-xs font-semibold text-[#a34b3d]" data-testid="status-create-error">The review could not be saved. Check the workbook details and retry.</p>}
        </div>
      </SectionCard>
      <SectionCard title="Import history" eyebrow="Saved reviews and immutable baselines" action={<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{importsQuery.data?.length ?? 0} records</span>}>
        {importsQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-12 rounded" /><div className="skeleton h-12 rounded" /><div className="skeleton h-12 rounded" /></div> : importsQuery.isError ? <div className="p-5"><QueryState error={importsQuery.error} onRetry={() => void importsQuery.refetch()} label="import history" /></div> : !importsQuery.data?.length ? <EmptyState title="No workbook reviews yet" detail="Select a legacy workbook to create the first governed review." /> : <div className="divide-y divide-slate-100">{importsQuery.data.map((item) => <ImportRow item={item} key={item.id} />)}</div>}
      </SectionCard>
    </div>
    <div className="mt-6 rounded-xl border border-[#cfdae0] bg-[#eef4f6] px-5 py-4 text-xs text-[#506a78]"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#4d8191]" size={16} /><p><strong className="text-[#315d7f]">Governance note.</strong> A committed baseline cannot be edited in place. Resolve critical findings before committing, then keep the import record as the source of truth for this cycle.</p></div></div>
  </div>;
}

function ImportRow({ item }: { item: ImportSummary }) {
  return <Link href={`/imports/${item.id}`} className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#f8fbfb] sm:flex-row sm:items-center sm:justify-between" data-testid={`link-import-${item.id}`}><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf3f5] text-[#5e8194]"><FileText size={16} /></span><div className="min-w-0"><div className="truncate text-xs font-bold text-[#1e3447] group-hover:text-[#315d7f]">{item.sourceFileName}</div><div className="mt-1 text-[11px] text-slate-500">{item.worksheetName} · {formatNumber(item.rowCount)} rows · created {formatDate(item.createdAt)}</div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="hidden text-right sm:block"><div className="font-mono text-[11px] font-bold text-[#1e3447]">{item.quality.errors + item.quality.conflicts}</div><div className="text-[10px] text-slate-400">findings</div></div><ImportStatusBadge status={item.status} /><ChevronRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5" /></div></Link>;
}

function ImportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const detailQuery = useGetImport(id, { query: { queryKey: getGetImportQueryKey(id), enabled: Boolean(id) } });
  const commitImport = useCommitImport();
  const queryClientInstance = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);
  if (detailQuery.isLoading) return <div className="mx-auto max-w-[1440px] rise-in"><div className="skeleton mb-5 h-4 w-28 rounded" /><div className="skeleton h-10 w-80 rounded" /><div className="mt-7 grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className="skeleton h-28 rounded-xl" key={index} />)}</div><div className="skeleton mt-6 h-96 rounded-xl" /></div>;
  if (detailQuery.isError || !detailQuery.data) return <div className="mx-auto max-w-[1440px] rise-in"><Link href="/imports" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#315d7f]" data-testid="link-back-imports"><ArrowLeft size={14} /> Import review</Link><QueryState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} label="import detail" /></div>;
  const item = detailQuery.data;
  const commit = () => commitImport.mutate({ importId: item.id, data: { acknowledged } }, { onSuccess: () => { void queryClientInstance.invalidateQueries({ queryKey: getGetImportQueryKey(item.id) }); void queryClientInstance.invalidateQueries({ queryKey: getListImportsQueryKey() }); void queryClientInstance.invalidateQueries({ queryKey: getGetOverviewQueryKey() }); } });
  const criticalCount = item.issues.filter((issue) => issue.severity === 'error').length;
  return <div className="mx-auto max-w-[1440px] rise-in">
    <Link href="/imports" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#315d7f] hover:text-[#244c65]" data-testid="link-back-imports"><ArrowLeft size={14} /> Import review</Link>
    <PageHeading eyebrow="Import record" title={item.sourceFileName} description={`${item.worksheetName} · created ${formatDate(item.createdAt, true)}`} action={<ImportStatusBadge status={item.status} />} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Rows reviewed" value={formatNumber(item.rowCount)} detail={`${item.columnCount ?? 0} source columns`} icon={Database} tone="navy" />
      <MetricCard label="Departments" value={formatNumber(item.departmentCount)} detail="Destinations detected" icon={Columns3} tone="mint" />
      <MetricCard label="Identifiers" value={formatNumber(item.uniqueIdentifierCount)} detail={`${formatNumber(item.quality.missingIdentifiers)} missing`} icon={Hash} tone={item.quality.missingIdentifiers ? 'amber' : 'mint'} />
      <MetricCard label="Critical findings" value={formatNumber(item.quality.errors + item.quality.conflicts)} detail={`${formatNumber(item.quality.warnings)} warnings`} icon={AlertTriangle} tone={criticalCount ? 'rose' : 'mint'} />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <div className="space-y-6">
        <SectionCard title="Import metadata" eyebrow="Source provenance"><div className="divide-y divide-slate-100">{[['Source file hash', item.sourceFileHash], ['File size', `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`], ['Worksheet', item.worksheetName], ['Created', formatDate(item.createdAt, true)], ['Committed', formatDate(item.committedAt, true)]].map(([label, value]) => <div className="flex items-center justify-between gap-4 px-5 py-3.5" key={label}><span className="text-xs text-slate-500">{label}</span><span className="max-w-[58%] truncate text-right font-mono text-[11px] font-bold text-[#1e3447]" title={String(value)}>{value}</span></div>)}</div></SectionCard>
        <SectionCard title="Baseline status" eyebrow="Commit control">{item.status === 'committed' ? <div className="p-5"><div className="flex items-start gap-3 rounded-lg border border-[#b9ded2] bg-[#eef8f4] p-4"><BadgeCheck className="mt-0.5 shrink-0 text-[#28725e]" size={18} /><div><div className="text-xs font-bold text-[#1e6856]">Immutable baseline committed</div><p className="mt-1 text-[11px] leading-relaxed text-[#46766a]">This import is now the governed source for the cycle. It cannot be edited in place.</p></div></div></div> : <div className="p-5"><div className="rounded-lg border border-[#e9d3a6] bg-[#fff8e8] p-4"><div className="flex items-center gap-2 text-xs font-bold text-[#85601f]"><Clock3 size={15} /> Review is ready for a commit decision</div><p className="mt-2 text-[11px] leading-relaxed text-[#8e784d]">{criticalCount ? `Resolve ${criticalCount} critical finding${criticalCount === 1 ? '' : 's'} before committing this baseline.` : 'Acknowledge the reviewed findings, then commit when the record is ready.'}</p></div><label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-slate-600"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 accent-[#315d7f]" data-testid="input-acknowledge-import" /><span>I have reviewed the quality findings and confirm this source is ready for baseline.</span></label><button disabled={!acknowledged || commitImport.isPending || criticalCount > 0} onClick={commit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#244c65] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-commit-baseline">{commitImport.isPending ? <><RefreshCw className="animate-spin" size={14} /> Committing…</> : <><ShieldCheck size={14} /> Commit immutable baseline</>}</button>{commitImport.isError && <p className="mt-3 text-xs font-semibold text-[#a34b3d]" data-testid="status-commit-error">Commit failed. Retry once the service is available.</p>}</div>}</SectionCard>
      </div>
      <SectionCard title="Quality findings" eyebrow={`${item.issues.length} findings across source rows`} action={<Badge tone={criticalCount ? 'critical' : 'success'}>{criticalCount ? `${criticalCount} critical` : 'No critical findings'}</Badge>}>
        {!item.issues.length ? <EmptyState title="No quality findings" detail="This import passed the available validation checks." /> : <div className="divide-y divide-slate-100">{item.issues.map((issue, index) => <IssueRow issue={issue} key={`${issue.code}-${index}`} />)}</div>}
      </SectionCard>
    </div>
    <SectionCard title="Preview rows" eyebrow={`Showing ${Math.min(item.previewRows.length, 12)} of ${formatNumber(item.rowCount)} source rows`} className="mt-6">
      <PreviewTable rows={item.previewRows.slice(0, 12)} />
    </SectionCard>
  </div>;
}

function IssueRow({ issue }: { issue: QualityIssue }) {
  const critical = issue.severity === 'error';
  return <div className="px-5 py-4" data-testid={`issue-${issue.code}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${critical ? 'bg-[#fff1ee] text-[#a34b3d]' : issue.severity === 'warning' ? 'bg-[#fff7e8] text-[#8b641f]' : 'bg-[#eef4f9] text-[#315d7f]'}`}>{critical ? <CircleAlert size={14} /> : <AlertTriangle size={14} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[#1e3447]">{issue.title}</span><Badge tone={critical ? 'critical' : issue.severity === 'warning' ? 'warning' : 'info'}>{issue.severity}</Badge></div><p className="mt-1 text-xs leading-relaxed text-slate-500">{issue.detail}</p>{issue.rowNumbers.length > 0 && <div className="mt-2 font-mono text-[10px] text-slate-400">Rows {issue.rowNumbers.slice(0, 8).join(', ')}{issue.rowNumbers.length > 8 ? ` +${issue.rowNumbers.length - 8}` : ''}</div>}</div></div></div>;
}

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  if (!rows.length) return <EmptyState title="Preview is not available" detail="Rows will appear after the workbook parser returns a validated preview." />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#f8fbfb]"><tr className="border-b border-slate-100">{['Row', 'System ID', 'Identifier', 'Nomenclature', 'Unit', 'DGLP', 'ECHS'].map((header) => <th className="px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.sourceRow} className="text-xs hover:bg-[#fbfdfd]" data-testid={`preview-row-${row.sourceRow}`}><td className="px-5 py-3 font-mono text-[11px] text-slate-400">{row.sourceRow}</td><td className="px-5 py-3 font-mono text-[11px] text-slate-600">{row.systemId ?? '—'}</td><td className="px-5 py-3 font-mono text-[11px] font-bold text-[#315d7f]">{row.identifier ?? '—'}</td><td className="max-w-[280px] truncate px-5 py-3 font-semibold text-[#1e3447]">{row.nomenclature ?? '—'}</td><td className="px-5 py-3 text-slate-500">{row.unit ?? '—'}</td><td className="px-5 py-3 font-mono text-[11px] text-slate-600">{row.currentDglp ?? '—'}</td><td className="px-5 py-3 font-mono text-[11px] text-slate-600">{row.currentEchs ?? '—'}</td></tr>)}</tbody></table></div>;
}

function DepartmentsPage() {
  const departmentsQuery = useListDepartments();
  const [search, setSearch] = useState('');
  const departments = useMemo(() => (departmentsQuery.data ?? []).filter((department) => department.name.toLowerCase().includes(search.toLowerCase())), [departmentsQuery.data, search]);
  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Destinations" title="Departments" description="Detected departmental destinations from the active legacy workbook, ready for allocation review." action={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none ring-[#9ed8c7] placeholder:text-slate-400 focus:ring-2 sm:w-56" data-testid="input-search-departments" /></div>} />
    {departmentsQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="skeleton h-44 rounded-xl" /><div className="skeleton h-44 rounded-xl" /><div className="skeleton h-44 rounded-xl" /></div> : departmentsQuery.isError ? <QueryState error={departmentsQuery.error} onRetry={() => void departmentsQuery.refetch()} label="departments" /> : !departmentsQuery.data?.length ? <SectionCard title="Department destinations"><EmptyState title="No departments detected" detail="Commit a validated baseline to populate departmental destinations." action={<Link href="/imports" className="rounded-lg bg-[#244c65] px-3 py-2 text-xs font-bold text-white" data-testid="link-review-imports-empty">Review imports</Link>} /></SectionCard> : <><div className="mb-5 flex items-center gap-2 text-xs text-slate-500"><Badge tone="info">{departments.length} shown</Badge><span>from {departmentsQuery.data.length} detected destinations</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{departments.map((department, index) => <DepartmentCard department={department} index={index} key={department.id} />)}</div></>}
  </div>;
}

function DepartmentCard({ department, index }: { department: Department; index: number }) {
  const palettes = ['bg-[#edf8f3] text-[#28725e]', 'bg-[#eef4f9] text-[#315d7f]', 'bg-[#fff7e8] text-[#8b641f]'];
  return <div className="panel-shadow group rounded-xl border border-slate-200/90 bg-white p-5 transition-transform duration-200 hover:-translate-y-0.5" data-testid={`card-department-${department.id}`}><div className="flex items-start justify-between gap-4"><span className={`grid size-10 place-items-center rounded-xl font-mono text-xs font-bold ${palettes[index % palettes.length]}`}>{initials(department.name)}</span><Badge tone="success"><CheckCircle2 size={12} /> Detected</Badge></div><div className="mt-5 text-sm font-bold text-[#1e3447]">{department.name}</div><div className="mt-1 text-xs text-slate-500">Source column {department.sourceColumnStart}</div><div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4"><div><div className="font-mono text-2xl font-bold tracking-[-0.07em] text-[#1e3447]">{formatNumber(department.itemCount)}</div><div className="text-[10px] uppercase tracking-[0.1em] text-slate-400">Items mapped</div></div><ArrowRight className="text-slate-300 transition-transform group-hover:translate-x-1" size={17} /></div></div>;
}

function ReviewQueuePage() {
  const importsQuery = useListImports();
  const [filter, setFilter] = useState<'all' | 'critical' | 'missing'>('all');
  const reviewImports = (importsQuery.data ?? []).filter((item) => item.quality.conflicts > 0 || item.quality.missingIdentifiers > 0);
  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Resolution workspace" title="Review queue" description="Focus on identifier conflicts and missing identifiers before the next baseline is committed." action={<div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1"><button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === 'all' ? 'bg-[#edf3f5] text-[#315d7f]' : 'text-slate-500'}`} data-testid="button-filter-all">All</button><button onClick={() => setFilter('critical')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === 'critical' ? 'bg-[#fff1ee] text-[#a34b3d]' : 'text-slate-500'}`} data-testid="button-filter-critical">Conflicts</button><button onClick={() => setFilter('missing')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === 'missing' ? 'bg-[#fff7e8] text-[#8b641f]' : 'text-slate-500'}`} data-testid="button-filter-missing">Missing IDs</button></div>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><MetricCard label="Open imports" value={formatNumber(reviewImports.length)} detail="with identifier findings" icon={FileSpreadsheet} tone="navy" /><MetricCard label="Conflicts" value={formatNumber(reviewImports.reduce((sum, item) => sum + item.quality.conflicts, 0))} detail="duplicate or conflicting IDs" icon={CircleAlert} tone="rose" /><MetricCard label="Missing IDs" value={formatNumber(reviewImports.reduce((sum, item) => sum + item.quality.missingIdentifiers, 0))} detail="rows without identifiers" icon={Hash} tone="amber" /></div>
    <SectionCard title="Identifier findings" eyebrow="Grouped by import" action={<span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400"><Filter size={12} /> {filter}</span>}>
      {importsQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-14 rounded" /><div className="skeleton h-14 rounded" /><div className="skeleton h-14 rounded" /></div> : importsQuery.isError ? <div className="p-5"><QueryState error={importsQuery.error} onRetry={() => void importsQuery.refetch()} label="review queue" /></div> : !reviewImports.length ? <EmptyState title="Queue is clear" detail="No imports currently report identifier conflicts or missing identifiers." action={<Link href="/imports" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#315d7f]" data-testid="link-imports-queue-empty">View import history</Link>} /> : <div className="divide-y divide-slate-100">{reviewImports.filter((item) => filter === 'all' || (filter === 'critical' ? item.quality.conflicts > 0 : item.quality.missingIdentifiers > 0)).map((item) => <Link href={`/imports/${item.id}`} key={item.id} className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[#f8fbfb] sm:flex-row sm:items-center sm:justify-between" data-testid={`queue-item-${item.id}`}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#fff1ee] text-[#a34b3d]"><AlertTriangle size={17} /></span><div><div className="text-xs font-bold text-[#1e3447] group-hover:text-[#315d7f]">{item.sourceFileName}</div><div className="mt-1 text-[11px] text-slate-500">Review created {formatDate(item.createdAt)} · {formatNumber(item.rowCount)} rows</div></div></div><div className="flex items-center gap-3 pl-12 sm:pl-0">{item.quality.conflicts > 0 && <Badge tone="critical">{item.quality.conflicts} conflicts</Badge>}{item.quality.missingIdentifiers > 0 && <Badge tone="warning">{item.quality.missingIdentifiers} missing IDs</Badge>}<ChevronRight size={16} className="text-slate-300" /></div></Link>)}</div>}
    </SectionCard>
  </div>;
}

function Router() {
  return <ErrorRouted><Switch><Route path="/" component={OverviewPage} /><Route path="/imports" component={ImportsPage} /><Route path="/imports/:id" component={ImportDetailPage} /><Route path="/departments" component={DepartmentsPage} /><Route path="/review-queue" component={ReviewQueuePage} /><Route component={NotFound} /></Switch></ErrorRouted>;
}

function ErrorRouted({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function NotFound() {
  return <div className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center text-center"><span className="font-mono text-6xl font-bold tracking-[-0.1em] text-[#315d7f]">404</span><h2 className="mt-3 text-xl font-bold text-[#1e3447]">This workspace view does not exist</h2><p className="mt-2 text-sm text-slate-500">The requested route is not part of the MMF command centre.</p><Link href="/" className="mt-6 rounded-lg bg-[#244c65] px-4 py-2.5 text-xs font-bold text-white" data-testid="link-back-command-centre">Return to command centre</Link></div>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Shell><Router /></Shell></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;