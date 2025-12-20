import { useState, useCallback } from "react";
import axios from "axios";
import { UploadZone } from "./components/UploadZone";

interface TranslatedImage {
  original_name: string;
  translated_name: string;
  file_path: string;
  status: string;
  error?: string;
}

interface TranslationResponse {
  task_id?: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  images: TranslatedImage[];
  error?: string;
}

type Status = "idle" | "uploading" | "processing" | "completed" | "error";

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [translatedImages, setTranslatedImages] = useState<TranslatedImage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [progress, setProgress] = useState<{ processed: number; total: number }>({
    processed: 0,
    total: 0,
  });

  // 文件选择处理
  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(files);
    setStatus("idle");
    setTranslatedImages([]);
    setErrorMessage("");
  }, []);

  // 清除所有
  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
    setTranslatedImages([]);
    setStatus("idle");
    setErrorMessage("");
    setProgress({ processed: 0, total: 0 });
  }, []);

  // 开始翻译（异步轮询版本）
  const handleStartTranslation = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setStatus("uploading");
    setErrorMessage("");
    setTranslatedImages([]);
    setProgress({ processed: 0, total: selectedFiles.length });

    try {
      // 构建 FormData
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      // 提交翻译任务（立即返回任务ID）
      const submitResponse = await axios.post<{ task_id: string; status: string; message: string }>(
        "/api/translate-bulk-async",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );

      const taskId = submitResponse.data.task_id;
      console.log(`任务已提交: ${taskId}`);
      
      setStatus("processing");

      // 开始轮询任务状态
      let pollCount = 0;
      const maxPolls = 200; // 最多轮询 200 次 (10 分钟)
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          setStatus("error");
          setErrorMessage("翻译超时，请重试");
          return;
        }

        try {
          const statusResponse = await axios.get<TranslationResponse>(
            `/api/task-status/${taskId}`
          );

          const data = statusResponse.data;
          console.log(`任务状态: ${data.status}, 进度: ${data.processed}/${data.total}`);

          // 更新进度
          setProgress({ processed: data.processed, total: data.total });

          if (data.status === "completed") {
            // 任务完成
            clearInterval(pollInterval);
            setTranslatedImages(data.images);
            setStatus("completed");
          } else if (data.status === "failed") {
            // 任务失败
            clearInterval(pollInterval);
            setStatus("error");
            setErrorMessage(data.error || "翻译失败");
          }
          // 如果状态是 pending 或 processing，继续轮询
        } catch (pollError) {
          console.error("轮询状态失败:", pollError);
          // 不停止轮询，继续尝试
        }
      }, 3000); // 每 3 秒轮询一次

    } catch (error) {
      console.error("提交翻译任务失败:", error);
      setStatus("error");
      if (axios.isAxiosError(error) && error.response) {
        setErrorMessage(`提交失败: ${error.response.statusText}`);
      } else {
        setErrorMessage("提交任务失败，请检查网络连接或稍后重试");
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
      .forEach((image, index) => {
        setTimeout(() => handleDownloadImage(image), index * 100);
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
      text: `正在翻译处理中... (${progress.processed}/${progress.total})`,
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
            <UploadZone onFilesSelected={handleFilesSelected} disabled={isProcessing} />

            {/* 已选择文件列表 */}
            {selectedFiles.length > 0 && (
              <div className="mt-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-200">
                    已选择 {selectedFiles.length} 张图片
                  </h3>
                  <button
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                  >
                    清空全部
                  </button>
                </div>

                {/* 文件列表 */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <svg
                          className="w-5 h-5 text-slate-400 flex-shrink-0"
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
                        <span className="text-slate-300 truncate">{file.name}</span>
                      </div>
                      <span className="text-slate-500 text-sm ml-2 flex-shrink-0">
                        {formatFileSize(file.size)}
                      </span>
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

            {/* 翻译结果图片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {translatedImages.map((image, index) => (
                <div
                  key={index}
                  className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50"
                >
                  {image.status === "success" ? (
                    <>
                      <div className="aspect-square bg-slate-700/30 rounded-lg overflow-hidden mb-3">
                        <img
                          src={`/api/download/${image.file_path}`}
                          alt={image.translated_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-slate-300 text-sm truncate">
                          {image.original_name}
                        </p>
                        <button
                          onClick={() => handleDownloadImage(image)}
                          className="w-full px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                          下载
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-square bg-slate-700/30 rounded-lg flex items-center justify-center mb-3">
                      <div className="text-center">
                        <p className="text-red-400 mb-2">翻译失败</p>
                        <p className="text-slate-500 text-sm">
                          {image.error || "未知错误"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 状态指示器和操作按钮 */}
        {selectedFiles.length > 0 && !hasResults && (
          <div className="mt-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg ${currentStatus.bg}`}>
                  <span className={`text-sm font-medium ${currentStatus.color}`}>
                    {currentStatus.text}
                  </span>
                </div>
                {status === "processing" && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>请耐心等待...</span>
                  </div>
                )}
              </div>
              {status === "idle" && (
                <button
                  onClick={handleStartTranslation}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  开始翻译
                </button>
              )}
            </div>

            {/* 错误信息 */}
            {errorMessage && (
              <p className="text-red-400 text-sm mt-4">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

