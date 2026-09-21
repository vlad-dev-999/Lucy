import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
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
  getGetCanonicalItemQueryKey,
  getGetOverviewQueryKey,
  getListDepartmentAssignmentsQueryKey,
  getListImportsQueryKey,
  getListVocabularyReviewsQueryKey,
  useDecideVocabularyReview,
  useCommitImport,
  useCreateImport,
  useGetCanonicalItem,
  useGetImport,
  useGetOverview,
  useListCanonicalItems,
  useListDepartmentAssignments,
  useListDepartments,
  useListImports,
  useListVocabularyReviews,
  useUpdateDepartmentAssignmentMmf,
} from '@workspace/api-client-react';
import type { CanonicalItem, CanonicalItemDetail, Department, DepartmentInput, DepartmentItemAssignment, ImportSummary, LegacyItem, LegacyRowInput, ListCanonicalItemsParams, ListVocabularyReviewsParams, PreviewRow, QualityIssue, VocabularyDecisionInput, VocabularyDecisionInputDecision, VocabularyReview } from '@workspace/api-client-react';
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
  { href: '/canonical-vocabulary', label: 'Canonical vocabulary', icon: BookOpen },
  { href: '/stage-4', label: 'Stage 4 workspace', icon: ClipboardCheck },
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

function formatMmfValue(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'Not set'
    : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(value);
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
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [draftDglpMmf, setDraftDglpMmf] = useState('');
  const [draftEchsMmf, setDraftEchsMmf] = useState('');
  const [mmfError, setMmfError] = useState('');
  const [mmfSuccess, setMmfSuccess] = useState('');
  const departments = departmentsQuery.data ?? [];
  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId) ?? null;
  const updateMmf = useUpdateDepartmentAssignmentMmf();
  const assignmentsQuery = useListDepartmentAssignments(selectedDepartmentId, {
    query: {
      queryKey: getListDepartmentAssignmentsQueryKey(selectedDepartmentId),
      enabled: Boolean(selectedDepartmentId),
    },
  });
  const assignments = assignmentsQuery.data ?? [];
  const filteredAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return assignments;
    return assignments.filter((assignment) => [
      assignment.canonicalId,
      assignment.nomenclature,
      assignment.pvms,
      assignment.niv,
      assignment.unit,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch)));
  }, [assignments, search]);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const detailQuery = useGetCanonicalItem(selectedAssignment?.canonicalItemId ?? '', {
    query: {
      queryKey: getGetCanonicalItemQueryKey(selectedAssignment?.canonicalItemId ?? ''),
      enabled: Boolean(selectedAssignment?.canonicalItemId),
    },
  });

  const startEditing = (assignment: DepartmentItemAssignment) => {
    setEditingAssignmentId(assignment.id);
    setSelectedAssignmentId(assignment.id);
    setDraftDglpMmf(assignment.currentDglpMmf === null ? '' : String(assignment.currentDglpMmf));
    setDraftEchsMmf(assignment.currentEchsMmf === null ? '' : String(assignment.currentEchsMmf));
    setMmfError('');
    setMmfSuccess('');
  };

  const cancelEditing = () => {
    setEditingAssignmentId(null);
    setDraftDglpMmf('');
    setDraftEchsMmf('');
    setMmfError('');
  };

  const saveMmf = (assignment: DepartmentItemAssignment) => {
    const parseQuantity = (value: string, label: string) => {
      if (!value.trim()) return null;
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error(`${label} must be a non-negative number.`);
      }
      return quantity;
    };

    let nextDglpMmf: number | null;
    let nextEchsMmf: number | null;
    try {
      nextDglpMmf = parseQuantity(draftDglpMmf, 'DGLP MMF');
      nextEchsMmf = parseQuantity(draftEchsMmf, 'ECHS MMF');
    } catch (error) {
      setMmfError(error instanceof Error ? error.message : 'Enter valid MMF quantities.');
      return;
    }

    const data: { dglpMmf?: number | null; echsMmf?: number | null } = {};
    if (nextDglpMmf !== assignment.currentDglpMmf) data.dglpMmf = nextDglpMmf;
    if (nextEchsMmf !== assignment.currentEchsMmf) data.echsMmf = nextEchsMmf;
    if (!Object.keys(data).length) {
      setMmfError('Change at least one MMF quantity before saving.');
      return;
    }

    setMmfError('');
    updateMmf.mutate(
      {
        departmentId: selectedDepartmentId,
        canonicalItemId: assignment.canonicalItemId,
        data,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getListDepartmentAssignmentsQueryKey(selectedDepartmentId),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetCanonicalItemQueryKey(assignment.canonicalItemId),
          });
          setEditingAssignmentId(null);
          setMmfSuccess(`MMF saved for ${assignment.canonicalId}.`);
          setMmfError('');
        },
        onError: (error) => {
          setMmfError(error instanceof Error ? error.message : 'MMF could not be saved. Try again.');
        },
      },
    );
  };

  useEffect(() => {
    if (!selectedDepartmentId && departments.length) setSelectedDepartmentId(departments[0].id);
  }, [departments, selectedDepartmentId]);

  useEffect(() => {
    if (!assignments.length) {
      setSelectedAssignmentId(null);
      return;
    }
    if (!assignments.some((assignment) => assignment.id === selectedAssignmentId)) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Department workspace" title={selectedDepartment?.name ?? 'Department workspace'} description="Maintain the DGLP and ECHS monthly requirements for active canonical items assigned to this department." />
    {departmentsQuery.isLoading ? <div className="skeleton h-24 rounded-xl" /> : departmentsQuery.isError ? <QueryState error={departmentsQuery.error} onRetry={() => void departmentsQuery.refetch()} label="departments" /> : !departments.length ? <SectionCard title="Department workspace"><EmptyState title="No departments detected" detail="Commit a validated baseline to populate departmental destinations." action={<Link href="/imports" className="rounded-lg bg-[#244c65] px-3 py-2 text-xs font-bold text-white" data-testid="link-review-imports-empty">Review imports</Link>} /></SectionCard> : <>
      <SectionCard title="Select department" eyebrow="Active assignment scope">
        <div className="flex items-center gap-5 px-5 py-4">
          <div className="min-w-[320px]">
            <label htmlFor="select-department" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Department</label>
            <select id="select-department" value={selectedDepartmentId} onChange={(event) => { setSelectedDepartmentId(event.target.value); setSearch(''); setSelectedAssignmentId(null); }} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#1e3447] outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-department">
              {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
            </select>
          </div>
          <div className="border-l border-slate-100 pl-5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Scope</div>
            <div className="mt-2 flex items-center gap-2"><Badge tone="success"><CheckCircle2 size={12} /> Active assignments only</Badge><span className="text-xs text-slate-500">{selectedDepartment?.sourceColumnStart ? `Source column ${selectedDepartment.sourceColumnStart}` : 'Department source'}</span></div>
          </div>
        </div>
      </SectionCard>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,.85fr)]">
          <SectionCard title="Assigned canonical items" eyebrow={`${filteredAssignments.length} shown · ${assignments.length} active assignments`} action={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ID, name, PVMS or NIV" className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#9ed8c7]" data-testid="input-search-department-items" /></div>}>
           {(mmfError || mmfSuccess) && <div className={`mx-5 mt-5 rounded-lg border px-4 py-3 text-xs font-semibold ${mmfError ? 'border-[#e7b8b0] bg-[#fff1ee] text-[#9c3e31]' : 'border-[#b9ded2] bg-[#eef8f4] text-[#1e6856]'}`} role="status" data-testid={mmfError ? 'status-mmf-error' : 'status-mmf-success'}>{mmfError || mmfSuccess}</div>}
          {assignmentsQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /><div className="skeleton h-10 rounded" /></div> : assignmentsQuery.isError ? <div className="p-5"><QueryState error={assignmentsQuery.error} onRetry={() => void assignmentsQuery.refetch()} label="department items" /></div> : !assignments.length ? <EmptyState title="No active items assigned" detail="This department has no active canonical assignments yet. Removed assignments are retained in history but excluded from the workspace." /> : !filteredAssignments.length ? <EmptyState title="No matching items" detail="Try a different canonical ID, nomenclature, PVMS, NIV, or unit search." /> : <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left" data-testid="table-department-items">
              <thead className="bg-[#f8fbfb]"><tr className="border-b border-slate-100">{['Canonical ID', 'Nomenclature', 'PVMS', 'NIV', 'Unit', 'DGLP MMF', 'ECHS MMF', 'Status', 'Actions'].map((header) => <th className="whitespace-nowrap px-3 py-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400" key={header}>{header}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredAssignments.map((assignment) => <tr key={assignment.id} className={`align-middle text-[11px] transition-colors hover:bg-[#fbfdfd] ${assignment.id === selectedAssignmentId ? 'bg-[#f2f8f8]' : ''}`} data-testid={`department-item-row-${assignment.id}`}>
                <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-[#315d7f]">{assignment.canonicalId}</td>
                <td className="max-w-[230px] truncate px-3 py-3 font-semibold text-[#1e3447]" title={assignment.nomenclature ?? undefined}>{assignment.nomenclature ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{assignment.pvms ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{assignment.niv ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-500">{assignment.unit ?? '—'}</td>
                 <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{editingAssignmentId === assignment.id ? <input type="number" min="0" step="any" value={draftDglpMmf} onChange={(event) => setDraftDglpMmf(event.target.value)} className="h-8 w-24 rounded-md border border-[#bdcfdf] bg-white px-2 text-[11px] outline-none focus:ring-2 focus:ring-[#9ed8c7]" aria-label={`DGLP MMF for ${assignment.canonicalId}`} data-testid={`input-dglp-mmf-${assignment.id}`} /> : formatMmfValue(assignment.currentDglpMmf)}</td>
                 <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-600">{editingAssignmentId === assignment.id ? <input type="number" min="0" step="any" value={draftEchsMmf} onChange={(event) => setDraftEchsMmf(event.target.value)} className="h-8 w-24 rounded-md border border-[#bdcfdf] bg-white px-2 text-[11px] outline-none focus:ring-2 focus:ring-[#9ed8c7]" aria-label={`ECHS MMF for ${assignment.canonicalId}`} data-testid={`input-echs-mmf-${assignment.id}`} /> : formatMmfValue(assignment.currentEchsMmf)}</td>
                <td className="px-3 py-3"><Badge tone="success"><CheckCircle2 size={11} /> Active</Badge></td>
                 <td className="px-3 py-3">{editingAssignmentId === assignment.id ? <div className="flex items-center gap-1.5"><button disabled={updateMmf.isPending} onClick={() => saveMmf(assignment)} className="inline-flex items-center gap-1 rounded-md bg-[#244c65] px-2 py-1.5 font-semibold text-white hover:bg-[#1b3c50] disabled:cursor-not-allowed disabled:opacity-50" data-testid={`button-save-mmf-${assignment.id}`}>{updateMmf.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Save</button><button disabled={updateMmf.isPending} onClick={cancelEditing} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" data-testid={`button-cancel-mmf-${assignment.id}`}>Cancel</button></div> : <div className="flex items-center gap-1.5"><button onClick={() => startEditing(assignment)} className="inline-flex items-center gap-1 rounded-md border border-[#bdcfdf] px-2 py-1.5 font-semibold text-[#315d7f] hover:bg-[#eef4f9]" data-testid={`button-edit-mmf-${assignment.id}`}>Edit MMF</button><button onClick={() => setSelectedAssignmentId(assignment.id)} className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label={`Open ${assignment.canonicalId}`} data-testid={`button-open-department-item-${assignment.id}`}><ChevronRight size={13} /></button></div>}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </SectionCard>
       <DepartmentItemDetail assignment={selectedAssignment} detailQuery={detailQuery} />
      </div>
    </>}
  </div>;
}

function DepartmentItemDetail({ assignment, detailQuery }: {
  assignment: DepartmentItemAssignment | null;
  detailQuery: {
    data?: CanonicalItemDetail;
    isLoading: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => void;
  };
}) {
  if (!assignment) return <SectionCard title="Item detail" eyebrow="Canonical → source → assignment"><EmptyState title="Select an item" detail="Open an assigned canonical item to inspect its governed values, department assignment, and preserved source lineage." /></SectionCard>;
  if (detailQuery.isLoading) return <SectionCard title="Item detail" eyebrow="Loading canonical context"><div className="space-y-3 p-5"><div className="skeleton h-16 rounded-lg" /><div className="skeleton h-24 rounded-lg" /><div className="skeleton h-32 rounded-lg" /></div></SectionCard>;
  if (detailQuery.isError || !detailQuery.data) return <SectionCard title="Item detail" eyebrow="Canonical context"><div className="p-5"><QueryState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} label="item detail" /></div></SectionCard>;

  const item = detailQuery.data;
  const departmentalSource = item.legacyRecords.flatMap((record) => record.departments.filter((department) => department.name === assignment.departmentName));
  const dglpValues = Array.from(new Set(departmentalSource.map((department) => department.dglp).filter((value): value is number => value !== null))).join(', ');
  const echsValues = Array.from(new Set(departmentalSource.map((department) => department.echs).filter((value): value is number => value !== null))).join(', ');
  return <SectionCard title="Item detail" eyebrow="Canonical → source → assignment" action={<Badge tone="success"><CheckCircle2 size={11} /> Assigned</Badge>}>
    <div className="space-y-5 p-5">
      <div><div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e8194]">Canonical item</div><div className="mt-1 text-xl font-bold tracking-[-0.04em] text-[#1e3447]">{item.canonicalId}</div><div className="mt-1 text-xs leading-relaxed text-slate-500">{item.nomenclature ?? 'Unnamed canonical item'}</div></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailField label="PVMS" value={item.pvms} mono />
        <DetailField label="NIV" value={item.niv} mono />
        <DetailField label="Unit" value={item.unit} />
        <DetailField label="Canonical status" value={item.status} />
      </div>
      <div className="border-t border-slate-100 pt-4"><div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e8194]">Department assignment</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><DetailField label="Department" value={assignment.departmentName} /><DetailField label="Assignment state" value={assignment.status} /><DetailField label="Assigned from" value={assignment.source ?? 'Not recorded'} /><DetailField label="Assignment date" value={formatDate(assignment.createdAt)} /></div></div>
       <div className="border-t border-slate-100 pt-4"><div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e8194]">Department MMF</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><DetailField label="DGLP MMF" value={formatMmfValue(assignment.currentDglpMmf)} /><DetailField label="ECHS MMF" value={formatMmfValue(assignment.currentEchsMmf)} /></div><p className="mt-3 text-[11px] leading-relaxed text-slate-500">These are departmental quantities. PVMS and NIV remain identifiers and are not budget heads.</p></div>
      <div className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e8194]">Legacy/source lineage</div><Badge tone="info"><FileText size={11} /> {item.legacyRecords.length} source {item.legacyRecords.length === 1 ? 'record' : 'records'}</Badge></div><div className="mt-3 space-y-2">{item.legacyRecords.slice(0, 3).map((record) => <div key={record.id} className="rounded-lg border border-slate-100 bg-[#fbfdfd] p-3"><div className="font-mono text-[10px] font-bold text-[#315d7f]">{record.sourceWorksheet} · row {record.sourceRow}</div><div className="mt-1 text-[11px] font-semibold text-[#1e3447]">{record.nomenclature ?? 'Unnamed source item'}</div><div className="mt-1 text-[10px] text-slate-500">{record.relationship} lineage{record.decision ? ` · ${record.decision}` : ''}</div></div>)}{item.legacyRecords.length > 3 && <div className="text-[10px] text-slate-400">+{item.legacyRecords.length - 3} more preserved source records</div>}</div></div>
      <div className="border-t border-slate-100 pt-4"><div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#5e8194]">Review history</div><div className="mt-2 text-[11px] leading-relaxed text-slate-500">{item.vocabularyHistory.length ? `${item.vocabularyHistory.length} linked vocabulary review ${item.vocabularyHistory.length === 1 ? 'record' : 'records'}.` : 'No linked vocabulary review history.'}</div></div>
    </div>
  </SectionCard>;
}

const canonicalSortOptions = [
  ['canonicalId', 'Canonical ID'],
  ['nomenclature', 'Nomenclature'],
  ['pvms', 'PVMS'],
  ['niv', 'NIV'],
  ['unit', 'Unit'],
  ['status', 'Status'],
  ['legacyRecordCount', 'Legacy records'],
  ['departmentCount', 'Departments'],
] as const;

function canonicalStatusTone(status: string): 'neutral' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'retired') return 'neutral';
  return 'warning';
}

function CanonicalVocabularyPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<NonNullable<ListCanonicalItemsParams['sort']>>('canonicalId');
  const [direction, setDirection] = useState<NonNullable<ListCanonicalItemsParams['direction']>>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const params = useMemo(() => ({
    search: search.trim() || undefined,
    status: status || undefined,
    sort,
    direction,
    page,
    pageSize,
  }), [direction, page, search, sort, status]);
  const canonicalQuery = useListCanonicalItems(params);
  const data = canonicalQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading
      eyebrow="Governed reference"
      title="Canonical vocabulary"
      description="Review the governed vocabulary while keeping every immutable legacy source record visible and traceable."
      action={<Badge tone="info"><BookOpen size={12} /> {formatNumber(data?.total)} canonical items</Badge>}
    />
    <SectionCard
      title="Canonical items"
      eyebrow="Searchable governed vocabulary"
      action={<span className="font-mono text-[10px] text-slate-400">Page {data?.page ?? page} of {totalPages}</span>}
    >
      <div className="grid gap-3 border-b border-slate-100 bg-[#fbfdfd] p-4 lg:grid-cols-[1fr_170px_180px_140px]">
        <label className="relative block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          <Search className="absolute left-3 top-8 text-slate-400" size={14} />
          <span className="sr-only">Search canonical vocabulary</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search nomenclature, PVMS, or NIV"
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]"
            data-testid="input-search-canonical-vocabulary"
          />
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Status
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-canonical-status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Sort by
          <select value={sort} onChange={(event) => { setSort(event.target.value as NonNullable<ListCanonicalItemsParams['sort']>); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-canonical-sort">
            {canonicalSortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
          Order
          <select value={direction} onChange={(event) => { setDirection(event.target.value as NonNullable<ListCanonicalItemsParams['direction']>); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-canonical-direction">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      {canonicalQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-14 rounded" /><div className="skeleton h-14 rounded" /><div className="skeleton h-14 rounded" /></div>
        : canonicalQuery.isError ? <div className="p-5"><QueryState error={canonicalQuery.error} onRetry={() => void canonicalQuery.refetch()} label="canonical vocabulary" /></div>
          : !data?.items.length ? <EmptyState title="No canonical items found" detail={search || status ? 'Try a different search or status filter.' : 'Canonical items will appear after reviewed legacy records are governed.'} />
            : <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-left" data-testid="table-canonical-items">
                <thead className="bg-[#f8fbfb]">
                  <tr className="border-b border-slate-100">
                    {['Canonical ID', 'Nomenclature', 'PVMS', 'NIV', 'Unit', 'Legacy records', 'Departments', 'Status', 'Actions'].map((header) => <th key={header} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item) => <tr key={item.id} className="text-xs transition-colors hover:bg-[#fbfdfd]" data-testid={`canonical-row-${item.id}`}>
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-[#315d7f]"><Link href={`/canonical-vocabulary/${item.id}`} className="hover:underline" data-testid={`link-canonical-${item.id}`}>{item.canonicalId}</Link></td>
                    <td className="max-w-[300px] truncate px-4 py-3 font-semibold text-[#1e3447]" title={item.nomenclature ?? undefined}>{item.nomenclature ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{item.pvms ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{item.niv ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.unit ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{formatNumber(item.legacyRecordCount)}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{formatNumber(item.departmentCount)}</td>
                    <td className="px-4 py-3"><Badge tone={canonicalStatusTone(item.status)}>{item.status}</Badge></td>
                    <td className="px-4 py-3"><Link href={`/canonical-vocabulary/${item.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#315d7f] hover:bg-[#f1f7f7]" data-testid={`button-open-canonical-${item.id}`}>Open <ArrowRight size={12} /></Link></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <span className="text-[11px] text-slate-500">Showing {data?.items.length ?? 0} of {formatNumber(data?.total)} canonical items</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-canonical-previous"><ArrowLeft size={13} className="mr-1 inline" />Previous</button>
          <button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-canonical-next">Next<ArrowRight size={13} className="ml-1 inline" /></button>
        </div>
      </div>
    </SectionCard>
  </div>;
}

function DetailField({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return <div className="rounded-lg border border-slate-100 bg-[#fbfdfd] p-3"><div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div><div className={`mt-1 text-xs font-semibold text-[#1e3447] ${mono ? 'font-mono' : ''}`}>{value === null || value === undefined || value === '' ? '—' : value}</div></div>;
}

function CanonicalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const detailQuery = useGetCanonicalItem(id, { query: { queryKey: getGetCanonicalItemQueryKey(id), enabled: Boolean(id) } });
  if (detailQuery.isLoading) return <div className="mx-auto max-w-[1440px] rise-in"><div className="skeleton mb-5 h-4 w-44 rounded" /><div className="skeleton h-12 w-96 rounded" /><div className="mt-7 grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div className="skeleton h-24 rounded-xl" key={index} />)}</div><div className="skeleton mt-6 h-72 rounded-xl" /></div>;
  if (detailQuery.isError || !detailQuery.data) return <div className="mx-auto max-w-[1440px] rise-in"><Link href="/canonical-vocabulary" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#315d7f]" data-testid="link-back-canonical-vocabulary"><ArrowLeft size={14} /> Canonical vocabulary</Link><QueryState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} label="canonical item" /></div>;

  const item: CanonicalItemDetail = detailQuery.data;
  const departments = Array.from(new Set(item.legacyRecords.flatMap((record) => record.departments.map((department) => department.name))));
  const specifications = Array.from(new Set(item.legacyRecords.map((record) => record.specification).filter((value): value is string => Boolean(value))));

  return <div className="mx-auto max-w-[1440px] rise-in">
    <Link href="/canonical-vocabulary" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#315d7f] hover:text-[#244c65]" data-testid="link-back-canonical-vocabulary"><ArrowLeft size={14} /> Canonical vocabulary</Link>
    <PageHeading eyebrow="Canonical item detail" title={item.canonicalId} description="Governed vocabulary with preserved legacy source lineage and review history." action={<Badge tone={canonicalStatusTone(item.status)}>{item.status}</Badge>} />
    <div className="grid gap-4 sm:grid-cols-4">
      <MetricCard label="Legacy records" value={formatNumber(item.legacyRecordCount)} detail="Preserved source records" icon={FileText} tone="navy" />
      <MetricCard label="Departments" value={formatNumber(item.departmentCount)} detail="Source destinations" icon={Columns3} tone="mint" />
      <MetricCard label="Review history" value={formatNumber(item.vocabularyHistory.length)} detail="Linked vocabulary reviews" icon={ListFilter} tone="amber" />
      <MetricCard label="Status" value={item.status} detail="Canonical lifecycle state" icon={BookOpen} tone={item.status === 'active' ? 'mint' : 'rose'} />
    </div>
    <SectionCard title="Canonical item" eyebrow="Governed reference values" className="mt-6">
      <div className="grid gap-3 p-5 md:grid-cols-3">
        <DetailField label="Canonical ID" value={item.canonicalId} mono />
        <DetailField label="Nomenclature" value={item.nomenclature} />
        <DetailField label="Specification" value={specifications.length === 1 ? specifications[0] : specifications.length ? `${specifications.length} source specifications` : null} />
        <DetailField label="Unit" value={item.unit} />
        <DetailField label="PVMS" value={item.pvms} mono />
        <DetailField label="NIV" value={item.niv} mono />
        <DetailField label="Departments" value={departments.length ? departments.join(', ') : null} />
        <DetailField label="Status" value={item.status} />
      </div>
      {specifications.length > 1 && <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">Source specifications remain visible in the legacy records below because canonical items do not overwrite their original descriptions.</div>}
    </SectionCard>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <SectionCard title="Legacy records" eyebrow="Immutable source lineage">
        <div className="border-b border-slate-100 bg-[#f8fbfb] px-5 py-3 text-xs text-slate-500">Every source row remains attached to this canonical item. Canonicalization does not erase or replace the legacy record.</div>
        {!item.legacyRecords.length ? <EmptyState title="No linked legacy records" detail="This canonical item has no source lineage records." /> : <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left" data-testid="table-canonical-lineage">
            <thead className="bg-white"><tr className="border-b border-slate-100">{['Import / source row', 'Identifier', 'Nomenclature', 'Specification', 'Unit', 'PVMS', 'NIV', 'DGLP / ECHS', 'Departments'].map((header) => <th key={header} className="px-3 py-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{item.legacyRecords.map((record) => <tr key={record.id} className="align-top text-[11px]" data-testid={`lineage-record-${record.id}`}>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-500">{record.sourceWorksheet} · row {record.sourceRow}<div className="mt-1 text-[10px] text-slate-400">{record.importId}</div></td>
              <td className="px-3 py-3 font-mono font-bold text-[#315d7f]">{record.identifier ?? '—'}</td>
              <td className="max-w-[220px] px-3 py-3 font-semibold text-[#1e3447]">{record.nomenclature ?? '—'}</td>
              <td className="max-w-[220px] px-3 py-3 text-slate-600">{record.specification ?? '—'}</td>
              <td className="px-3 py-3 text-slate-500">{record.unit ?? '—'}</td>
              <td className="px-3 py-3 font-mono text-slate-600">{record.pvms ?? '—'}</td>
              <td className="px-3 py-3 font-mono text-slate-600">{record.niv ?? '—'}</td>
              <td className="max-w-[220px] px-3 py-3 text-slate-600">{record.departments.length ? record.departments.map((department) => <div key={department.name} className="mb-1 last:mb-0"><span className="font-semibold text-[#1e3447]">{department.name}</span><div className="text-[10px] text-slate-400">DGLP {legacyCell(department.dglp)} · ECHS {legacyCell(department.echs)}</div></div>) : '—'}</td>
              <td className="max-w-[180px] px-3 py-3 text-slate-600">{record.departments.length ? record.departments.map((department) => department.name).join(', ') : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </SectionCard>
      <div className="space-y-6">
        <SectionCard title="Lineage" eyebrow="Canonical item → legacy records">
          <div className="p-5">
            <div className="rounded-lg border border-[#bdcfdf] bg-[#f7fafc] p-4">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#dcebf3] text-[#315d7f]"><BookOpen size={17} /></span><div><div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#315d7f]">Canonical item</div><div className="mt-1 text-sm font-bold text-[#1e3447]">{item.canonicalId}</div></div></div>
              <div className="ml-4 h-7 border-l border-dashed border-[#8eafbf]" />
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#edf8f3] text-[#28725e]"><FileText size={17} /></span><div><div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#28725e]">Legacy records</div><div className="mt-1 text-sm font-bold text-[#1e3447]">{formatNumber(item.legacyRecords.length)} preserved source rows</div></div></div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Review / decision history" eyebrow="Linked decisions and findings">
          {!item.legacyRecords.some((record) => record.decision || record.reviewer || record.reviewedAt || record.reason) && !item.vocabularyHistory.length ? <EmptyState title="No review history" detail="No vocabulary review records are linked to this canonical item." /> : <div>
            {item.legacyRecords.some((record) => record.decision || record.reviewer || record.reviewedAt || record.reason) && <div className="divide-y divide-slate-100">
              {item.legacyRecords.filter((record) => record.decision || record.reviewer || record.reviewedAt || record.reason).map((record) => <div key={`decision-${record.id}`} className="px-5 py-4" data-testid={`decision-${record.id}`}>
                <div className="flex items-center justify-between gap-3"><Badge tone="success">{record.decision ?? 'Reviewed'}</Badge><span className="font-mono text-[10px] text-slate-400">{record.relationship}</span></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DetailField label="Reviewer" value={record.reviewer} />
                  <DetailField label="Review timestamp" value={formatDate(record.reviewedAt, true)} />
                </div>
                <div className="mt-3 rounded-lg border border-slate-100 bg-[#fbfdfd] p-3"><div className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Reason</div><div className="mt-1 text-[11px] leading-relaxed text-[#1e3447]">{record.reason ?? '—'}</div></div>
              </div>)}
            </div>}
            {item.vocabularyHistory.length > 0 && <div className="divide-y divide-slate-100 border-t border-slate-100">
              {item.vocabularyHistory.map((review) => <div key={review.id} className="px-5 py-4" data-testid={`history-${review.id}`}><div className="flex items-center justify-between gap-3"><Badge tone={review.status === 'resolved' ? 'success' : 'warning'}>{review.status}</Badge><span className="font-mono text-[10px] text-slate-400">{review.reviewType}</span></div><div className="mt-2 text-xs font-bold text-[#1e3447]">{review.title}</div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">{review.detail}</p></div>)}
            </div>}
          </div>}
        </SectionCard>
      </div>
    </div>
  </div>;
}

const reviewTypes = [
  'EXACT_DUPLICATE',
  'PROBABLE_DUPLICATE',
  'IDENTIFIER_CONFLICT',
  'MISSING_IDENTIFIER',
  'OBSOLETE_CANDIDATE',
  'NEW_ITEM',
] as const;

const decisionLabels: Record<string, string> = {
  MERGE: 'Merge into canonical',
  KEEP_SEPARATE: 'Keep separate',
  CORRECT: 'Correct canonical',
  RETIRE: 'Retire',
  CREATE_CANONICAL: 'Create canonical',
  INVESTIGATE: 'Investigate',
};

function reviewTypeLabel(reviewType: string) {
  return reviewType.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function legacyCell(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function LegacyRecordTable({ records }: { records: LegacyItem[] }) {
  if (!records.length) return <EmptyState title="No source records attached" detail="This review record has no preserved legacy candidates." />;
  const columns: Array<{ key: keyof LegacyItem; label: string }> = [
    { key: 'identifier', label: 'Identifier' },
    { key: 'nomenclature', label: 'Nomenclature' },
    { key: 'specification', label: 'Specification' },
    { key: 'unit', label: 'Unit' },
    { key: 'pvms', label: 'PVMS' },
    { key: 'niv', label: 'NIV' },
    { key: 'currentDglpMmf', label: 'DGLP' },
    { key: 'currentEchsMmf', label: 'ECHS' },
  ];
  return <div className="overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full min-w-[980px] text-left">
      <thead className="bg-[#f8fbfb]">
        <tr className="border-b border-slate-200">
          {['Source', ...columns.map((column) => column.label), 'Departments'].map((label) => <th key={label} className="px-3 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {records.map((record) => <tr key={record.id} className="align-top text-[11px]" data-testid={`review-record-${record.id}`}>
          <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-500">{record.sourceWorksheet} · row {record.sourceRow}<div className="mt-1 text-[10px] text-slate-400">{record.importId}</div></td>
          {columns.map((column) => <td key={column.key} className={`max-w-[190px] px-3 py-3 ${column.key === 'identifier' ? 'font-mono font-bold text-[#315d7f]' : 'text-slate-600'}`}>{legacyCell(record[column.key] as string | number | null | undefined)}</td>)}
          <td className="max-w-[180px] px-3 py-3 text-slate-600">{record.departments.length ? record.departments.map((department) => department.name).join(', ') : '—'}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

function ReviewDecisionPanel({ review, canonicals, onComplete, onFeedback }: { review: VocabularyReview; canonicals: CanonicalItem[]; onComplete: (message: string) => void; onFeedback: (message: string) => void }) {
  const decide = useDecideVocabularyReview();
  const [decision, setDecision] = useState<keyof typeof decisionLabels>('INVESTIGATE');
  const [canonicalId, setCanonicalId] = useState('');
  const [note, setNote] = useState('');
  const [nomenclature, setNomenclature] = useState('');
  const [unit, setUnit] = useState('');
  const [pvms, setPvms] = useState('');
  const [niv, setNiv] = useState('');

  useEffect(() => {
    const first = review.candidateRecords[0];
    setDecision('INVESTIGATE');
    setCanonicalId('');
    setNote('');
    setNomenclature(first?.nomenclature ?? '');
    setUnit(first?.unit ?? '');
    setPvms(first?.pvms ?? '');
    setNiv(first?.niv ?? '');
  }, [review]);

  const needsTarget = decision === 'MERGE' || decision === 'CORRECT';
  const submit = () => {
    if (needsTarget && !canonicalId) {
      onFeedback('Select an explicit canonical target before continuing.');
      return;
    }
    if (!window.confirm(`${decisionLabels[decision]} this review? The legacy source record will be preserved.`)) return;
    const data: VocabularyDecisionInput = {
      decision: decision as VocabularyDecisionInputDecision,
      note: note.trim() || undefined,
      canonicalItemIds: canonicalId ? [canonicalId] : undefined,
      ...(decision === 'CORRECT' ? {
        nomenclature: nomenclature.trim() || null,
        unit: unit.trim() || null,
        pvms: pvms.trim() || null,
        niv: niv.trim() || null,
      } : {}),
    };
    decide.mutate({ reviewId: review.id, data }, {
      onSuccess: () => onComplete(`${reviewTypeLabel(review.reviewType)} marked ${decisionLabels[decision].toLowerCase()}.`),
      onError: () => onFeedback('The review action could not be saved. No legacy source record was deleted.'),
    });
  };

  return <div className="mt-5 rounded-xl border border-[#bdcfdf] bg-[#f7fafc] p-4">
    <div className="flex items-start justify-between gap-4">
      <div><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#315d7f]">Decision</div><h3 className="mt-1 text-sm font-bold text-[#1e3447]">Record a governed outcome</h3><p className="mt-1 text-[11px] text-slate-500">Every action keeps the immutable legacy source row and records the reviewer note.</p></div>
      {decide.isPending && <Badge tone="info"><RefreshCw size={11} className="animate-spin" /> Saving</Badge>}
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-[190px_1fr]">
      <label className="text-[11px] font-semibold text-slate-600">Action<select value={decision} onChange={(event) => setDecision(event.target.value as keyof typeof decisionLabels)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-review-action">{Object.entries(decisionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {(needsTarget || decision === 'RETIRE') && <label className="text-[11px] font-semibold text-slate-600">Canonical target {needsTarget && <span className="font-normal text-[#a34b3d]">required</span>}<select value={canonicalId} onChange={(event) => setCanonicalId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-canonical-target"><option value="">Select canonical item</option>{canonicals.map((canonical) => <option key={canonical.id} value={canonical.id}>{canonical.canonicalId} · {canonical.nomenclature ?? 'Unnamed item'}</option>)}</select></label>}
    </div>
    {decision === 'CORRECT' && <div className="mt-3 grid gap-3 md:grid-cols-4">{[['Nomenclature', nomenclature, setNomenclature], ['Unit', unit, setUnit], ['PVMS', pvms, setPvms], ['NIV', niv, setNiv]].map(([label, value, setter]) => <label key={label as string} className="text-[11px] font-semibold text-slate-600">{label as string}<input value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal outline-none focus:ring-2 focus:ring-[#9ed8c7]" /></label>)}</div>}
    <label className="mt-3 block text-[11px] font-semibold text-slate-600">Reviewer note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Explain the governance decision or next step" className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="textarea-review-note" /></label>
    <div className="mt-3 flex justify-end"><button disabled={decide.isPending} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-[#244c65] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1a3d51] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-review"><Check size={14} /> Save decision</button></div>
  </div>;
}

function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListVocabularyReviewsParams['status']>('open');
  const [reviewType, setReviewType] = useState('');
  const [sort, setSort] = useState<ListVocabularyReviewsParams['sort']>('createdAt');
  const [direction, setDirection] = useState<ListVocabularyReviewsParams['direction']>('desc');
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<VocabularyReview | null>(null);
  const [feedback, setFeedback] = useState('');
  const pageSize = 10;
  const params = useMemo(() => ({ search: search.trim() || undefined, status, reviewType: reviewType || undefined, sort, direction, page, pageSize }), [direction, page, reviewType, search, sort, status]);
  const reviewsQuery = useListVocabularyReviews(params);
  const canonicalQuery = useListCanonicalItems({ status: 'active', page: 1, pageSize: 100 });
  const data = reviewsQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectReview = (review: VocabularyReview) => {
    setFeedback('');
    setSelectedReview(review);
  };
  const completeDecision = (message: string) => {
    setFeedback(message);
    setSelectedReview(null);
    void queryClient.invalidateQueries({ queryKey: getListVocabularyReviewsQueryKey() });
  };

  return <div className="mx-auto max-w-[1440px] rise-in">
    <PageHeading eyebrow="Resolution workspace" title="Vocabulary review" description="Resolve duplicate, conflicting, missing, new, and obsolete vocabulary records without changing the underlying source workbook." action={<div className="flex items-center gap-2"><Badge tone="info"><Database size={12} /> {formatNumber(data?.total)} records</Badge></div>} />
    {feedback && <div className="mb-5 flex items-center justify-between rounded-lg border border-[#b9ded2] bg-[#eef8f4] px-4 py-3 text-xs font-semibold text-[#1e6856]" role="status"><span className="flex items-center gap-2"><CheckCircle2 size={15} /> {feedback}</span><button onClick={() => setFeedback('')} aria-label="Dismiss feedback"><X size={14} /></button></div>}
    <SectionCard title="Review queue" eyebrow="Actionable vocabulary records" action={<div className="flex items-center gap-2"><span className="font-mono text-[10px] text-slate-400">Page {data?.page ?? page} of {totalPages}</span><button onClick={() => void reviewsQuery.refetch()} className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Refresh review queue" data-testid="button-refresh-review-queue"><RefreshCw size={14} /></button></div>}>
      <div className="grid gap-3 border-b border-slate-100 bg-[#fbfdfd] p-4 lg:grid-cols-[1fr_160px_180px_150px_110px]">
        <label className="relative block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400"><Search className="absolute left-3 top-8 text-slate-400" size={14} /><span className="sr-only">Search</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search identifier, title, or detail" className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="input-search-review-queue" /></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Issue type<select value={reviewType} onChange={(event) => { setReviewType(event.target.value); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-review-type"><option value="">All issue types</option>{reviewTypes.map((type) => <option key={type} value={type}>{reviewTypeLabel(type)}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Status<select value={status} onChange={(event) => { setStatus(event.target.value as ListVocabularyReviewsParams['status']); setPage(1); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-review-status"><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All statuses</option></select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as ListVocabularyReviewsParams['sort'])} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-review-sort"><option value="createdAt">Created</option><option value="reviewType">Issue type</option><option value="status">Status</option><option value="identifier">Identifier</option><option value="title">Title</option></select></label>
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Order<select value={direction} onChange={(event) => setDirection(event.target.value as ListVocabularyReviewsParams['direction'])} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:ring-2 focus:ring-[#9ed8c7]" data-testid="select-review-direction"><option value="desc">Newest</option><option value="asc">Oldest</option></select></label>
      </div>
      {reviewsQuery.isLoading ? <div className="space-y-3 p-5"><div className="skeleton h-20 rounded" /><div className="skeleton h-20 rounded" /><div className="skeleton h-20 rounded" /></div> : reviewsQuery.isError ? <div className="p-5"><QueryState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} label="vocabulary review queue" /></div> : !data?.items.length ? <EmptyState title={status === 'open' ? 'Queue is clear' : 'No review records found'} detail={status === 'open' ? 'No open vocabulary decisions match the current filters.' : 'Try a different status, issue type, or search term.'} /> : <div className="divide-y divide-slate-100">{data.items.map((review) => <button key={review.id} onClick={() => selectReview(review)} className={`block w-full px-5 py-4 text-left transition-colors hover:bg-[#f8fbfb] ${selectedReview?.id === review.id ? 'bg-[#f1f7f7]' : ''}`} data-testid={`queue-item-${review.id}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={review.status === 'open' ? 'warning' : 'success'}>{review.status}</Badge><Badge tone={review.reviewType === 'IDENTIFIER_CONFLICT' ? 'critical' : 'info'}>{reviewTypeLabel(review.reviewType)}</Badge>{review.identifier && <span className="font-mono text-[11px] font-bold text-[#315d7f]">{review.identifier}</span>}</div><div className="mt-2 text-sm font-bold text-[#1e3447]">{review.title}</div><p className="mt-1 max-w-4xl truncate text-xs text-slate-500">{review.detail}</p></div><div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400"><span>{review.candidateRecords.length} source {review.candidateRecords.length === 1 ? 'record' : 'records'}</span><ChevronRight size={16} /></div></div></button>)}</div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><span className="text-[11px] text-slate-500">Showing {data?.items.length ?? 0} of {formatNumber(data?.total)} records</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-review-previous"><ArrowLeft size={13} className="inline mr-1" />Previous</button><button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-review-next">Next<ArrowRight size={13} className="inline ml-1" /></button></div></div>
    </SectionCard>
    {selectedReview && <section className="mt-6 rounded-xl border border-slate-200 bg-white panel-shadow"><div className="border-b border-slate-100 px-5 py-4"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{reviewTypeLabel(selectedReview.reviewType)}</span><Badge tone={selectedReview.status === 'open' ? 'warning' : 'success'}>{selectedReview.status}</Badge></div><h2 className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#1e3447]">{selectedReview.title}</h2><p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">{selectedReview.detail}</p></div><button onClick={() => setSelectedReview(null)} className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50" aria-label="Close review detail"><X size={15} /></button></div></div><div className="p-5"><div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><FileText size={13} /> Preserved legacy records {selectedReview.reviewType === 'IDENTIFIER_CONFLICT' && <span className="font-sans font-normal normal-case tracking-normal text-slate-500">Compare side-by-side before deciding.</span>}</div><LegacyRecordTable records={selectedReview.candidateRecords} /><ReviewDecisionPanel review={selectedReview} canonicals={canonicalQuery.data?.items ?? []} onComplete={completeDecision} onFeedback={setFeedback} /></div></section>}
  </div>;
}

function Stage4Page() {
  const departmentsQuery = useListDepartments();
  const [departmentId, setDepartmentId] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Array<{ id: string; nomenclature: string | null; pvms: string | null; niv: string | null }>>([]);
  const departments = departmentsQuery.data ?? [];
  useEffect(() => { if (!departmentId && departments.length) setDepartmentId(departments[0].id); }, [departmentId, departments]);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!search.trim()) return setMatches([]); const response = await fetch(`/api/canonical-items/search?q=${encodeURIComponent(search)}`); setMatches(response.ok ? await response.json() : []); }, 250); return () => window.clearTimeout(timer); }, [search]);
  const submitProposal = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const body: Record<string, unknown> = Object.fromEntries(form); for (const key of ['dglpMmf', 'echsMmf']) if (body[key] === '') body[key] = null; else body[key] = Number(body[key]); const response = await fetch(`/api/departments/${departmentId}/proposals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); setMessage(response.ok ? 'Proposal submitted for review. No canonical item was created.' : data.error); };
  const setCommonUse = async (id: string) => { const d = window.prompt('Hospital/Common-use DGLP MMF'); const e = window.prompt('Hospital/Common-use ECHS MMF'); if (d === null || e === null) return; const response = await fetch(`/api/canonical-items/${id}/common-use-mmf`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dglpMmf: d === '' ? null : Number(d), echsMmf: e === '' ? null : Number(e) }) }); setMessage(response.ok ? 'Hospital/Common-use MMF saved separately from departmental MMF; it is never summed with it.' : 'Common-use MMF could not be saved.'); };
  const submitDepartment = async () => { const response = await fetch(`/api/departments/${departmentId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const data = await response.json(); setMessage(response.ok ? 'Department submitted. Ordinary department edits are blocked server-side.' : data.error); };
  const input = 'h-9 rounded border border-slate-200 px-2 text-xs';
  return <div className="mx-auto max-w-[1440px] rise-in"><PageHeading eyebrow="Stage 4 governance" title="Proposals, common-use MMF & submission" description="Search canonical vocabulary first. Proposals remain proposals, while Hospital/Common-use MMF is explicitly separate from Departmental MMF." />{message && <div className="mb-5 rounded border border-[#b9ded2] bg-[#eef8f4] px-4 py-3 text-xs text-[#1e6856]">{message}</div>}<SectionCard title="Department working set" eyebrow="Finalize complete work"><div className="flex flex-wrap items-end gap-3 p-5"><label className="text-xs font-semibold">Department<select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="ml-2 h-9 rounded border px-2" data-testid="select-stage4-department">{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><button onClick={() => void submitDepartment()} className="rounded bg-[#244c65] px-3 py-2 text-xs font-bold text-white" data-testid="button-submit-department">Submit department</button></div><p className="px-5 pb-5 text-[11px] text-slate-500">The API permits submission only when every ACTIVE departmental assignment has DGLP and ECHS MMF. Submission is persisted and prevents ordinary server-side edits.</p></SectionCard><div className="mt-6 grid gap-6 lg:grid-cols-2"><SectionCard title="Search before proposing" eyebrow="Reuse canonical vocabulary"><div className="p-5"><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded border px-3 text-xs" placeholder="Search canonical nomenclature, PVMS or NIV" data-testid="input-proposal-canonical-search" />{matches.map((item) => <div key={item.id} className="mt-2 flex justify-between rounded bg-[#eef8f4] p-2 text-xs"><span>{item.nomenclature} · {item.pvms ?? item.niv ?? 'No ID'}</span><button onClick={() => void setCommonUse(item.id)} className="font-bold text-[#315d7f] underline">Set Hospital/Common-use MMF</button></div>)}<form onSubmit={submitProposal} className="mt-4 grid gap-2"><input required name="nomenclature" className={input} placeholder="Nomenclature/name" /><input required name="specification" className={input} placeholder="Specification" /><div className="grid grid-cols-3 gap-2"><input required name="unit" className={input} placeholder="Unit" /><input name="pvms" className={input} placeholder="PVMS" /><input name="niv" className={input} placeholder="NIV" /></div><div className="grid grid-cols-2 gap-2"><input name="dglpMmf" type="number" min="0" className={input} placeholder="Proposed DGLP MMF" /><input name="echsMmf" type="number" min="0" className={input} placeholder="Proposed ECHS MMF" /></div><textarea required name="justification" className="rounded border p-2 text-xs" placeholder="Justification" /><input required name="proposer" defaultValue="demo-department-user" className={input} placeholder="Proposer" /><button className="rounded bg-[#244c65] p-2 text-xs font-bold text-white" data-testid="button-submit-proposal">Submit proposal for review</button></form></div></SectionCard><SectionCard title="Review and progress" eyebrow="Hospital visibility"><div className="p-5 text-xs text-slate-500">The existing Review queue remains the governed review workspace. New proposal lifecycle decisions are available through the Stage 4 API, and the persisted hospital submission-status API provides INCOMPLETE, READY, and SUBMITTED progress for every department.</div></SectionCard></div></div>;
}

function Router() {
  return <ErrorRouted><Switch><Route path="/" component={OverviewPage} /><Route path="/stage-4" component={Stage4Page} /><Route path="/imports" component={ImportsPage} /><Route path="/imports/:id" component={ImportDetailPage} /><Route path="/departments" component={DepartmentsPage} /><Route path="/review-queue" component={ReviewQueuePage} /><Route path="/canonical-vocabulary/:id" component={CanonicalDetailPage} /><Route path="/canonical-vocabulary" component={CanonicalVocabularyPage} /><Route component={NotFound} /></Switch></ErrorRouted>;
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
