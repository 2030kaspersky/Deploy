import { db, error, json, requireAuth, router, storage } from '@appdeploy/sdk';
import { PDFDocument } from 'pdf-lib';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

type Profile = {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  role: 'owner' | 'member';
  accountType: 'school' | 'individual';
};

type Organization = {
  orgId: string;
  type: 'school' | 'individual';
  name: string;
  ownerUserId: string;
  ownerEmail: string;
  createdAt: string;
  storageProvider: 'onedrive';
  storageState: 'not_connected';
};

type Membership = {
  orgId: string;
  email: string;
  name: string;
  role: 'member';
  status: 'invited' | 'active' | 'disabled';
  invitedBy: string;
  invitedAt: string;
  userId?: string;
  memberRecordId?: string;
};

type Signer = {
  email: string;
  name: string;
  action: 'sign' | 'approve' | 'acknowledge';
  order: number;
  status: 'pending' | 'completed';
  actedAt?: string;
  userId?: string;
};

type DocumentRecord = {
  docId: string;
  orgId: string;
  code: string;
  title: string;
  category: string;
  description: string;
  dueDate: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  status: 'awaiting_signatures' | 'completed' | 'archived';
  signers: Signer[];
  originalPath: string;
  workingPath: string;
  finalPath: string;
  originalHash: string;
  workingHash: string;
  finalHash?: string;
  completedAt?: string;
  verificationToken: string;
  verificationTokenHash: string;
  summaryRecordId: string;
  storageState: 'platform_temporary' | 'awaiting_subscriber_storage';
};

type DocumentSummary = {
  docId: string;
  code: string;
  title: string;
  category: string;
  dueDate: string;
  createdAt: string;
  status: DocumentRecord['status'];
  signerEmails: string[];
  signersTotal: number;
  signersCompleted: number;
};

const iso = () => new Date().toISOString();
const norm = (value: string) => value.trim().toLowerCase();
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const emailTable = (email: string) => `membership-email:${hash(norm(email))}`;

async function singleton<T>(
  table: string
): Promise<(T & { id: string }) | null> {
  const { items } = await db.list<T>(table, { limit: 1 });
  return items[0] ?? null;
}

async function saveSingleton(table: string, record: Record<string, unknown>) {
  const current = await singleton<Record<string, unknown>>(table);
  if (current) {
    const { id } = current;
    const [ok] = await db.update(table, [{ id, record }]);
    if (!ok) throw new Error('تعذر تحديث البيانات');
    return id;
  }
  const [id] = await db.add(table, [record]);
  if (!id) throw new Error('تعذر حفظ البيانات');
  return id;
}

async function getOrg(orgId: string) {
  return singleton<Organization>(`org:${orgId}`);
}

async function activateInvitation(
  userId: string,
  email: string,
  displayName: string
) {
  const invite = await singleton<Membership>(emailTable(email));
  if (!invite || invite.status === 'disabled') return null;
  const activated: Membership = {
    ...invite,
    userId,
    status: 'active',
  };
  const indexId = invite.id;
  const { id: _removed, ...indexRecord } = activated as Membership & {
    id?: string;
  };
  await db.update(emailTable(email), [
    { id: indexId, record: indexRecord as unknown as Record<string, unknown> },
  ]);

  if (invite.memberRecordId) {
    const [member] = await db.get<Membership>(`members:${invite.orgId}`, [
      invite.memberRecordId,
    ]);
    if (member) {
      await db.update(`members:${invite.orgId}`, [
        {
          id: invite.memberRecordId,
          record: { ...member, status: 'active', userId } as unknown as Record<
            string,
            unknown
          >,
        },
      ]);
    }
  }

  const profile: Profile = {
    userId,
    email: norm(email),
    name: displayName || invite.name,
    orgId: invite.orgId,
    role: 'member',
    accountType: 'school',
  };
  await saveSingleton(
    `profile:${userId}`,
    profile as unknown as Record<string, unknown>
  );
  return profile;
}

