import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, PenLine, Upload } from 'lucide-react';

export type SignaturePosition =
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'middle-right'
  | 'middle-center'
  | 'middle-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left';

export type SignaturePlacementPayload = {
  signatureDataUrl: string;
  pageNumber: number;
  position: SignaturePosition;
  width: number;
  color: string;
  source: 'draw' | 'image';
};

type Props = {
  pageCount: number;
  onChange: (payload: SignaturePlacementPayload | null) => void;
};

const colors = [
  { value: '#111827', label: 'أسود' },
  { value: '#1d4ed8', label: 'أزرق' },
  { value: '#14532d', label: 'أخضر داكن' },
  { value: '#7f1d1d', label: 'عنابي' },
];

const positions: Array<{ value: SignaturePosition; label: string }> = [
  { value: 'top-right', label: 'أعلى يمين' },
  { value: 'top-center', label: 'أعلى وسط' },
  { value: 'top-left', label: 'أعلى يسار' },
  { value: 'middle-right', label: 'وسط يمين' },
  { value: 'middle-center', label: 'وسط' },
  { value: 'middle-left', label: 'وسط يسار' },
  { value: 'bottom-right', label: 'أسفل يمين' },
  { value: 'bottom-center', label: 'أسفل وسط' },
  { value: 'bottom-left', label: 'أسفل يسار' },
];

const hexToRgb = (hex: string) => {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

export function SignatureEditor({ pageCount, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [source, setSource] = useState<'draw' | 'image'>('draw');
  const [color, setColor] = useState('#111827');
  const [pageNumber, setPageNumber] = useState(Math.max(1, pageCount));
  const [position, setPosition] = useState<SignaturePosition>('bottom-right');
  const [width, setWidth] = useState(140);
  const [hasInk, setHasInk] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setPageNumber((current) => Math.min(Math.max(1, current), Math.max(1, pageCount)));
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
    overrides: Partial<Omit<SignaturePlacementPayload, 'signatureDataUrl'>> = {},
    force = false
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || (!hasInk && !force)) {
      onChange(null);
      return;
    }
    onChange({
      signatureDataUrl: canvas.toDataURL('image/png'),
      pageNumber: overrides.pageNumber ?? pageNumber,
      position: overrides.position ?? position,
      width: overrides.width ?? width,
      color: overrides.color ?? color,
      source: overrides.source ?? source,
    });
  };

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width),
      y: (event.clientY - rect.top) * (event.currentTarget.height / rect.height),
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
    setHasInk(true);
    publish({ source: 'draw' }, true);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
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
    if (hasInk) publish({ color: nextColor }, true);
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
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
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
          data.data[i + 3] = Math.min(alpha, Math.max(45, Math.round(darkness * 5)));
        }
        ctx.putImageData(data, 0, 0);
        setHasInk(true);
        setSource('image');
        setNotice('تم تجهيز صورة التوقيع وإزالة الخلفية البيضاء قدر الإمكان.');
        publish({ source: 'image' }, true);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const sizeLabel = width <= 110 ? 'صغير' : width <= 165 ? 'متوسط' : 'كبير';

  return (
    <div className="signature-editor">
      <div className="signature-source-tabs">
        <button
          type="button"
          className={source === 'draw' ? 'active' : ''}
          onClick={() => {
            setSource('draw');
            if (hasInk) publish({ source: 'draw' }, true);
          }}
        >
          <PenLine size={16} /> رسم التوقيع
        </button>
        <label className={source === 'image' ? 'active upload-tab' : 'upload-tab'}>
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
        className={source === 'draw' ? 'signature-canvas' : 'signature-canvas image-mode'}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
      />

      <div className="signature-toolbar">
        <button type="button" className="text-link" onClick={clear}>مسح التوقيع</button>
        <span>{source === 'image' ? 'صورة توقيع' : 'توقيع مرسوم'}</span>
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
                className={color === item.value ? 'color-dot selected' : 'color-dot'}
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
              if (hasInk) publish({ pageNumber: value }, true);
            }}
          >
            {Array.from({ length: Math.max(1, pageCount) }, (_, index) => index + 1).map((page) => (
              <option key={page} value={page}>الصفحة {page}</option>
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
              if (hasInk) publish({ width: value }, true);
            }}
          />
        </label>
      </div>

      <div className="placement-heading">
        <strong>مكان التوقيع داخل الصفحة</strong>
        <span>اختر أحد المواضع التسعة</span>
      </div>
      <div className="position-grid">
        {positions.map((item) => (
          <button
            type="button"
            key={item.value}
            className={position === item.value ? 'active' : ''}
            onClick={() => {
              setPosition(item.value);
              if (hasInk) publish({ position: item.value }, true);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
