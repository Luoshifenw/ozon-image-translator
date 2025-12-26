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
        relative h-64 w-full rounded-lg border-2 border-dashed transition-all duration-200
        flex flex-col items-center justify-center text-center
        ${disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : isDragOver
            ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/10'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
        }
      `}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />

      <div className={`
        p-4 rounded-full bg-slate-100 text-slate-400 mb-3 transition-colors
        ${isDragOver ? 'bg-blue-100 text-blue-600' : 'group-hover:text-slate-600'}
      `}>
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-800">
          {isDragOver ? 'Drop Files Here' : 'Upload Source Images'}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Drag & drop or click to browse. Supports JPG, PNG, WEBP.
        </p>
      </div>

      {!disabled && (
        <div className="absolute bottom-4 right-4">
          <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest border border-slate-200 px-2 py-0.5 rounded">
            INPUT ZONE
          </span>
        </div>
      )}
    </div>
  );
}

