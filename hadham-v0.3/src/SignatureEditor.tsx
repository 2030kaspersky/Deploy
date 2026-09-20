import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Image as ImageIcon, Maximize2, Move, PenLine } from 'lucide-react';

GlobalWorkerOptions.workerSrc = workerUrl;

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
  pdfBase64: string;
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

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const trimSignatureCanvas = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      aspect: canvas.width / Math.max(1, canvas.height),
    };
  }

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = image.data[(y * canvas.width + x) * 4 + 3];
      if (alpha <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      dataUrl: '',
      aspect: canvas.width / Math.max(1, canvas.height),
    };
  }

  const padding = 14;
  const sx = Math.max(0, minX - padding);
  const sy = Math.max(0, minY - padding);
  const ex = Math.min(canvas.width - 1, maxX + padding);
  const ey = Math.min(canvas.height - 1, maxY + padding);
  const sw = Math.max(1, ex - sx + 1);
  const sh = Math.max(1, ey - sy + 1);

  const trimmed = document.createElement('canvas');
  trimmed.width = sw;
  trimmed.height = sh;
  const trimmedCtx = trimmed.getContext('2d');
  trimmedCtx?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

  return {
    dataUrl: trimmed.toDataURL('image/png'),
    aspect: sw / Math.max(1, sh),
  };
};

