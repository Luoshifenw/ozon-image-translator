import { useCallback, useState, DragEvent, ChangeEvent } from 'react';

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
        w-full h-80 rounded-2xl
        border-3 border-dashed
        transition-all duration-300 ease-out
        cursor-pointer
        ${disabled 
          ? 'border-slate-600 bg-slate-800/30 cursor-not-allowed opacity-60' 
          : isDragOver 
            ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02] shadow-2xl shadow-emerald-500/20' 
            : 'border-slate-600 bg-slate-800/50 hover:border-emerald-500 hover:bg-slate-800/70'
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
      
      {/* 上传图标 */}
      <div className={`
        mb-6 p-6 rounded-full
        transition-all duration-300
        ${isDragOver 
          ? 'bg-emerald-500/20 scale-110' 
          : 'bg-slate-700/50'
        }
      `}>
        <svg 
          className={`w-16 h-16 transition-colors duration-300 ${
            isDragOver ? 'text-emerald-400' : 'text-slate-400'
          }`}
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
      <h3 className={`
        text-2xl font-bold mb-2 transition-colors duration-300
        ${isDragOver ? 'text-emerald-400' : 'text-slate-200'}
      `}>
        {isDragOver ? '松开即可上传' : '拖拽图片到这里'}
      </h3>
      
      <p className="text-slate-400 text-lg mb-4">
        或者点击选择文件
      </p>
      
      <p className="text-slate-500 text-sm">
        支持 JPG、PNG、WebP 等图片格式，可一次选择多张
      </p>
    </div>
  );
}

