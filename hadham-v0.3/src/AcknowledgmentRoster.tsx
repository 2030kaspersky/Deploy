import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

type AcknowledgmentSigner = {
  email: string;
  name: string;
  action: 'sign' | 'approve' | 'acknowledge';
  order: number;
  status: 'pending' | 'completed';
  actedAt?: string;
};

type Props = {
  signers: AcknowledgmentSigner[];
  code: string;
  title: string;
  category: string;
  createdAt: string;
  organizationName: string;
  isOwner: boolean;
};

type Filter = 'all' | 'completed' | 'pending';

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const safeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]/g, '-').trim();

const truncated = (
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
) => {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 2 && ctx.measureText(`…${result}`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
};

export function AcknowledgmentRoster({
  signers,
  code,
  title,
  category,
  createdAt,
  organizationName,
  isOwner,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const acknowledgmentSigners = useMemo(
    () =>
      signers
        .filter(signer => signer.action === 'acknowledge')
        .sort((a, b) => a.order - b.order),
    [signers]
  );

  const completed = acknowledgmentSigners.filter(
    signer => signer.status === 'completed'
  ).length;
  const pending = acknowledgmentSigners.length - completed;
  const percentage = acknowledgmentSigners.length
    ? Math.round((completed / acknowledgmentSigners.length) * 100)
    : 0;

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return acknowledgmentSigners.filter(signer => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'completed' && signer.status === 'completed') ||
        (filter === 'pending' && signer.status === 'pending');
      const matchesQuery =
        !normalized ||
        signer.name.toLowerCase().includes(normalized) ||
        signer.email.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [acknowledgmentSigners, filter, query]);

  const exportExcel = async () => {
    if (!acknowledgmentSigners.length) return;
    setExporting('excel');
    try {
      const rows: Array<Array<string | number>> = [
        ['حذام | سجل الإقرار بالاطلاع', '', '', '', '', ''],
        ['الجهة', organizationName, '', 'رقم المعاملة', code, ''],
        ['عنوان المستند', title, '', 'التصنيف', category, ''],
        ['تاريخ إنشاء المعاملة', formatDateTime(createdAt), '', '', '', ''],
        ['المطلوب منهم الإقرار', acknowledgmentSigners.length, 'أقروا', completed, 'لم يقروا', pending],
        ['نسبة الإنجاز', `${percentage}%`, '', '', '', ''],
        [],
        ['م', 'الاسم', 'البريد الإلكتروني', 'الحالة', 'تاريخ ووقت الإقرار', 'الترتيب'],
        ...acknowledgmentSigners.map((signer, index) => [
          index + 1,
          signer.name,
          signer.email,
          signer.status === 'completed' ? 'أقر بالاطلاع' : 'لم يقر بعد',
          signer.status === 'completed' ? formatDateTime(signer.actedAt) : '—',
          signer.order,
        ]),
      ];

      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet['!cols'] = [
        { wch: 7 },
        { wch: 28 },
        { wch: 34 },
        { wch: 18 },
        { wch: 25 },
        { wch: 10 },
      ];
      sheet['!merges'] = [XLSX.utils.decode_range('A1:F1')];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'الإقرار بالاطلاع');
      XLSX.writeFile(
        workbook,
        `${safeFileName(code)}-سجل-الإقرار-بالاطلاع.xlsx`
      );
    } finally {
      setExporting(null);
    }
  };

  const drawReportPage = async (
    rows: AcknowledgmentSigner[],
    pageNumber: number,
    totalPages: number
  ) => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر إنشاء ملف PDF');

    const right = 1160;
    const left = 80;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#153f37';
    ctx.font = '800 42px Cairo, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('حذام | سجل الإقرار بالاطلاع', right, 90);

    ctx.fillStyle = '#62736d';
    ctx.font = '600 22px Cairo, sans-serif';
    ctx.fillText(
      truncated(ctx, organizationName || '—', 650),
      right,
      137
    );

    ctx.textAlign = 'left';
    ctx.fillText(code, left, 90);
    ctx.fillText(`صفحة ${pageNumber} من ${totalPages}`, left, 137);

    ctx.strokeStyle = '#dce6e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, 175);
    ctx.lineTo(right, 175);
    ctx.stroke();

    const drawMeta = (
      label: string,
      value: string,
      x: number,
      y: number,
      maxWidth: number
    ) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#71827d';
      ctx.font = '600 18px Cairo, sans-serif';
      ctx.fillText(label, x, y);
      ctx.fillStyle = '#173d36';
      ctx.font = '700 22px Cairo, sans-serif';
      ctx.fillText(truncated(ctx, value, maxWidth), x, y + 34);
    };

    drawMeta('عنوان المستند', title, right, 220, 950);
    drawMeta('التصنيف', category, right, 305, 260);
    drawMeta('تاريخ الإنشاء', formatDateTime(createdAt), 760, 305, 330);

    const metricY = 405;
    const metricWidth = 330;
    const metricGap = 28;
    const metrics = [
      ['المطلوب منهم الإقرار', String(acknowledgmentSigners.length)],
      ['أقروا بالاطلاع', String(completed)],
      ['لم يقروا بعد', String(pending)],
    ];
    metrics.forEach((metric, index) => {
      const x = right - index * (metricWidth + metricGap) - metricWidth;
      ctx.fillStyle = '#f4f8f6';
      ctx.beginPath();
      ctx.roundRect(x, metricY, metricWidth, 120, 18);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#687b74';
      ctx.font = '600 18px Cairo, sans-serif';
      ctx.fillText(metric[0], x + metricWidth - 22, metricY + 36);
      ctx.fillStyle = '#153f37';
      ctx.font = '800 38px Cairo, sans-serif';
      ctx.fillText(metric[1], x + metricWidth - 22, metricY + 82);
    });

    ctx.fillStyle = '#e8efec';
    ctx.beginPath();
    ctx.roundRect(left, 555, right - left, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#25675a';
    ctx.beginPath();
    ctx.roundRect(
      left,
      555,
      ((right - left) * percentage) / 100,
      18,
      9
    );
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.font = '700 18px Cairo, sans-serif';
    ctx.fillText(`نسبة الإنجاز ${percentage}%`, right, 602);

    const tableTop = 660;
    const rowHeight = 62;
    const columns = [
      { label: 'م', x: 1130, width: 70 },
      { label: 'الاسم', x: 1035, width: 360 },
      { label: 'الحالة', x: 645, width: 210 },
      { label: 'تاريخ ووقت الإقرار', x: 405, width: 300 },
      { label: 'الترتيب', x: 105, width: 90 },
    ];

    ctx.fillStyle = '#153f37';
    ctx.beginPath();
    ctx.roundRect(left, tableTop, right - left, 58, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px Cairo, sans-serif';
    columns.forEach(column => {
      ctx.textAlign = column.label === 'م' || column.label === 'الترتيب' ? 'center' : 'right';
      ctx.fillText(
        column.label,
        column.label === 'م' || column.label === 'الترتيب'
          ? column.x
          : column.x,
        tableTop + 30
      );
    });

    rows.forEach((signer, index) => {
      const y = tableTop + 58 + index * rowHeight;
      ctx.fillStyle = index % 2 === 0 ? '#fbfcfb' : '#f5f8f6';
      ctx.fillRect(left, y, right - left, rowHeight);

      ctx.fillStyle = '#1d3f38';
      ctx.font = '600 17px Cairo, sans-serif';

      ctx.textAlign = 'center';
      ctx.fillText(String((pageNumber - 1) * 15 + index + 1), 1130, y + rowHeight / 2);

      ctx.textAlign = 'right';
      ctx.fillText(truncated(ctx, signer.name, 335), 1035, y + rowHeight / 2);

      ctx.fillStyle =
        signer.status === 'completed' ? '#267247' : '#7d601f';
      ctx.fillText(
        signer.status === 'completed' ? 'أقر بالاطلاع' : 'لم يقر بعد',
        645,
        y + rowHeight / 2
      );

      ctx.fillStyle = '#405a53';
      ctx.font = '500 15px Cairo, sans-serif';
      ctx.fillText(
        signer.status === 'completed'
          ? formatDateTime(signer.actedAt)
          : '—',
        405,
        y + rowHeight / 2
      );

      ctx.textAlign = 'center';
      ctx.fillText(String(signer.order), 105, y + rowHeight / 2);
    });

    if (!rows.length) {
      ctx.fillStyle = '#71827d';
      ctx.font = '600 22px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد أسماء في هذا الكشف.', 620, tableTop + 140);
    }

    ctx.fillStyle = '#8a9894';
    ctx.font = '500 14px Cairo, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `تم إنشاء الكشف من منصة حذام — ${formatDateTime(new Date().toISOString())}`,
      right,
      1690
    );

    return canvas;
  };

  const exportPdf = async () => {
    if (!acknowledgmentSigners.length) return;
    setExporting('pdf');
    try {
      const rowsPerPage = 15;
      const pages = Math.max(
        1,
        Math.ceil(acknowledgmentSigners.length / rowsPerPage)
      );
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage();
        const rows = acknowledgmentSigners.slice(
          pageIndex * rowsPerPage,
          pageIndex * rowsPerPage + rowsPerPage
        );
        const canvas = await drawReportPage(
          rows,
          pageIndex + 1,
          pages
        );
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          0,
          210,
          297,
          undefined,
          'FAST'
        );
      }

      pdf.save(
        `${safeFileName(code)}-سجل-الإقرار-بالاطلاع.pdf`
      );
    } finally {
      setExporting(null);
    }
  };

  if (!acknowledgmentSigners.length) {
    return (
      <section className="card acknowledgment-card">
        <div className="ack-head">
          <div>
            <span className="eyebrow">الإقرار بالاطلاع</span>
            <h3>سجل الإقرار بالاطلاع</h3>
          </div>
        </div>
        <div className="empty compact">
          لا يوجد في هذه المعاملة أشخاص مطلوب منهم الإقرار بالاطلاع.
        </div>
      </section>
    );
  }

  return (
    <section className="card acknowledgment-card">
      <div className="ack-head">
        <div>
          <span className="eyebrow">الإقرار بالاطلاع</span>
          <h3>سجل الإقرار بالاطلاع</h3>
        </div>
        {isOwner && (
          <div className="ack-export-actions">
            <button
              className="ack-export-btn"
              type="button"
              disabled={Boolean(exporting)}
              onClick={exportExcel}
            >
              <FileSpreadsheet size={16} />
              {exporting === 'excel' ? 'جارٍ التصدير…' : 'Excel'}
            </button>
            <button
              className="ack-export-btn"
              type="button"
              disabled={Boolean(exporting)}
              onClick={exportPdf}
            >
              <FileText size={16} />
              {exporting === 'pdf' ? 'جارٍ التصدير…' : 'PDF'}
            </button>
          </div>
        )}
      </div>

      <div className="ack-metrics">
        <div>
          <span>المطلوب</span>
          <strong>{acknowledgmentSigners.length}</strong>
        </div>
        <div>
          <span>أقروا بالاطلاع</span>
          <strong>{completed}</strong>
        </div>
        <div>
          <span>لم يقروا بعد</span>
          <strong>{pending}</strong>
        </div>
        <div>
          <span>نسبة الإنجاز</span>
          <strong>{percentage}%</strong>
        </div>
      </div>

      <div className="ack-progress">
        <i style={{ width: `${percentage}%` }} />
      </div>

      <div className="ack-tools">
        <div className="ack-filters" role="group" aria-label="فلترة سجل الإقرار">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            الكل <b>{acknowledgmentSigners.length}</b>
          </button>
          <button
            type="button"
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            أقروا <b>{completed}</b>
          </button>
          <button
            type="button"
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            لم يقروا <b>{pending}</b>
          </button>
        </div>

        <label className="ack-search">
          <Search size={15} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="بحث بالاسم أو البريد"
          />
        </label>
      </div>

      <div className="ack-table-wrap">
        <table className="ack-table">
          <thead>
            <tr>
              <th>م</th>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الحالة</th>
              <th>تاريخ ووقت الإقرار</th>
              <th>الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((signer, index) => (
              <tr key={signer.email}>
                <td>{index + 1}</td>
                <td><strong>{signer.name}</strong></td>
                <td dir="ltr">{signer.email}</td>
                <td>
                  <span
                    className={
                      signer.status === 'completed'
                        ? 'ack-state completed'
                        : 'ack-state pending'
                    }
                  >
                    {signer.status === 'completed'
                      ? 'أقر بالاطلاع'
                      : 'لم يقر بعد'}
                  </span>
                </td>
                <td>
                  {signer.status === 'completed'
                    ? formatDateTime(signer.actedAt)
                    : '—'}
                </td>
                <td>{signer.order}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!visible.length && (
          <div className="ack-empty">
            لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.
          </div>
        )}
      </div>

      {isOwner && (
        <div className="ack-export-note">
          <Download size={15} />
          كشف PDF وExcel يشمل جميع المطلوب منهم الإقرار، بما في ذلك من لم يقروا بعد.
        </div>
      )}
    </section>
  );
}