export function SignatureEditor({
  pdfBase64,
  pageCount,
  pageSizes,
  onChange,
}: Props) {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, widthPx: 0 });
  const renderTask = useRef<RenderTask | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [source, setSource] = useState<'draw' | 'image'>('draw');
  const [color, setColor] = useState('#111827');
  const [pageNumber, setPageNumber] = useState(Math.max(1, pageCount));
  const [width, setWidth] = useState(140);
  const [hasInk, setHasInk] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [signatureAspect, setSignatureAspect] = useState(900 / 260);
  const [visualPageSize, setVisualPageSize] = useState<PageSize>({
    width: 595,
    height: 842,
  });
  const [xRatio, setXRatio] = useState(0.72);
  const [yRatio, setYRatio] = useState(0.82);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setPageNumber(current =>
      Math.min(Math.max(1, current), Math.max(1, pageCount))
    );
  }, [pageCount]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
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

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    const loadPdf = async () => {
      if (!pdfBase64) {
        setPdfLoading(false);
        return;
      }
      setPdfLoading(true);
      setNotice('');
      try {
        const task = getDocument({ data: decodeBase64(pdfBase64) });
        loaded = await task.promise;
        if (!cancelled) {
          setPdfDoc(loaded);
          setPdfLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotice('تعذر عرض صفحة PDF مباشرة.');
          setPdfLoading(false);
        }
      }
    };
    loadPdf();
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
      loaded?.destroy();
    };
  }, [pdfBase64]);

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current || !surfaceRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      const canvas = pdfCanvasRef.current;
      const surface = surfaceRef.current;
      if (!canvas || !surface) return;
      try {
        renderTask.current?.cancel();
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        setVisualPageSize({
          width: baseViewport.width,
          height: baseViewport.height,
        });
        const availableWidth = Math.max(
          280,
          Math.min(880, surface.clientWidth || 720)
        );
        const scale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        renderTask.current = page.render({
          canvasContext: ctx,
          viewport,
          transform:
            pixelRatio === 1
              ? undefined
              : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.current.promise;
      } catch (err) {
        if (
          !cancelled &&
          err instanceof Error &&
          err.name !== 'RenderingCancelledException'
        ) {
          setNotice('تعذر تحديث معاينة صفحة PDF.');
        }
      }
    };

    const onResize = () => renderPage();
    renderPage();
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      renderTask.current?.cancel();
      window.removeEventListener('resize', onResize);
    };
  }, [pdfDoc, pageNumber]);

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
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const trimmed = trimSignatureCanvas(canvas);
    if (!trimmed.dataUrl) return;
    setSignatureDataUrl(trimmed.dataUrl);
    setSignatureAspect(trimmed.aspect);
    setHasInk(true);
    setSource(nextSource);
    publish(trimmed.dataUrl, { source: nextSource });
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
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setSignatureDataUrl('');
    setSignatureAspect(900 / 260);
    setNotice('');
    onChange(null);
  };

  const recolor = (nextColor: string) => {
    const canvas = drawingCanvasRef.current;
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
      const trimmed = trimSignatureCanvas(canvas);
      if (!trimmed.dataUrl) return;
      setSignatureDataUrl(trimmed.dataUrl);
      setSignatureAspect(trimmed.aspect);
      publish(trimmed.dataUrl, { color: nextColor });
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
        const canvas = drawingCanvasRef.current;
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

  const fallbackPageSize =
    pageSizes[pageNumber - 1] ||
    pageSizes[0] || { width: 595, height: 842 };
  const pageSize =
    visualPageSize.width > 0 && visualPageSize.height > 0
      ? visualPageSize
      : fallbackPageSize;
  const widthPercent = Math.min(
    48,
    Math.max(10, (width / Math.max(1, pageSize.width)) * 100)
  );
  const heightPercent = Math.min(
    35,
    widthPercent *
      (pageSize.width / Math.max(1, pageSize.height)) /
      Math.max(0.1, signatureAspect)
  );

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current;
    const overlay = overlayRef.current;
    if (!surface || !overlay || resizing.current) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = overlay.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || resizing.current) return;
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
    setXRatio(clamp(left / maxX));
    setYRatio(clamp(top / maxY));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (signatureDataUrl) publish(signatureDataUrl, { xRatio, yRatio });
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const overlay = overlayRef.current;
    if (!overlay) return;
    resizing.current = true;
    dragging.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      clientX: event.clientX,
      widthPx: overlay.getBoundingClientRect().width,
    };
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizing.current) return;
    event.stopPropagation();
    const surface = surfaceRef.current;
    if (!surface) return;
    const surfaceWidth = Math.max(1, surface.getBoundingClientRect().width);
    const nextWidthPx = Math.max(
      55,
      Math.min(
        surfaceWidth * 0.55,
        resizeStart.current.widthPx +
          (event.clientX - resizeStart.current.clientX)
      )
    );
    const nextPdfWidth = Math.max(
      70,
      Math.min(
        260,
        (nextWidthPx / surfaceWidth) * pageSize.width
      )
    );
    setWidth(Math.round(nextPdfWidth));
  };

  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!resizing.current) return;
    resizing.current = false;
    if (signatureDataUrl) publish(signatureDataUrl, { width });
  };

  useEffect(() => {
    if (signatureDataUrl) {
      publish(signatureDataUrl, { xRatio, yRatio, width });
    }
  }, [xRatio, yRatio, width]);

  const sizeLabel =
    width <= 110 ? 'صغير' : width <= 165 ? 'متوسط' : 'كبير';

  return (
    <div className="signature-editor direct-document-editor">
      <div className="signature-editor-top">
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
              onChange={event => uploadImage(event.target.files?.[0])}
            />
          </label>
        </div>

        <canvas
          ref={drawingCanvasRef}
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
              {colors.map(item => (
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
                onChange={event => recolor(event.target.value)}
              />
            </div>
          </label>

          <label>
            الصفحة
            <select
              value={pageNumber}
              onChange={event => {
                const value = Number(event.target.value);
                setPageNumber(value);
                setXRatio(0.72);
                setYRatio(0.82);
                if (signatureDataUrl) {
                  publish(signatureDataUrl, {
                    pageNumber: value,
                    xRatio: 0.72,
                    yRatio: 0.82,
                  });
                }
              }}
            >
              {Array.from(
                { length: Math.max(1, pageCount) },
                (_, index) => index + 1
              ).map(page => (
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
              onChange={event => setWidth(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="direct-placement-heading">
        <div>
          <strong>حدد موضع التوقيع مباشرة على المستند</strong>
          <span>
            اسحب التوقيع فوق صفحة PDF واستخدم المقبض لتغيير حجمه.
          </span>
        </div>
        <div className="placement-icons">
          <Move size={17} />
          <Maximize2 size={17} />
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="signature-page-surface direct-pdf-stage"
        style={{
          aspectRatio: `${pageSize.width} / ${pageSize.height}`,
        }}
      >
        {pdfLoading && (
          <div className="pdf-render-loading">جارٍ عرض الصفحة…</div>
        )}
        <canvas ref={pdfCanvasRef} className="pdf-page-canvas" />
        <div className="page-number-chip">صفحة {pageNumber}</div>

        {signatureDataUrl ? (
          <div
            ref={overlayRef}
            className="signature-overlay-box"
            style={{
              width: `${widthPercent}%`,
              left: `${xRatio * (100 - widthPercent)}%`,
              top: `${yRatio * (100 - heightPercent)}%`,
            }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img
              src={signatureDataUrl}
              alt="التوقيع فوق المستند"
              draggable={false}
            />
            <button
              type="button"
              className="signature-resize-handle"
              aria-label="تغيير حجم التوقيع"
              title="اسحب لتغيير الحجم"
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
            />
          </div>
        ) : (
          <div className="placement-empty">
            ارسم أو ارفع توقيعك، ثم سيظهر فوق المستند مباشرة.
          </div>
        )}
      </div>

      <div className="notice placement-notice">
        ما تراه هنا هو صفحة PDF الفعلية. موضع وحجم التوقيع في هذه
        الشاشة يُستخدمان عند إنشاء المعاينة النهائية وعند الاعتماد.
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
