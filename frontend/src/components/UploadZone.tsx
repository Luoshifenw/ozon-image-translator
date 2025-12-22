import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * 拖拽上传区域组件
 * 支持拖拽和点击选择文件
 */
export function UploadZone({ onFilesSelected, disabled = false }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 处理文件放下
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [disabled, onFilesSelected]);

  // 处理点击选择文件
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      // 重置 input 以便可以再次选择相同文件
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
        w-full h-80 rounded-3xl
        border-2 border-dashed
        transition-all duration-300 ease-out
        cursor-pointer overflow-hidden
        ${disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : isDragOver
            ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-md'
        }
      `}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
      />

      {/* 上传图标容器 */}
      <div className={`
        relative mb-6 p-6 rounded-2xl
        transition-all duration-300
        ${isDragOver
          ? 'bg-blue-100/50 text-blue-600 scale-110 rotate-3'
          : 'bg-slate-50 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50'
        }
      `}>
        <svg
          className="w-12 h-12 transition-colors duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      {/* 提示文字 */}
      <div className="relative z-10 text-center space-y-2">
        <h3 className={`
          text-2xl font-bold transition-all duration-300
          ${isDragOver
            ? 'text-blue-600 scale-105'
            : 'text-slate-800'
          }
        `}>
          {isDragOver ? '松开即刻上传' : '点击或拖拽图片'}
        </h3>

        <p className={`text-base transition-colors duration-300 ${isDragOver ? 'text-blue-600/70' : 'text-slate-500'}`}>
          支持批量上传 · 自动识别格式
        </p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-500 font-medium">JPG</span>
          <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-500 font-medium">PNG</span>
          <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-xs text-slate-500 font-medium">WEBP</span>
        </div>
      </div>
    </div>
  );
}

