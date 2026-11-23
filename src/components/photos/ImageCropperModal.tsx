import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageFile: File | null;
  onClose: () => void;
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageFile,
  onClose,
  onCropComplete,
}) => {
  const { isDark } = useTheme();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const CROP_WIDTH = 240; // Width of vertical rectangular crop frame
  const CROP_HEIGHT = 300; // Height of vertical rectangular crop frame

  // Load image when file changes
  useEffect(() => {
    if (!imageFile || !isOpen) {
      setImageObj(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile, isOpen]);

  // Render canvas with vertical rectangular overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background grid/checker
    ctx.fillStyle = isDark ? '#11151c' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Center origin to canvas center
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate base scale to fit image into crop area
    const baseScale = Math.max(CROP_WIDTH / imageObj.width, CROP_HEIGHT / imageObj.height);
    const currentScale = baseScale * zoom;

    const drawW = imageObj.width * currentScale;
    const drawH = imageObj.height * currentScale;

    // Draw image with pan offset
    const imgX = centerX - drawW / 2 + pan.x;
    const imgY = centerY - drawH / 2 + pan.y;

    ctx.drawImage(imageObj, imgX, imgY, drawW, drawH);

    ctx.restore();

    // Draw dark semi-transparent mask outside crop rectangle
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    const cropX = centerX - CROP_WIDTH / 2;
    const cropY = centerY - CROP_HEIGHT / 2;
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(cropX, cropY, CROP_WIDTH, CROP_HEIGHT, 10);
    } else {
      ctx.rect(cropX, cropY, CROP_WIDTH, CROP_HEIGHT);
    }
    ctx.fill('evenodd');

    // Draw gold medallion vertical rectangle guide
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(cropX, cropY, CROP_WIDTH, CROP_HEIGHT, 10);
    } else {
      ctx.rect(cropX, cropY, CROP_WIDTH, CROP_HEIGHT);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#D6B15C';
    ctx.shadowColor = 'rgba(214, 177, 92, 0.6)';
    ctx.shadowBlur = 8;
    ctx.stroke();

    ctx.restore();
  }, [imageObj, zoom, pan, isDark]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse / Touch handlers for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Perform crop and save
  const handleSaveCrop = () => {
    if (!imageObj) return;

    // High resolution output canvas (360x450, 4:5 vertical portrait aspect ratio)
    const exportW = 360;
    const exportH = 450;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    const baseScale = Math.max(CROP_WIDTH / imageObj.width, CROP_HEIGHT / imageObj.height);
    const currentScale = baseScale * zoom;

    // Ratio between exportCanvas and preview CROP area
    const exportRatio = exportW / CROP_WIDTH;

    const exportDrawW = imageObj.width * currentScale * exportRatio;
    const exportDrawH = imageObj.height * currentScale * exportRatio;

    const exportImgX = exportW / 2 - exportDrawW / 2 + pan.x * exportRatio;
    const exportImgY = exportH / 2 - exportDrawH / 2 + pan.y * exportRatio;

    exportCtx.drawImage(imageObj, exportImgX, exportImgY, exportDrawW, exportDrawH);

    exportCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], imageFile?.name || 'profile_cropped.png', {
          type: 'image/png',
        });
        const previewUrl = exportCanvas.toDataURL('image/png');
        onCropComplete(croppedFile, previewUrl);
        onClose();
      },
      'image/png',
      0.95
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          backgroundColor: isDark ? '#151922' : '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(214, 177, 92, 0.35)',
          border: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Inter', sans-serif",
          color: isDark ? '#F1E9D7' : '#101318',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#1D2633' : '#fafaf9',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: "'Marcellus', Georgia, serif",
                color: isDark ? '#D6B15C' : '#854d0e',
              }}
            >
              Crop Profile Photo
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: isDark ? '#9BA3AF' : '#64748b' }}>
              Drag to position & use slider to zoom into circular medallion
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cancel"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#9BA3AF' : '#64748b',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Canvas Viewport */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0a0d14',
            padding: 12,
            userSelect: 'none',
          }}
        >
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              borderRadius: 12,
              touchAction: 'none',
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderTop: `1px solid ${isDark ? '#252E3A' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#181F2A' : '#f8fafc',
          }}
        >
          <ZoomOut size={16} color={isDark ? '#9BA3AF' : '#64748b'} />
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#D6B15C',
              cursor: 'pointer',
            }}
          />
          <ZoomIn size={16} color={isDark ? '#9BA3AF' : '#64748b'} />

          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset Zoom & Position"
            style={{
              background: 'transparent',
              border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              color: isDark ? '#D6B15C' : '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '11px',
            }}
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            borderTop: `1px solid ${isDark ? '#343D49' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#1D2633' : '#fafaf9',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: `1px solid ${isDark ? '#343D49' : '#cbd5e1'}`,
              backgroundColor: 'transparent',
              color: isDark ? '#E5E7EB' : '#475569',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#D6B15C',
              color: '#101318',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 10px rgba(214, 177, 92, 0.35)',
            }}
          >
            <Check size={15} /> Save Photo
          </button>
        </div>
      </div>
    </div>
  );
};

