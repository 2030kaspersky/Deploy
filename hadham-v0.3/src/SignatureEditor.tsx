import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Move, PenLine } from 'lucide-react';

export type SignaturePlacementPayload = {
  signatureDataUrl: string;
  pageNumber: number;
  width: number;
  color: string;
  source: 'draw' | 'image';
  xRatio: number;
  yRatio: number;
};

type PageSize = { width: number; height: number };

type Props = {
  pageCount: number;
  pageSizes: PageSize[];
  onChange: (payload: SignaturePlacementPayload | null) => void;
};

const colors = [
  { value: '#111827', label: 'أسود' },
  { value: '#1d4ed8', label: 'أزرق' },
  { value: '#14532d', label: 'أخضر داكن' },
  { value: '#7f1d1d', label: 'عنابي' },
];

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function SignatureEditor({ pageCount, pageSizes, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const drawing = useRef(false);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [source, setSource] = useState<'draw' | 'image'>('draw');
  const [color, setColor] = useState('#111827');
  const [pageNumber, setPageNumber] = useState(Math.max(1, pageCount));
  const [width, setWidth] = useState(140);
  const [hasInk, setHasInk] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [xRatio, setXRatio] = useState(0.72);
  const [yRatio, setYRatio] = useState(0.82);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setPageNumber((current) =>
      Math.min(Math.max(1, current), Math.max(1, pageCount))
    );
  }, [pageCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 900;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
  }, []);

  const publish = (
    nextDataUrl = signatureDataUrl,
    overrides: Partial<Omit<SignaturePlacementPayload, 'signatureDataUrl'>> = {}
  ) => {
    if (!nextDataUrl) {
      onChange(null);
      return;
    }
    onChange({
      signatureDataUrl: nextDataUrl,
      pageNumber: overrides.pageNumber ?? pageNumber,
      width: overrides.width ?? width,
      color: overrides.color ?? color,
      source: overrides.source ?? source,
      xRatio: overrides.xRatio ?? xRatio,
      yRatio: overrides.yRatio ?? yRatio,
    });
  };

  const updateSignatureFromCanvas = (nextSource: 'draw' | 'image') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
    setHasInk(true);
    setSource(nextSource);
    publish(dataUrl, { source: nextSource });
  };

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x:
        (event.clientX - rect.left) *
        (event.currentTarget.width / rect.width),
      y:
        (event.clientY - rect.top) *
        (event.currentTarget.height / rect.height),
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (source !== 'draw') return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext('2d');
    const p = point(event);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  };

  const moveDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || source !== 'draw') return;
    const ctx = event.currentTarget.getContext('2d');
    const p = point(event);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    updateSignatureFromCanvas('draw');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas
      .getContext('2d')
      ?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setSignatureDataUrl('');
    setNotice('');
    onChange(null);
  };

  const recolor = (nextColor: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rgb = hexToRgb(nextColor);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] === 0) continue;
      image.data[i] = rgb.r;
      image.data[i + 1] = rgb.g;
      image.data[i + 2] = rgb.b;
    }
    ctx.putImageData(image, 0, 0);
    ctx.strokeStyle = nextColor;
    setColor(nextColor);
    if (hasInk) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureDataUrl(dataUrl);
      publish(dataUrl, { color: nextColor });
    }
  };

  const uploadImage = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setNotice('صيغة الصورة غير مدعومة. استخدم PNG أو JPG أو WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('حجم صورة التوقيع يجب ألا يتجاوز 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const maxWidth = canvas.width * 0.82;
        const maxHeight = canvas.height * 0.72;
        const scale = Math.min(
          maxWidth / image.width,
          maxHeight / image.height
        );
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (canvas.width - drawWidth) / 2;
        const y = (canvas.height - drawHeight) / 2;
        ctx.drawImage(image, x, y, drawWidth, drawHeight);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = hexToRgb(color);
        for (let i = 0; i < data.data.length; i += 4) {
          const r = data.data[i];
          const g = data.data[i + 1];
          const b = data.data[i + 2];
          const alpha = data.data[i + 3];
          if (alpha === 0) continue;
          const brightness = (r + g + b) / 3;
          const darkness = 255 - brightness;
          if (r > 240 && g > 240 && b > 240) {
            data.data[i + 3] = 0;
            continue;
          }
          data.data[i] = rgb.r;
          data.data[i + 1] = rgb.g;
          data.data[i + 2] = rgb.b;
          data.data[i + 3] = Math.min(
            alpha,
            Math.max(45, Math.round(darkness * 5))
          );
        }
        ctx.putImageData(data, 0, 0);

        setNotice(
          'تم تجهيز صورة التوقيع وإزالة الخلفية البيضاء قدر الإمكان.'
        );
        updateSignatureFromCanvas('image');
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const pageSize =
    pageSizes[pageNumber - 1] ||
    pageSizes[0] || { width: 595, height: 842 };
  const widthPercent = Math.min(
    48,
    Math.max(12, (width / Math.max(1, pageSize.width)) * 100)
  );

  const startDrag = (event: React.PointerEvent<HTMLImageElement>) => {
    const surface = surfaceRef.current;
    const overlay = overlayRef.current;
    if (!surface || !overlay) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = overlay.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragging.current) return;
    const surface = surfaceRef.current;
    const overlay = overlayRef.current;
    if (!surface || !overlay) return;

    const surfaceRect = surface.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const maxX = Math.max(1, surfaceRect.width - overlayRect.width);
    const maxY = Math.max(1, surfaceRect.height - overlayRect.height);
    const left = Math.max(
      0,
      Math.min(
        maxX,
        event.clientX - surfaceRect.left - dragOffset.current.x
      )
    );
    const top = Math.max(
      0,
      Math.min(
        maxY,
        event.clientY - surfaceRect.top - dragOffset.current.y
      )
    );

    const nextX = clamp(left / maxX);
    const nextY = clamp(top / maxY);
    setXRatio(nextX);
    setYRatio(nextY);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (signatureDataUrl) publish(signatureDataUrl, { xRatio, yRatio });
  };

  useEffect(() => {
    if (signatureDataUrl) {
      publish(signatureDataUrl, { xRatio, yRatio });
    }
  }, [xRatio, yRatio]);

  const sizeLabel =
    width <= 110 ? 'صغير' : width <= 165 ? 'متوسط' : 'كبير';

  return (
    <div className="signature-editor">
      <div className="signature-source-tabs">
        <button
          type="button"
          className={source === 'draw' ? 'active' : ''}
          onClick={() => {
            setSource('draw');
            if (signatureDataUrl)
              publish(signatureDataUrl, { source: 'draw' });
          }}
        >
          <PenLine size={16} /> رسم التوقيع
        </button>
        <label
          className={
            source === 'image' ? 'active upload-tab' : 'upload-tab'
          }
        >
          <ImageIcon size={16} /> رفع صورة التوقيع
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => uploadImage(event.target.files?.[0])}
          />
        </label>
      </div>

      <canvas
        ref={canvasRef}
        className={
          source === 'draw'
            ? 'signature-canvas'
            : 'signature-canvas image-mode'
        }
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
      />

      <div className="signature-toolbar">
        <button type="button" className="text-link" onClick={clear}>
          مسح التوقيع
        </button>
        <span>
          {source === 'image' ? 'صورة توقيع' : 'توقيع مرسوم'}
        </span>
      </div>

      <div className="signature-settings">
        <label>
          لون التوقيع
          <div className="color-picker-row">
            {colors.map((item) => (
              <button
                type="button"
                key={item.value}
                title={item.label}
                aria-label={item.label}
                className={
                  color === item.value
                    ? 'color-dot selected'
                    : 'color-dot'
                }
                style={{ backgroundColor: item.value }}
                onClick={() => recolor(item.value)}
              />
            ))}
            <input
              className="custom-color"
              type="color"
              value={color}
              title="لون مخصص"
              onChange={(event) => recolor(event.target.value)}
            />
          </div>
        </label>

        <label>
          الصفحة
          <select
            value={pageNumber}
            onChange={(event) => {
              const value = Number(event.target.value);
              setPageNumber(value);
              if (signatureDataUrl)
                publish(signatureDataUrl, { pageNumber: value });
            }}
          >
            {Array.from(
              { length: Math.max(1, pageCount) },
              (_, index) => index + 1
            ).map((page) => (
              <option key={page} value={page}>
                الصفحة {page}
              </option>
            ))}
          </select>
        </label>

        <label>
          حجم التوقيع <strong>{sizeLabel}</strong>
          <input
            type="range"
            min="80"
            max="220"
            step="5"
            value={width}
            onChange={(event) => {
              const value = Number(event.target.value);
              setWidth(value);
              if (signatureDataUrl)
                publish(signatureDataUrl, { width: value });
            }}
          />
        </label>
      </div>

      <div className="placement-heading">
        <div>
          <strong>اسحب التوقيع إلى مكانه</strong>
          <span>يمكنك تحريكه بالماوس أو اللمس داخل الصفحة</span>
        </div>
        <Move size={18} />
      </div>

      <div
        ref={surfaceRef}
        className="signature-page-surface"
        style={{
          aspectRatio: `${pageSize.width} / ${pageSize.height}`,
        }}
      >
        <div className="page-number-chip">صفحة {pageNumber}</div>
        <div className="page-safe-area" />
        {signatureDataUrl ? (
          <img
            ref={overlayRef}
            src={signatureDataUrl}
            alt="موضع التوقيع"
            className="signature-drag-overlay"
            style={{
              width: `${widthPercent}%`,
              left: `${xRatio * (100 - widthPercent)}%`,
              top: `${yRatio * 88}%`,
            }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            draggable={false}
          />
        ) : (
          <div className="placement-empty">
            ارسم أو ارفع توقيعك ليظهر هنا
          </div>
        )}
      </div>

      <div className="notice placement-notice">
        موضع السحب يمثل مكان التوقيع داخل الصفحة، وستظهر المعاينة
        الفعلية على ملف PDF قبل الاعتماد.
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
