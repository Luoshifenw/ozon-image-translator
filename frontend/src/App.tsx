import { useState, useCallback } from "react";
import axios from "axios";
import { UploadZone } from "./components/UploadZone";

// 处理状态类型
type ProcessStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "error";

// 翻译后的图片信息
interface TranslatedImage {
  original_name: string;
  translated_name: string;
  file_path: string;
  status: "success" | "failed";
  error?: string;
}

// API 响应类型
interface TranslationResponse {
  request_id: string;
  total: number;
  success: number;
  failed: number;
  images: TranslatedImage[];
}

function App() {
  // 状态管理
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [translatedImages, setTranslatedImages] = useState<TranslatedImage[]>(
    []
  );

  // 处理文件选择
  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
    setStatus("idle");
    setErrorMessage("");
    setTranslatedImages([]);
  }, []);

  // 移除单个文件
  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 清空所有文件
  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
    setStatus("idle");
    setErrorMessage("");
    setTranslatedImages([]);
  }, []);

  // 开始翻译
  const handleStartTranslation = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setStatus("uploading");
    setErrorMessage("");
    setTranslatedImages([]);

    try {
      // 构建 FormData
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      setStatus("processing");

      // 发送请求（设置 5 分钟超时）
      const response = await axios.post<TranslationResponse>(
        "/api/translate-bulk",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 300000, // 300秒 = 5分钟
        }
      );

      const data = response.data;
      setTranslatedImages(data.images);
      setStatus("completed");
    } catch (error) {
      console.error("翻译失败:", error);
      setStatus("error");
      if (axios.isAxiosError(error) && error.response) {
        setErrorMessage(`翻译失败: ${error.response.statusText}`);
      } else {
        setErrorMessage("翻译失败，请检查网络连接或稍后重试");
      }
    }
  }, [selectedFiles]);

  // 下载单张图片
  const handleDownloadImage = useCallback((image: TranslatedImage) => {
    const downloadUrl = `/api/download/${image.file_path}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = image.translated_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // 下载所有成功的图片
  const handleDownloadAll = useCallback(() => {
    translatedImages
      .filter((img) => img.status === "success")
      .forEach((image) => {
        setTimeout(() => handleDownloadImage(image), 100);
      });
  }, [translatedImages, handleDownloadImage]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // 状态指示器配置
  const statusConfig = {
    idle: { text: "等待上传", color: "text-slate-400", bg: "bg-slate-700" },
    uploading: {
      text: "正在上传...",
      color: "text-amber-400",
      bg: "bg-amber-900/30",
    },
    processing: {
      text: "正在翻译处理中...",
      color: "text-blue-400",
      bg: "bg-blue-900/30",
    },
    completed: {
      text: "翻译完成！",
      color: "text-emerald-400",
      bg: "bg-emerald-900/30",
    },
    error: { text: "处理失败", color: "text-red-400", bg: "bg-red-900/30" },
  };

  const currentStatus = statusConfig[status];
  const isProcessing = status === "uploading" || status === "processing";
  const hasResults = status === "completed" && translatedImages.length > 0;
  const successCount = translatedImages.filter(
    (img) => img.status === "success"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* 标题区域 */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 mb-4 tracking-tight">
            图片批量翻译
          </h1>
          <p className="text-slate-400 text-lg">
            为 Ozon 跨境电商卖家打造 · 快速批量翻译商品图片 · 中文 → 俄语
          </p>
        </header>

        {/* 上传区域 */}
        {!hasResults && (
          <>
            <UploadZone
              onFilesSelected={handleFilesSelected}
              disabled={isProcessing}
            />

            {/* 已选文件列表 */}
            {selectedFiles.length > 0 && (
              <div className="mt-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-200">
                    已选择 {selectedFiles.length} 张图片
                  </h2>
                  {!isProcessing && (
                    <button
                      onClick={handleClearAll}
                      className="text-sm text-slate-400 hover:text-red-400 transition-colors"
                    >
                      清空全部
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-slate-200 text-sm truncate">
                            {file.name}
                          </p>
                          <p className="text-slate-500 text-xs">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      {!isProcessing && (
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 翻译结果展示 */}
        {hasResults && (
          <div className="space-y-6">
            {/* 结果统计 */}
            <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-200 mb-2">
                    翻译结果
                  </h2>
                  <p className="text-slate-400">
                    成功{" "}
                    <span className="text-emerald-400 font-semibold">
                      {successCount}
                    </span>{" "}
                    张 / 失败{" "}
                    <span className="text-red-400 font-semibold">
                      {translatedImages.length - successCount}
                    </span>{" "}
                    张
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAll}
                    className="px-6 py-3 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                  >
                    重新上传
                  </button>
                  {successCount > 0 && (
                    <button
                      onClick={handleDownloadAll}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400 transition-all"
                    >
                      下载全部
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 图片预览网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {translatedImages.map((image, index) => (
                <div
                  key={index}
                  className="group relative bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden hover:border-emerald-500/50 transition-all"
                >
                  {image.status === "success" ? (
                    <>
                      {/* 图片预览 */}
                      <div className="aspect-square bg-slate-900">
                        <img
                          src={`/api/download/${image.file_path}`}
                          alt={image.translated_name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* 信息和下载按钮 */}
                      <div className="p-3">
                        <p
                          className="text-xs text-slate-400 mb-2 truncate"
                          title={image.original_name}
                        >
                          原: {image.original_name}
                        </p>
                        <button
                          onClick={() => handleDownloadImage(image)}
                          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          下载
                        </button>
                      </div>
                    </>
                  ) : (
                    /* 失败状态 */
                    <div className="p-4 aspect-square flex flex-col items-center justify-center">
                      <svg
                        className="w-12 h-12 text-red-400 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-red-400 text-sm mb-1">翻译失败</p>
                      <p className="text-slate-500 text-xs text-center">
                        {image.error || "未知错误"}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 状态指示器和操作按钮 */}
        {!hasResults && (
          <div className="mt-8 flex flex-col items-center gap-6">
            {/* 状态指示器 */}
            <div
              className={`
              px-6 py-3 rounded-full ${currentStatus.bg} 
              flex items-center gap-3 transition-all duration-300
            `}
            >
              {isProcessing && (
                <svg
                  className="w-5 h-5 animate-spin text-current"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {status === "completed" && (
                <svg
                  className="w-5 h-5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {status === "error" && (
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <span className={`font-medium ${currentStatus.color}`}>
                {currentStatus.text}
              </span>
            </div>

            {/* 错误信息 */}
            {errorMessage && (
              <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            {/* 开始翻译按钮 */}
            <button
              onClick={handleStartTranslation}
              disabled={selectedFiles.length === 0 || isProcessing}
              className={`
                px-12 py-4 rounded-xl font-bold text-lg
                transition-all duration-300 transform
                ${
                  selectedFiles.length === 0 || isProcessing
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-400 hover:to-cyan-400 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/25 active:scale-100"
                }
              `}
            >
              {isProcessing ? "处理中..." : "开始翻译"}
            </button>
          </div>
        )}

        {/* 底部信息 */}
        <footer className="mt-16 text-center text-slate-600 text-sm">
          <p>图片翻译服务 v0.0.2 · 使用 FastAPI + React + GPT-4o-image 构建</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
