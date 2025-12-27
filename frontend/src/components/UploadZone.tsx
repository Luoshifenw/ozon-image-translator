import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Blueprint Style Upload Zone
 */

export function UploadZone({ onFilesSelected, disabled = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // Drag handlers (same logic, cleaner implementation)
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) onFilesSelected(files);
  }, [disabled, onFilesSelected]);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  }, [onFilesSelected]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center
        group
        w-full h-80 rounded-[2rem]
        transition-all duration-300 ease-out
        cursor-pointer overflow-hidden
        ${disabled
          ? 'bg-slate-50 opacity-60 cursor-not-allowed'
          : isDragOver
            ? 'bg-amber-50 shadow-inner'
            : 'bg-slate-50 hover:bg-white hover:shadow-float border border-transparent hover:border-slate-100' // Subtle feedback
        }
      `}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
      />

      {/* Modern Icon Container */}
      <div className={`
        relative mb-6 p-6 rounded-3xl
        transition-all duration-500
        ${isDragOver
          ? 'bg-aether-accent text-slate-900 scale-110 rotate-3 shadow-glow'
          : 'bg-white text-slate-300 shadow-sm group-hover:text-aether-accent group-hover:shadow-md'
        }
      `}>
        <svg
          className="w-10 h-10 transition-colors duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2} // Thicker, friendly stroke
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      {/* Friendly Text */}
      <div className="relative z-10 text-center space-y-2 px-4">
        <h3 className={`
            text-xl font-bold transition-all duration-300
            ${isDragOver ? 'text-slate-900' : 'text-slate-700'}
         `}>
          {isDragOver ? '释放文件即刻上传' : '点击选择或拖拽上传'}
        </h3>
        <p className="text-slate-400 font-medium text-sm max-w-sm mx-auto leading-relaxed">
          支持 JPG, PNG, WEBP 格式 · 智能批量处理
        </p>
      </div>

      {!disabled && (
        <div className="absolute bottom-6 flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
        </div>
      )}
    </div>
  );
}
