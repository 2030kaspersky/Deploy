import { useEffect, useMemo, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import { SignatureEditor, type SignaturePlacementPayload } from './SignatureEditor';
import {
  Archive,
  CheckCircle2,
  Cloud,
  FileCheck2,
  FilePlus2,
  Files,
  Fingerprint,
  LayoutDashboard,
  LogIn,
  LogOut,
  PenLine,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

type MeData = {
  onboarded: boolean;
  email?: string;
  name?: string;
  profile?: {
    userId: string;
    email: string;
    name: string;
    orgId: string;
    role: 'owner' | 'member';
    accountType: 'school' | 'individual';
  };
  org?: {
    orgId: string;
    type: 'school' | 'individual';
    name: string;
  };
};

type Member = {
  id: string;
  email: string;
  name: string;
  status: 'invited' | 'active' | 'disabled';
};

type DocSummary = {
  docId: string;
  code: string;
  title: string;
  category: string;
  dueDate: string;
  createdAt: string;
  status: 'awaiting_signatures' | 'completed' | 'archived';
  signerEmails: string[];
  signersTotal: number;
  signersCompleted: number;
};

type Signer = {
  email: string;
  name: string;
  action: 'sign' | 'approve' | 'acknowledge';
  order: number;
  status: 'pending' | 'completed';
  actedAt?: string;
};

type DocumentDetail = {
  docId: string;
  code: string;
  title: string;
  category: string;
  description: string;
  dueDate: string;
  createdAt: string;
  status: DocSummary['status'];
  signers: Signer[];
  originalHash: string;
  finalHash?: string;
  verificationToken: string;
  storageState: string;
};

const statusLabel: Record<string, string> = {
  awaiting_signatures: 'بانتظار التوقيع',
  completed: 'مكتمل',
  archived: 'مؤرشف',
};

const actionLabel: Record<string, string> = {
  sign: 'توقيع',
  approve: 'اعتماد',
  acknowledge: 'إقرار بالاطلاع',
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
  }).format(new Date(value));
};

const readFileBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'primary' | 'ghost' | 'danger';
  }
) {
  const { tone = 'primary', className = '', ...rest } = props;
  return <button className={`btn btn-${tone} ${className}`} {...rest} />;
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

function App() {
  const [user, setUser] =
    useState<Awaited<ReturnType<typeof auth.getUser>>>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [verifySeed, setVerifySeed] = useState({ code: '', token: '' });

  const loadMe = async () => {
    const res = await api.get('/api/me');
    setMe(res.data as MeData);
  };

  useEffect(() => {
    const start = async () => {
      const current = await auth.getUser();
      setUser(current);
      if (current) await loadMe();
      const hashValue = window.location.hash;
      if (hashValue.startsWith('#verify?')) {
        const params = new URLSearchParams(hashValue.slice('#verify?'.length));
        setVerifySeed({
          code: params.get('code') || '',
          token: params.get('token') || '',
        });
      }
      setBusy(false);
    };
    start().catch((err: unknown) => {
      setNotice(err instanceof Error ? err.message : 'تعذر بدء التطبيق');
      setBusy(false);
    });
  }, []);

  const signIn = async () => {
    try {
      setNotice('');
      const result = await auth.signIn();
      setUser(result.user);
      await loadMe();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      setNotice(
        code === 'popup_blocked'
          ? 'اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
          : 'لم يكتمل تسجيل الدخول.'
      );
    }
  };

  const signOut = async () => {
    await auth.signOut();
    setUser(null);
    setMe(null);
  };

  if (busy)
    return (
      <div className="center-screen">
        <div className="loader" />
        <p>تهيئة حذام…</p>
      </div>
    );

  if (!user) {
    return (
      <Landing onSignIn={signIn} notice={notice} verifySeed={verifySeed} />
    );
  }

  if (!me?.onboarded) {
    return (
      <Onboarding
        userName={user.name || ''}
        onDone={loadMe}
        onSignOut={signOut}
      />
    );
  }

  return <Workspace me={me} onSignOut={signOut} />;
}

function Landing({
  onSignIn,
  notice,
  verifySeed,
}: {
  onSignIn: () => void;
  notice: string;
  verifySeed: { code: string; token: string };
}) {
  const [showVerify, setShowVerify] = useState(Boolean(verifySeed.code));
  return (
    <main className="landing">
      <header className="public-nav">
        <Brand />
        <div className="nav-actions">
          <button className="text-link" onClick={() => setShowVerify(v => !v)}>
            تحقق من مستند
          </button>
          <Button onClick={onSignIn}>
            <LogIn size={18} /> دخول
          </Button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">منصة التوقيع والاعتماد الإلكتروني</span>
          <h1>
            توقيع أكثر وضوحًا.
            <br />
            <span>اعتماد أكثر ثقة.</span>
          </h1>
          <p>
            أنشئ المعاملة، حدد الأطراف، تابع التوقيعات بالتسلسل، واحتفظ بسجل
            تدقيق وبصمة رقمية لكل مستند.
          </p>
          <div className="hero-actions">
            <Button onClick={onSignIn}>
              ابدأ مع حذام <PenLine size={18} />
            </Button>
            <Button tone="ghost" onClick={() => setShowVerify(true)}>
              التحقق العام <ShieldCheck size={18} />
            </Button>
          </div>
          {notice && <div className="notice error">{notice}</div>}
        </div>
        <div className="hero-panel">
          <div className="seal">
            <Fingerprint size={42} />
          </div>
          <strong>حذام</strong>
          <small>HADHAM</small>
          <p>وقّع بثقة</p>
          <div className="mini-flow">
            <span>رفع PDF</span>
            <b>←</b>
            <span>تحديد الأطراف</span>
            <b>←</b>
            <span>توقيع</span>
            <b>←</b>
            <span>تحقق</span>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <Card>
          <FileCheck2 />
          <h3>مسار توقيع متسلسل</h3>
          <p>يصل الدور لكل موقّع بالترتيب لمنع تعارض نسخ المستند.</p>
        </Card>
        <Card>
          <Fingerprint />
          <h3>بصمة SHA-256</h3>
          <p>بصمة للأصل وللنسخة النهائية لإظهار أي تغيير لاحق.</p>
        </Card>
        <Card>
          <Archive />
          <h3>أرشفة بحساب المشترك</h3>
          <p>التصميم مهيأ لأرشفة النسخ النهائية في OneDrive الخاص بالمشترك.</p>
        </Card>
      </section>

      <section className="plans">
        <div>
          <span>فردي</span>
          <strong>شخص واحد</strong>
        </div>
        <div>
          <span>مدرسة صغيرة</span>
          <strong>حتى 25 معلمًا</strong>
        </div>
        <div>
          <span>مدرسة متوسطة</span>
          <strong>حتى 50 معلمًا</strong>
        </div>
        <div>
          <span>مدرسة كبيرة</span>
          <strong>حتى 100 معلم</strong>
        </div>
      </section>

      {showVerify && <VerifyPanel initial={verifySeed} />}
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">ح</div>
      <div>
        <strong>حذام</strong>
        <small>HADHAM</small>
      </div>
    </div>
  );
}

function Onboarding({
  userName,
  onDone,
  onSignOut,
}: {
  userName: string;
  onDone: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [type, setType] = useState<'school' | 'individual' | null>(null);
  const [fullName, setFullName] = useState(userName);
  const [school, setSchool] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/onboarding', {
        accountType: type,
        fullName,
        organizationName: type === 'school' ? school : fullName,
      });
      await onDone();
    } catch (err: unknown) {
      setErrorText(err instanceof Error ? err.message : 'تعذر إعداد الحساب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <Card className="onboard-card">
        <Brand />
        <h1>مرحبًا بك في حذام</h1>
        <p>
          اختر نوع الاشتراك. يمكن لمدير المدرسة إدارة مجموعة من المعلمين، بينما
          الحساب الفردي لشخص واحد.
        </p>
        <div className="account-types">
          <button
            className={type === 'school' ? 'type-card active' : 'type-card'}
            onClick={() => setType('school')}
          >
            <Users />
            <strong>مدير مدرسة</strong>
            <span>مالك الاشتراك + المعلمون</span>
          </button>
          <button
            className={type === 'individual' ? 'type-card active' : 'type-card'}
            onClick={() => setType('individual')}
          >
            <PenLine />
            <strong>مشترك فردي</strong>
            <span>حساب لشخص واحد فقط</span>
          </button>
        </div>
        {type && (
          <div className="form-stack">
            <label>
              الاسم الكامل
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </label>
            {type === 'school' && (
              <label>
                اسم المدرسة
                <input
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                  placeholder="مثال: ابتدائية ..."
                />
              </label>
            )}
            {errorText && <div className="notice error">{errorText}</div>}
            <Button
              disabled={busy || !fullName || (type === 'school' && !school)}
              onClick={submit}
            >
              {busy ? 'جارٍ الحفظ…' : 'إنشاء الحساب'}
            </Button>
          </div>
        )}
        <button className="text-link muted" onClick={onSignOut}>
          تسجيل الخروج
        </button>
      </Card>
    </div>
  );
}

