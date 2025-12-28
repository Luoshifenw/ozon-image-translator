import React, { useEffect, useState } from 'react';

interface FilePreviewGridProps {
    files: File[];
    onRemove: (index: number) => void;
    disabled?: boolean;
}

export const FilePreviewGrid: React.FC<FilePreviewGridProps> = ({ files, onRemove, disabled }) => {
    const [previews, setPreviews] = useState<string[]>([]);

    // Create object URLs for previews
    useEffect(() => {
        const urls = files.map(file => URL.createObjectURL(file));
        setPreviews(urls);

        // Cleanup function
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="animate-fade-in mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-sm"></span>
                    Input Manifest ({files.length})
                </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file, index) => (
                    <div
                        key={`${file.name}-${index}`}
                        className="group relative bg-white border border-slate-200 rounded-lg p-2 transition-all hover:border-blue-400 hover:shadow-md"
                    >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-slate-100 rounded-md mb-2 overflow-hidden border border-slate-100 relative">
                            <img
                                src={previews[index]}
                                alt={file.name}
                                className="w-full h-full object-cover"
                            />

                            {/* Overlay Delete Button */}
                            {!disabled && (
                                <button
                                    onClick={() => onRemove(index)}
                                    className="absolute top-1 right-1 p-1 bg-white/90 text-slate-400 hover:text-red-500 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                                    title="Remove file"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* File Info */}
                        <div className="px-1">
                            <div className="text-xs font-mono font-medium text-slate-700 truncate" title={file.name}>
                                {file.name}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {formatSize(file.size)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