async function resolveProfile(userId: string, email?: string, name?: string) {
  let profile = await singleton<Profile>(`profile:${userId}`);
  if (!profile && email) {
    const activated = await activateInvitation(userId, email, name || '');
    if (activated) profile = { ...activated, id: 'virtual' };
  }
  return profile;
}

async function audit(
  docId: string,
  orgId: string,
  actorEmail: string,
  event: string,
  detail: string
) {
  await db.add(`audit:${docId}`, [
    {
      docId,
      orgId,
      actorEmail,
      event,
      detail,
      at: iso(),
    },
  ]);
}

async function newCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = `HDM-${new Date().getFullYear()}-${randomInt(100000, 1000000)}`;
    const existing = await singleton<Record<string, unknown>>(
      `verify-code:${hash(code)}`
    );
    if (!existing) return code;
  }
  return `HDM-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function summarize(doc: DocumentRecord): DocumentSummary {
  return {
    docId: doc.docId,
    code: doc.code,
    title: doc.title,
    category: doc.category,
    dueDate: doc.dueDate,
    createdAt: doc.createdAt,
    status: doc.status,
    signerEmails: doc.signers.map(s => norm(s.email)),
    signersTotal: doc.signers.length,
    signersCompleted: doc.signers.filter(s => s.status === 'completed').length,
  };
}

async function updateSummary(doc: DocumentRecord) {
  const [current] = await db.get<DocumentSummary>(`docs:${doc.orgId}`, [
    doc.summaryRecordId,
  ]);
  if (!current) return;
  await db.update(`docs:${doc.orgId}`, [
    {
      id: doc.summaryRecordId,
      record: summarize(doc) as unknown as Record<string, unknown>,
    },
  ]);
}

async function canAccess(profile: Profile, doc: DocumentRecord) {
  if (profile.orgId !== doc.orgId) return false;
  if (profile.role === 'owner') return true;
  return doc.signers.some(s => norm(s.email) === norm(profile.email));
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ ok: true, service: 'hadham' })],

  'GET /api/me': [
    requireAuth(),
    async ctx => {
      const email = norm(ctx.user?.email || '');
      const profile = await resolveProfile(
        ctx.user!.userId,
        email,
        ctx.user?.name
      );
      if (!profile)
        return json({ onboarded: false, email, name: ctx.user?.name || '' });
      const org = await getOrg(profile.orgId);
      return json({
        onboarded: true,
        profile: {
          userId: profile.userId,
          email: profile.email,
          name: profile.name,
          orgId: profile.orgId,
          role: profile.role,
          accountType: profile.accountType,
        },
        org,
      });
    },
  ],

  'POST /api/onboarding': [
    requireAuth(),
    async ctx => {
      const body = ctx.body as {
        accountType?: string;
        organizationName?: string;
        fullName?: string;
      };
      const existing = await singleton<Profile>(`profile:${ctx.user!.userId}`);
      if (existing) return error('الحساب مهيأ مسبقًا', 409);
      if (body.accountType !== 'school' && body.accountType !== 'individual') {
        return error('نوع الاشتراك غير صحيح', 400);
      }
      const email = norm(ctx.user!.email || '');
      if (!email) return error('يجب منح صلاحية البريد الإلكتروني', 400);
      const fullName = (body.fullName || ctx.user!.name || email).trim();
      const organizationName =
        body.accountType === 'school'
          ? (body.organizationName || '').trim()
          : fullName;
      if (!organizationName) return error('اسم المدرسة مطلوب', 400);

      const orgId = randomUUID();
      const org: Organization = {
        orgId,
        type: body.accountType,
        name: organizationName,
        ownerUserId: ctx.user!.userId,
        ownerEmail: email,
        createdAt: iso(),
        storageProvider: 'onedrive',
        storageState: 'not_connected',
      };
      const profile: Profile = {
        userId: ctx.user!.userId,
        email,
        name: fullName,
        orgId,
        role: 'owner',
        accountType: body.accountType,
      };
      await saveSingleton(
        `org:${orgId}`,
        org as unknown as Record<string, unknown>
      );
      await saveSingleton(
        `profile:${profile.userId}`,
        profile as unknown as Record<string, unknown>
      );
      return json({ ok: true, profile, org }, 201);
    },
  ],

  'GET /api/members': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (
        !profile ||
        profile.role !== 'owner' ||
        profile.accountType !== 'school'
      )
        return error('غير مصرح', 403);
      const { items } = await db.list<Membership>(`members:${profile.orgId}`, {
        limit: 150,
      });
      return json({ members: items });
    },
  ],

  'POST /api/members': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (
        !profile ||
        profile.role !== 'owner' ||
        profile.accountType !== 'school'
      )
        return error('غير مصرح', 403);
      const body = ctx.body as { email?: string; name?: string };
      const email = norm(body.email || '');
      const name = (body.name || '').trim();
      if (!email.includes('@') || !name)
        return error('الاسم والبريد مطلوبان', 400);
      if (email === profile.email) return error('هذا بريد مالك الاشتراك', 400);
      const exists = await singleton<Membership>(emailTable(email));
      if (exists && exists.orgId !== profile.orgId)
        return error('البريد مرتبط بجهة أخرى', 409);

      if (exists && exists.orgId === profile.orgId) {
        return json({ ok: true, member: exists, alreadyExists: true });
      }

      const member: Membership = {
        orgId: profile.orgId,
        email,
        name,
        role: 'member',
        status: 'invited',
        invitedBy: profile.userId,
        invitedAt: iso(),
      };
      const [memberId] = await db.add(`members:${profile.orgId}`, [
        member as unknown as Record<string, unknown>,
      ]);
      if (!memberId) return error('تعذر إضافة المعلم', 500);
      member.memberRecordId = memberId;
      await saveSingleton(
        emailTable(email),
        member as unknown as Record<string, unknown>
      );
      return json({ ok: true, member: { ...member, id: memberId } }, 201);
    },
  ],

  'GET /api/documents': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile) return error('أكمل إعداد الحساب', 403);
      const { items } = await db.list<DocumentSummary>(
        `docs:${profile.orgId}`,
        { limit: 200 }
      );
      const visible =
        profile.role === 'owner'
          ? items
          : items.filter(d => d.signerEmails.includes(norm(profile.email)));
      visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ documents: visible });
    },
  ],

  'POST /api/documents': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile || profile.role !== 'owner')
        return error('إنشاء المعاملات متاح لمالك الاشتراك', 403);
      const body = ctx.body as {
        title?: string;
        category?: string;
        description?: string;
        dueDate?: string;
        fileName?: string;
        pdfBase64?: string;
        signers?: Array<{
          email: string;
          name: string;
          action: Signer['action'];
        }>;
      };
      const title = (body.title || '').trim();
      const pdfBase64 = body.pdfBase64 || '';
      const signersInput = body.signers || [];
      if (!title || !body.category || !body.fileName || !pdfBase64)
        return error('بيانات المستند غير مكتملة', 400);
      if (signersInput.length < 1)
        return error('حدد طرفًا واحدًا على الأقل', 400);

      const pdfBytes = Buffer.from(pdfBase64, 'base64');
      if (pdfBytes.length > 3 * 1024 * 1024)
        return error('الحد الحالي للملف 3 MB', 413);
      if (pdfBytes.subarray(0, 4).toString() !== '%PDF')
        return error('يجب رفع ملف PDF صحيح', 400);

      const members =
        profile.accountType === 'school'
          ? (
              await db.list<Membership>(`members:${profile.orgId}`, {
                limit: 150,
              })
            ).items
          : [];
      const allowed = new Map<string, string>();
      allowed.set(norm(profile.email), profile.name);
      members.forEach(m => allowed.set(norm(m.email), m.name));

      const signers: Signer[] = [];
      for (let index = 0; index < signersInput.length; index += 1) {
        const item = signersInput[index];
        const email = norm(item.email);
        if (!allowed.has(email))
          return error(`الموقّع ${email} غير تابع للاشتراك`, 400);
        if (!['sign', 'approve', 'acknowledge'].includes(item.action))
          return error('نوع الإجراء غير صحيح', 400);
        signers.push({
          email,
          name: item.name || allowed.get(email) || email,
          action: item.action,
          order: index + 1,
          status: 'pending',
        });
      }

      const docId = randomUUID();
      const code = await newCode();
      const verificationToken = randomBytes(18).toString('hex');
      const basePath = `documents/${profile.orgId}/${docId}`;
      const originalPath = `${basePath}/original.pdf`;
      const workingPath = `${basePath}/working.pdf`;
      const finalPath = `${basePath}/signed-final.pdf`;
      const [originalOk, workingOk] = await storage.write([
        {
          path: originalPath,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
        {
          path: workingPath,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
      ]);
      if (!originalOk || !workingOk) return error('تعذر حفظ نسخة العمل', 500);

      const draft: DocumentRecord = {
        docId,
        orgId: profile.orgId,
        code,
        title,
        category: body.category,
        description: (body.description || '').trim(),
        dueDate: body.dueDate || '',
        fileName: body.fileName,
        createdAt: iso(),
        createdBy: profile.userId,
        status: 'awaiting_signatures',
        signers,
        originalPath,
        workingPath,
        finalPath,
        originalHash: hash(pdfBytes),
        workingHash: hash(pdfBytes),
        verificationToken,
        verificationTokenHash: hash(verificationToken),
        summaryRecordId: '',
        storageState: 'platform_temporary',
      };

      const [summaryRecordId] = await db.add(`docs:${profile.orgId}`, [
        summarize(draft) as unknown as Record<string, unknown>,
      ]);
      if (!summaryRecordId) return error('تعذر إنشاء فهرس المستند', 500);
      draft.summaryRecordId = summaryRecordId;
      await saveSingleton(
        `doc:${docId}`,
        draft as unknown as Record<string, unknown>
      );
      await saveSingleton(`verify-code:${hash(code)}`, {
        docId,
        tokenHash: draft.verificationTokenHash,
      });
      await audit(
        docId,
        profile.orgId,
        profile.email,
        'created',
        'تم إنشاء المعاملة وإرسالها لمسار التوقيع'
      );
      return json({ ok: true, document: draft }, 201);
    },
  ],

  'GET /api/documents/:id': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile) return error('غير مصرح', 403);
      const doc = await singleton<DocumentRecord>(`doc:${ctx.params.id}`);
      if (!doc || !(await canAccess(profile, doc)))
        return error('المستند غير موجود', 404);
      const path = doc.status === 'completed' ? doc.finalPath : doc.workingPath;
      const [signed] = await storage.url([path]);
      let pageCount = 1;
      const [storedPdf] = await storage.read([path]);
      if (storedPdf?.content) {
        try {
          const pdf = await PDFDocument.load(Buffer.from(storedPdf.content, 'base64'));
          pageCount = Math.max(1, pdf.getPageCount());
        } catch {
          pageCount = 1;
        }
      }
      const nextSigner = doc.signers
        .filter(s => s.status === 'pending')
        .sort((a, b) => a.order - b.order)[0];
      return json({
        document: doc,
        fileUrl: signed?.url || '',
        nextSignerEmail: nextSigner?.email || null,
        pageCount,
      });
    },
  ],

  'GET /api/documents/:id/audit': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile) return error('غير مصرح', 403);
      const doc = await singleton<DocumentRecord>(`doc:${ctx.params.id}`);
      if (!doc || !(await canAccess(profile, doc)))
        return error('المستند غير موجود', 404);
      const { items } = await db.list<Record<string, unknown>>(
        `audit:${doc.docId}`,
        { limit: 200 }
      );
      items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      return json({ audit: items });
    },
  ],

  'POST /api/documents/:id/act': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile) return error('غير مصرح', 403);
      const docRow = await singleton<DocumentRecord>(`doc:${ctx.params.id}`);
      if (!docRow || !(await canAccess(profile, docRow)))
        return error('المستند غير موجود', 404);
      const doc: DocumentRecord = { ...docRow };
      const pending = doc.signers
        .filter(s => s.status === 'pending')
        .sort((a, b) => a.order - b.order);
      const next = pending[0];
      if (!next) return error('المعاملة مكتملة بالفعل', 409);
      if (norm(next.email) !== norm(profile.email))
        return error('الدور الحالي لموقّع آخر', 409);

      const body = ctx.body as {
        signatureDataUrl?: string;
        pageNumber?: number;
        position?:
          | 'top-right'
          | 'top-center'
          | 'top-left'
          | 'middle-right'
          | 'middle-center'
          | 'middle-left'
          | 'bottom-right'
          | 'bottom-center'
          | 'bottom-left';
        width?: number;
        color?: string;
        source?: 'draw' | 'image';
      };
      let nextPdf = '';
      let signatureAudit = '';
      const [working] = await storage.read([doc.workingPath]);
      if (!working?.content) return error('تعذر قراءة نسخة العمل', 500);
      nextPdf = working.content;

      if (next.action === 'sign') {
        const dataUrl = body.signatureDataUrl || '';
        const marker = 'data:image/png;base64,';
        if (!dataUrl.startsWith(marker))
          return error('ارسم توقيعك أو ارفع صورة التوقيع أولًا', 400);
        const signatureBase64 = dataUrl.slice(marker.length);
        if (signatureBase64.length > 2_500_000)
          return error('صورة التوقيع أكبر من الحد المسموح', 413);

        const pdf = await PDFDocument.load(
          Buffer.from(working.content, 'base64')
        );
        const png = await pdf.embedPng(Buffer.from(signatureBase64, 'base64'));
        const pages = pdf.getPages();
        const requestedPage = Number(body.pageNumber ?? pages.length);
        if (
          !Number.isInteger(requestedPage) ||
          requestedPage < 1 ||
          requestedPage > pages.length
        ) {
          return error('رقم صفحة التوقيع غير صحيح', 400);
        }

        const allowedPositions = new Set([
          'top-right',
          'top-center',
          'top-left',
          'middle-right',
          'middle-center',
          'middle-left',
          'bottom-right',
          'bottom-center',
          'bottom-left',
        ]);
        const position = body.position || 'bottom-right';
        if (!allowedPositions.has(position))
          return error('موضع التوقيع غير صحيح', 400);

        const page = pages[requestedPage - 1];
        const margin = 24;
        const maxWidth = Math.min(240, page.getWidth() - margin * 2);
        const requestedWidth = Number(body.width ?? 140);
        if (!Number.isFinite(requestedWidth))
          return error('حجم التوقيع غير صحيح', 400);
        const width = Math.max(70, Math.min(maxWidth, requestedWidth));
        let scaled = png.scale(width / png.width);
        if (scaled.height > page.getHeight() - margin * 2) {
          const heightScale = (page.getHeight() - margin * 2) / png.height;
          scaled = png.scale(heightScale);
        }

        const horizontal = position.endsWith('right')
          ? 'right'
          : position.endsWith('left')
            ? 'left'
            : 'center';
        const vertical = position.startsWith('top')
          ? 'top'
          : position.startsWith('bottom')
            ? 'bottom'
            : 'middle';

        const x =
          horizontal === 'right'
            ? page.getWidth() - scaled.width - margin
            : horizontal === 'left'
              ? margin
              : (page.getWidth() - scaled.width) / 2;
        const y =
          vertical === 'top'
            ? page.getHeight() - scaled.height - margin
            : vertical === 'bottom'
              ? margin
              : (page.getHeight() - scaled.height) / 2;

        page.drawImage(png, {
          x,
          y,
          width: scaled.width,
          height: scaled.height,
        });
        nextPdf = await pdf.saveAsBase64({ dataUri: false });

        const positionLabels: Record<string, string> = {
          'top-right': 'أعلى يمين',
          'top-center': 'أعلى وسط',
          'top-left': 'أعلى يسار',
          'middle-right': 'وسط يمين',
          'middle-center': 'وسط الصفحة',
          'middle-left': 'وسط يسار',
          'bottom-right': 'أسفل يمين',
          'bottom-center': 'أسفل وسط',
          'bottom-left': 'أسفل يسار',
        };
        signatureAudit = ` — الصفحة ${requestedPage}، الموضع ${positionLabels[position]}، الحجم ${Math.round(width)}، المصدر ${body.source === 'image' ? 'صورة مرفوعة' : 'رسم مباشر'}، اللون ${body.color || '#111827'}`;
      }

      doc.signers = doc.signers.map(s =>
        norm(s.email) === norm(profile.email) && s.status === 'pending'
          ? {
              ...s,
              status: 'completed',
              actedAt: iso(),
              userId: profile.userId,
            }
          : s
      );
      doc.workingHash = hash(Buffer.from(nextPdf, 'base64'));
      const [workingOk] = await storage.write([
        {
          path: doc.workingPath,
          content: nextPdf,
          contentType: 'application/pdf',
        },
      ]);
      if (!workingOk) return error('تعذر حفظ التوقيع', 500);

      const completed = doc.signers.every(s => s.status === 'completed');
      if (completed) {
        const [finalOk] = await storage.write([
          {
            path: doc.finalPath,
            content: nextPdf,
            contentType: 'application/pdf',
          },
        ]);
        if (!finalOk) return error('تعذر إنشاء النسخة النهائية', 500);
        doc.status = 'completed';
        doc.finalHash = doc.workingHash;
        doc.completedAt = iso();
        doc.storageState = 'awaiting_subscriber_storage';
      }

      const { id: dbId } = docRow;
      const { id: _discard, ...record } = doc as DocumentRecord & {
        id?: string;
      };
      await db.update(`doc:${doc.docId}`, [
        { id: dbId, record: record as unknown as Record<string, unknown> },
      ]);
      await updateSummary(doc);
      const event =
        next.action === 'sign'
          ? 'signed'
          : next.action === 'approve'
            ? 'approved'
            : 'acknowledged';
      await audit(
        doc.docId,
        doc.orgId,
        profile.email,
        event,
        (completed
          ? 'تم الإجراء واكتملت المعاملة'
          : 'تم الإجراء وانتقلت المعاملة للطرف التالي') + signatureAudit
      );
      return json({ ok: true, completed, document: doc });
    },
  ],

  'GET /api/verify': [
    async ctx => {
      const code = (ctx.query.code || '').trim().toUpperCase();
      const token = (ctx.query.token || '').trim();
      if (!code || !token) return error('أدخل رقم المستند ورمز التحقق', 400);
      const index = await singleton<{ docId: string; tokenHash: string }>(
        `verify-code:${hash(code)}`
      );
      if (!index || index.tokenHash !== hash(token))
        return error('بيانات التحقق غير صحيحة', 404);
      const doc = await singleton<DocumentRecord>(`doc:${index.docId}`);
      if (!doc) return error('المستند غير موجود', 404);
      return json({
        verified: true,
        document: {
          code: doc.code,
          title: doc.title,
          category: doc.category,
          status: doc.status,
          createdAt: doc.createdAt,
          completedAt: doc.completedAt || null,
          originalHash: doc.originalHash,
          finalHash: doc.finalHash || null,
          signers: doc.signers.map(s => ({
            name: s.name,
            action: s.action,
            order: s.order,
            status: s.status,
            actedAt: s.actedAt || null,
          })),
        },
      });
    },
  ],

  'GET /api/storage-connection': [
    requireAuth(),
    async ctx => {
      const profile = await resolveProfile(
        ctx.user!.userId,
        ctx.user!.email,
        ctx.user!.name
      );
      if (!profile) return error('غير مصرح', 403);
      return json({
        provider: 'onedrive',
        state: 'requires_microsoft_app_registration',
        targetPattern: 'حذام / السنة / نوع المستند / رقم المعاملة',
        platformStorage: 'temporary_working_copy',
        note: 'الأرشفة في OneDrive ستفعل بعد تسجيل تطبيق Microsoft Entra وربط Graph.',
      });
    },
  ],
});