function Workspace({
  me,
  onSignOut,
}: {
  me: MeData;
  onSignOut: () => Promise<void>;
}) {
  const [page, setPage] = useState<
    'dashboard' | 'documents' | 'new' | 'members' | 'storage' | 'verify'
  >('dashboard');
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const profile = me.profile!;
  const org = me.org!;
  const owner = profile.role === 'owner';

  const loadDocuments = async () => {
    const res = await api.get('/api/documents');
    setDocuments(res.data.documents as DocSummary[]);
  };

  const loadMembers = async () => {
    if (!owner || profile.accountType !== 'school') return;
    const res = await api.get('/api/members');
    setMembers(res.data.members as Member[]);
  };

  useEffect(() => {
    loadDocuments().catch(() => undefined);
    loadMembers().catch(() => undefined);
  }, []);

  if (selected) {
    return (
      <DocumentView
        docId={selected}
        me={me}
        onBack={() => {
          setSelected(null);
          loadDocuments().catch(() => undefined);
        }}
      />
    );
  }

  const nav = [
    { key: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
    { key: 'documents', label: owner ? 'المستندات' : 'مستنداتي', icon: Files },
    ...(owner ? [{ key: 'new', label: 'معاملة جديدة', icon: FilePlus2 }] : []),
    ...(owner && profile.accountType === 'school'
      ? [{ key: 'members', label: 'المعلمون', icon: Users }]
      : []),
    { key: 'storage', label: 'التخزين والأرشفة', icon: Cloud },
    { key: 'verify', label: 'التحقق', icon: ShieldCheck },
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="org-chip">
          <span>{org.name}</span>
          <small>{profile.role === 'owner' ? 'مالك الاشتراك' : 'عضو'}</small>
        </div>
        <nav>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={page === item.key ? 'nav-item active' : 'nav-item'}
                onClick={() => setPage(item.key)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="nav-item signout" onClick={onSignOut}>
          <LogOut size={19} /> تسجيل الخروج
        </button>
      </aside>
      <main className="workspace">
        <header className="workspace-head">
          <div>
            <span className="eyebrow">حذام · {org.name}</span>
            <h1>{nav.find(n => n.key === page)?.label}</h1>
          </div>
          <div className="avatar">{profile.name.slice(0, 1)}</div>
        </header>

        {page === 'dashboard' && (
          <Dashboard
            documents={documents}
            members={members}
            owner={owner}
            onOpen={setSelected}
          />
        )}
        {page === 'documents' && (
          <Documents documents={documents} onOpen={setSelected} />
        )}
        {page === 'new' && owner && (
          <NewDocument
            me={me}
            members={members}
            onCreated={async id => {
              await loadDocuments();
              setSelected(id);
            }}
          />
        )}
        {page === 'members' && owner && profile.accountType === 'school' && (
          <Members members={members} onChanged={loadMembers} />
        )}
        {page === 'storage' && <StoragePanel />}
        {page === 'verify' && <VerifyPanel initial={{ code: '', token: '' }} />}
      </main>
    </div>
  );
}

function Dashboard({
  documents,
  members,
  owner,
  onOpen,
}: {
  documents: DocSummary[];
  members: Member[];
  owner: boolean;
  onOpen: (id: string) => void;
}) {
  const completed = documents.filter(d => d.status === 'completed').length;
  const pending = documents.filter(
    d => d.status === 'awaiting_signatures'
  ).length;
  const overdue = documents.filter(
    d =>
      d.status === 'awaiting_signatures' &&
      d.dueDate &&
      new Date(d.dueDate) < new Date()
  ).length;
  return (
    <>
      <div className="metric-grid">
        <Card>
          <span>إجمالي المستندات</span>
          <strong>{documents.length}</strong>
          <Files />
        </Card>
        <Card>
          <span>بانتظار التوقيع</span>
          <strong>{pending}</strong>
          <PenLine />
        </Card>
        <Card>
          <span>مكتملة</span>
          <strong>{completed}</strong>
          <CheckCircle2 />
        </Card>
        <Card>
          <span>{owner ? 'المعلمون النشطون' : 'المتأخرة'}</span>
          <strong>
            {owner
              ? members.filter(m => m.status === 'active').length
              : overdue}
          </strong>
          <Users />
        </Card>
      </div>
      <Card>
        <div className="section-title">
          <div>
            <span className="eyebrow">آخر النشاط</span>
            <h2>أحدث المعاملات</h2>
          </div>
        </div>
        <DocumentTable documents={documents.slice(0, 7)} onOpen={onOpen} />
      </Card>
    </>
  );
}

function Documents({
  documents,
  onOpen,
}: {
  documents: DocSummary[];
  onOpen: (id: string) => void;
}) {
  return (
    <Card>
      <div className="section-title">
        <h2>جميع المستندات</h2>
        <span>{documents.length} مستند</span>
      </div>
      <DocumentTable documents={documents} onOpen={onOpen} />
    </Card>
  );
}

function DocumentTable({
  documents,
  onOpen,
}: {
  documents: DocSummary[];
  onOpen: (id: string) => void;
}) {
  if (!documents.length)
    return (
      <div className="empty">
        <Files />
        <strong>لا توجد مستندات بعد</strong>
        <span>ستظهر المعاملات هنا عند إنشائها أو إسنادها إليك.</span>
      </div>
    );
  return (
    <div className="doc-list">
      {documents.map(doc => (
        <button
          className="doc-row"
          key={doc.docId}
          onClick={() => onOpen(doc.docId)}
        >
          <div className="doc-icon">
            <FileCheck2 />
          </div>
          <div className="doc-main">
            <strong>{doc.title}</strong>
            <span>
              {doc.code} · {doc.category}
            </span>
          </div>
          <div className="progress-mini">
            <span>
              {doc.signersCompleted}/{doc.signersTotal}
            </span>
            <div>
              <i
                style={{
                  width: `${doc.signersTotal ? (doc.signersCompleted / doc.signersTotal) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <span className={`status status-${doc.status}`}>
            {statusLabel[doc.status]}
          </span>
        </button>
      ))}
    </div>
  );
}

function Members({
  members,
  onChanged,
}: {
  members: Member[];
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const add = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await api.post('/api/members', form);
      setNotice(
        res.data.alreadyExists
          ? 'المعلم موجود مسبقًا.'
          : 'تمت إضافة المعلم. سيُفعّل تلقائيًا عند تسجيل الدخول بنفس البريد.'
      );
      setForm({ name: '', email: '' });
      await onChanged();
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'تعذر إضافة المعلم');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="two-col">
      <Card>
        <div className="section-title">
          <h2>إضافة معلم</h2>
          <UserPlus />
        </div>
        <div className="form-stack">
          <label>
            اسم المعلم
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              dir="ltr"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <Button disabled={busy || !form.name || !form.email} onClick={add}>
            {busy ? 'جارٍ الإضافة…' : 'إضافة المعلم'}
          </Button>
          {notice && <div className="notice">{notice}</div>}
        </div>
      </Card>
      <Card>
        <div className="section-title">
          <h2>المعلمون</h2>
          <span>{members.length}</span>
        </div>
        <div className="member-list">
          {members.map(m => (
            <div className="member-row" key={m.id}>
              <div className="avatar small">{m.name.slice(0, 1)}</div>
              <div>
                <strong>{m.name}</strong>
                <span dir="ltr">{m.email}</span>
              </div>
              <span
                className={
                  m.status === 'active' ? 'member-state active' : 'member-state'
                }
              >
                {m.status === 'active' ? 'نشط' : 'بانتظار الدخول'}
              </span>
            </div>
          ))}
          {!members.length && (
            <div className="empty compact">لم تتم إضافة معلمين بعد.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function NewDocument({
  me,
  members,
  onCreated,
}: {
  me: MeData;
  members: Member[];
  onCreated: (id: string) => Promise<void>;
}) {
  const owner = me.profile!;
  const candidates = useMemo(
    () => [
      { email: owner.email, name: owner.name, status: 'active' },
      ...members,
    ],
    [owner.email, owner.name, members]
  );
  const [form, setForm] = useState({
    title: '',
    category: 'تعميم',
    description: '',
    dueDate: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<
    Record<string, { name: string; action: 'sign' | 'approve' | 'acknowledge' }>
  >({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const toggle = (email: string, name: string) => {
    const copy = { ...selected };
    if (copy[email]) delete copy[email];
    else copy[email] = { name, action: 'sign' };
    setSelected(copy);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setNotice('');
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error('الحد الحالي للملف 3 MB.');
      const pdfBase64 = await readFileBase64(file);
      const signers = Object.entries(selected).map(([email, value]) => ({
        email,
        name: value.name,
        action: value.action,
      }));
      const res = await api.post('/api/documents', {
        ...form,
        fileName: file.name,
        pdfBase64,
        signers,
      });
      await onCreated(res.data.document.docId as string);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'تعذر إنشاء المعاملة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="new-doc-grid">
      <Card>
        <div className="section-title">
          <h2>بيانات المعاملة</h2>
          <FilePlus2 />
        </div>
        <div className="form-stack">
          <label>
            عنوان المستند
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <div className="form-row">
            <label>
              التصنيف
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                <option>تعميم</option>
                <option>قرار</option>
                <option>محضر</option>
                <option>إقرار</option>
                <option>نموذج</option>
                <option>أخرى</option>
              </select>
            </label>
            <label>
              تاريخ الاستحقاق
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
          </div>
          <label>
            وصف اختياري
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            ملف PDF
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <small className="helper">
            نسخة المعاينة الحالية تقبل ملفات PDF حتى 3 MB.
          </small>
        </div>
      </Card>
      <Card>
        <div className="section-title">
          <h2>الأطراف بالترتيب</h2>
          <span>{Object.keys(selected).length} محدد</span>
        </div>
        <div className="signer-picker">
          {candidates.map(person => {
            const checked = Boolean(selected[person.email]);
            return (
              <div
                className={checked ? 'picker-row selected' : 'picker-row'}
                key={person.email}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(person.email, person.name)}
                />
                <div>
                  <strong>{person.name}</strong>
                  <span dir="ltr">{person.email}</span>
                </div>
                {checked && (
                  <select
                    value={selected[person.email].action}
                    onChange={e =>
                      setSelected({
                        ...selected,
                        [person.email]: {
                          ...selected[person.email],
                          action: e.target.value as
                            | 'sign'
                            | 'approve'
                            | 'acknowledge',
                        },
                      })
                    }
                  >
                    <option value="sign">توقيع</option>
                    <option value="approve">اعتماد</option>
                    <option value="acknowledge">إقرار بالاطلاع</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
        {notice && <div className="notice error">{notice}</div>}
        <Button
          className="wide"
          disabled={
            busy || !form.title || !file || !Object.keys(selected).length
          }
          onClick={submit}
        >
          {busy ? 'جارٍ إنشاء المعاملة…' : 'إنشاء وإرسال'}
        </Button>
      </Card>
    </div>
  );
}

function DocumentView({
  docId,
  me,
  onBack,
}: {
  docId: string;
  me: MeData;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [nextSignerEmail, setNextSignerEmail] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<Array<Record<string, unknown>>>(
    []
  );
  const [showAudit, setShowAudit] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [signaturePayload, setSignaturePayload] = useState<SignaturePlacementPayload | null>(null);

  const load = async () => {
    const res = await api.get(`/api/documents/${docId}`);
    setDoc(res.data.document as DocumentDetail);
    setFileUrl(res.data.fileUrl as string);
    setNextSignerEmail(res.data.nextSignerEmail as string | null);
    setPageCount(Number(res.data.pageCount || 1));
    setBusy(false);
  };

  useEffect(() => {
    load().catch(() => {
      setNotice('تعذر فتح المستند');
      setBusy(false);
    });
  }, [docId]);

  const act = async () => {
    if (!doc) return;
    const mine = doc.signers.find(
      s => s.email.toLowerCase() === me.profile!.email.toLowerCase()
    );
    if (mine?.action === 'sign' && !signaturePayload) {
      setNotice('ارسم توقيعك أو ارفع صورة التوقيع وحدد مكانه قبل التأكيد.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const payload = mine?.action === 'sign' ? signaturePayload : {};
      await api.post(`/api/documents/${doc.docId}/act`, payload);
      setSignaturePayload(null);
      await load();
      setNotice('تم تسجيل الإجراء بنجاح.');
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء');
      setBusy(false);
    }
  };

  const loadAudit = async () => {
    const res = await api.get(`/api/documents/${docId}/audit`);
    setAuditRows(res.data.audit as Array<Record<string, unknown>>);
    setShowAudit(true);
  };

  if (busy && !doc)
    return (
      <div className="center-screen">
        <div className="loader" />
      </div>
    );
  if (!doc)
    return (
      <div className="workspace">
        <Button tone="ghost" onClick={onBack}>
          عودة
        </Button>
        <div className="notice error">{notice}</div>
      </div>
    );

  const mine = doc.signers.find(
    s => s.email.toLowerCase() === me.profile!.email.toLowerCase()
  );
  const canAct =
    mine?.status === 'pending' &&
    nextSignerEmail?.toLowerCase() === me.profile!.email.toLowerCase();
  const verifyUrl = `${window.location.origin}${window.location.pathname}#verify?code=${encodeURIComponent(doc.code)}&token=${encodeURIComponent(doc.verificationToken)}`;

  return (
    <div className="workspace document-screen">
      <header className="detail-head">
        <Button tone="ghost" onClick={onBack}>
          ← رجوع
        </Button>
        <div className="detail-title">
          <span className="eyebrow">{doc.code}</span>
          <h1>{doc.title}</h1>
          <span className={`status status-${doc.status}`}>
            {statusLabel[doc.status]}
          </span>
        </div>
        <Button tone="ghost" onClick={loadAudit}>
          سجل التدقيق
        </Button>
      </header>

      <div className="document-layout">
        <div className="pdf-panel">
          {fileUrl ? (
            <iframe title="معاينة المستند" src={fileUrl} />
          ) : (
            <div className="empty">تعذر إنشاء رابط المعاينة.</div>
          )}
        </div>
        <div className="detail-side">
          <Card>
            <span className="eyebrow">مسار الاعتماد</span>
            <div className="timeline">
              {doc.signers.map(s => (
                <div
                  className={
                    s.status === 'completed' ? 'time-row done' : 'time-row'
                  }
                  key={s.email}
                >
                  <div className="time-dot">
                    {s.status === 'completed' ? '✓' : s.order}
                  </div>
                  <div>
                    <strong>{s.name}</strong>
                    <span>
                      {actionLabel[s.action]} ·{' '}
                      {s.status === 'completed'
                        ? formatDate(s.actedAt)
                        : 'بانتظار الدور'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {canAct && (
            <Card className="action-card">
              <h3>
                {mine?.action === 'sign'
                  ? 'وقّع المستند'
                  : mine?.action === 'approve'
                    ? 'اعتماد المستند'
                    : 'الإقرار بالاطلاع'}
              </h3>
              {mine?.action === 'sign' && (
                <SignatureEditor
                  pageCount={pageCount}
                  onChange={setSignaturePayload}
                />
              )}
              <Button className="wide" disabled={busy} onClick={act}>
                {busy ? 'جارٍ الحفظ…' : 'تأكيد الإجراء'}
              </Button>
            </Card>
          )}

          {!canAct && mine?.status === 'pending' && (
            <div className="notice">
              المستند بانتظار الطرف السابق في التسلسل.
            </div>
          )}
          {mine?.status === 'completed' && (
            <div className="notice success">اكتمل الإجراء المطلوب منك.</div>
          )}
          {notice && <div className="notice">{notice}</div>}

          <Card>
            <span className="eyebrow">التحقق</span>
            <div className="hash-box">
              <small>SHA-256 للأصل</small>
              <code>{doc.originalHash}</code>
            </div>
            {doc.finalHash && (
              <div className="hash-box">
                <small>SHA-256 للنسخة النهائية</small>
                <code>{doc.finalHash}</code>
              </div>
            )}
            <Button
              tone="ghost"
              className="wide"
              onClick={() => navigator.clipboard.writeText(verifyUrl)}
            >
              نسخ رابط التحقق
            </Button>
          </Card>
        </div>
      </div>

      {showAudit && (
        <div className="modal-backdrop" onClick={() => setShowAudit(false)}>
          <Card className="modal" onClick={e => e.stopPropagation()}>
            <div className="section-title">
              <h2>سجل التدقيق</h2>
              <button className="text-link" onClick={() => setShowAudit(false)}>
                إغلاق
              </button>
            </div>
            <div className="audit-list">
              {auditRows.map(row => (
                <div key={String(row.id)}>
                  <strong>{String(row.detail || row.event)}</strong>
                  <span>
                    {String(row.actorEmail || '')} ·{' '}
                    {formatDate(String(row.at || ''))}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StoragePanel() {
  const [data, setData] = useState<{
    provider?: string;
    state?: string;
    targetPattern?: string;
    note?: string;
  } | null>(null);
  useEffect(() => {
    api
      .get('/api/storage-connection')
      .then(res => setData(res.data))
      .catch(() => undefined);
  }, []);
  return (
    <div className="two-col">
      <Card className="storage-hero">
        <div className="cloud-mark">
          <Cloud />
        </div>
        <span className="eyebrow">التخزين الدائم</span>
        <h2>OneDrive الخاص بالمشترك</h2>
        <p>
          حذام مصمم بحيث لا تتحول مساحة المنصة إلى أرشيف دائم. الأصل والنسخة
          النهائية سينتقلان إلى حساب المشترك بعد اكتمال الربط.
        </p>
        <span className="status-pill warning">
          يحتاج تسجيل تطبيق Microsoft Entra
        </span>
      </Card>
      <Card>
        <h3>المسار المقترح</h3>
        <pre className="folder-tree">
          حذام └── السنة └── نوع المستند └── رقم المعاملة ├── original.pdf └──
          signed-final.pdf
        </pre>
        <div className="notice">{data?.note || 'جاري قراءة حالة الاتصال…'}</div>
      </Card>
    </div>
  );
}

function VerifyPanel({
  initial,
}: {
  initial: { code: string; token: string };
}) {
  const [code, setCode] = useState(initial.code);
  const [token, setToken] = useState(initial.token);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState('');
  const verify = async () => {
    setNotice('');
    setResult(null);
    try {
      const res = await api.get(
        `/api/verify?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`
      );
      setResult(res.data.document as Record<string, unknown>);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'تعذر التحقق');
    }
  };
  return (
    <Card className="verify-card">
      <div className="section-title">
        <div>
          <span className="eyebrow">تحقق عام</span>
          <h2>التحقق من مستند حذام</h2>
        </div>
        <ShieldCheck />
      </div>
      <div className="verify-form">
        <label>
          رقم المستند
          <input
            dir="ltr"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="HDM-2026-000000"
          />
        </label>
        <label>
          رمز التحقق
          <input
            dir="ltr"
            value={token}
            onChange={e => setToken(e.target.value)}
          />
        </label>
        <Button disabled={!code || !token} onClick={verify}>
          تحقق
        </Button>
      </div>
      {notice && <div className="notice error">{notice}</div>}
      {result && (
        <div className="verification-result">
          <div className="verified-icon">
            <ShieldCheck />
          </div>
          <div>
            <span className="eyebrow">تم العثور على المستند</span>
            <h3>{String(result.title)}</h3>
            <p>
              {String(result.code)} ·{' '}
              {statusLabel[String(result.status)] || String(result.status)}
            </p>
          </div>
          <div className="hash-box full">
            <small>البصمة النهائية</small>
            <code>{String(result.finalHash || result.originalHash || '')}</code>
          </div>
        </div>
      )}
    </Card>
  );
}

export default App;
