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
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
  }>({
    processed: 0,
    total: 0,
  });

  // 翻译模式状态
  const [targetMode, setTargetMode] = useState<"original" | "ozon_3_4">("original");

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
      // 添加目标模式
      formData.append("target_mode", targetMode);

      // 提交翻译任务（立即返回任务ID）
      const submitResponse = await axios.post<{
        task_id: string;
        status: string;
        message: string;
      }>("/api/translate-bulk-async", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 30000,
      });

      const taskId = submitResponse.data.task_id;
      console.log(`任务已提交: ${taskId}, 模式: ${targetMode}`);

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
          console.log(
            `任务状态: ${data.status}, 进度: ${data.processed}/${data.total}`
          );

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
  }, [selectedFiles, targetMode]);

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

  // 状态指示器配置
  const statusConfig = {
    idle: { text: "等待上传", color: "text-slate-500", bg: "bg-slate-100" },
    uploading: {
      text: "正在上传...",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    processing: {
      text: `处理中... (${progress.processed}/${progress.total})`,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    completed: {
      text: "处理完成",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    error: { text: "处理失败", color: "text-red-600", bg: "bg-red-50" },
  };

  const currentStatus = statusConfig[status];
  const isProcessing = status === "uploading" || status === "processing";
  const hasResults = status === "completed" && translatedImages.length > 0;
  const successCount = translatedImages.filter(
    (img) => img.status === "success"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden relative">
      {/* 动态背景光球 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12 z-10">
        {/* 标题区域 */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-white/50 backdrop-blur-sm mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-sm font-bold text-blue-700">Ozon 卖家专用工具 v2.1</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Ozon 图片智能翻译
          </h1>

          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            支持 <span className="font-semibold text-blue-600">3:4 主图自动裁剪</span> ·
            <span className="font-semibold text-blue-600"> 批量并发处理</span> ·
            <span className="font-semibold text-blue-600"> 智能自动排版</span>
          </p>
        </header>

        {/* 上传区域 */}
        {!hasResults && (
          <div className="space-y-12">
            <UploadZone
              onFilesSelected={handleFilesSelected}
              disabled={isProcessing}
            />

            {/* 控制与状态栏 */}
            {selectedFiles.length > 0 && (
              <div className="glass-panel rounded-3xl p-8 space-y-8 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">配置任务</h3>
                    <p className="text-slate-500">已选择 {selectedFiles.length} 个文件</p>
                  </div>
                  <button
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    清空列表
                  </button>
                </div>

                {/* 模式选择 - 视觉卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    onClick={() => !isProcessing && setTargetMode("original")}
                    className={`
                      relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300
                      ${targetMode === "original"
                        ? "bg-blue-50/80 border-blue-500 shadow-md backdrop-blur-sm"
                        : "bg-white/50 border-slate-200 hover:border-blue-300 hover:shadow-sm"
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${targetMode === "original" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={`text-lg font-bold mb-1 ${targetMode === "original" ? "text-blue-900" : "text-slate-700"}`}>保持原比例</h4>
                        <p className="text-sm text-slate-500">输出与原图尺寸一致，不做裁剪</p>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => !isProcessing && setTargetMode("ozon_3_4")}
                    className={`
                      relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300
                      ${targetMode === "ozon_3_4"
                        ? "bg-blue-50/80 border-blue-600 shadow-md backdrop-blur-sm"
                        : "bg-white/50 border-slate-200 hover:border-blue-300 hover:shadow-sm"
                      }
                    `}
                  >
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">推荐</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${targetMode === "ozon_3_4" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className={`text-lg font-bold mb-1 ${targetMode === "ozon_3_4" ? "text-blue-900" : "text-slate-700"}`}>Ozon 标准 (3:4)</h4>
                        <p className="text-sm text-slate-500">自动填充背景并调整为 3:4 比例，适合主图</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 状态与行动 */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    {status !== "idle" && (
                      <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 ${currentStatus.bg} ${currentStatus.color.replace('text-', 'border-').replace('600', '200')}`}>
                        {status === "processing" && <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                        <span className={`text-sm font-medium ${currentStatus.color}`}>{currentStatus.text}</span>
                      </div>
                    )}
                  </div>

                  {status === "idle" && (
                    <button
                      onClick={handleStartTranslation}
                      className="group relative px-8 py-4 bg-blue-600 rounded-xl overflow-hidden shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all duration-300 active:scale-95"
                    >
                      <span className="relative z-10 font-bold text-white text-lg flex items-center gap-2">
                        🚀 开始处理任务
                      </span>
                    </button>
                  )}
                </div>

                {errorMessage && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 翻译结果展示 */}
        {hasResults && (
          <div className="space-y-8 animate-fade-in">
            {/* 结果统计头 */}
            <div className="glass-panel rounded-3xl p-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">任务完成</h2>
                <div className="flex items-center gap-6 text-slate-500">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 成功 {successCount}</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> 失败 {translatedImages.length - successCount}</span>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleClearAll}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-all"
                >
                  返回首页
                </button>
                {successCount > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    下载全部结果
                  </button>
                )}
              </div>
            </div>

            {/* 图片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {translatedImages.map((image, index) => (
                <div
                  key={index}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                >
                  {image.status === "success" ? (
                    <>
                      <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                        <img
                          src={`/api/download/${image.file_path}`}
                          alt={image.translated_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6">
                          <button
                            onClick={() => handleDownloadImage(image)}
                            className="w-full py-3 rounded-xl bg-white text-slate-900 font-bold hover:bg-blue-50 transition-colors shadow-lg"
                          >
                            下载图片
                          </button>
                        </div>
                      </div>
                      <div className="p-4 border-t border-slate-100">
                        <p className="text-slate-700 text-sm truncate font-medium" title={image.original_name}>
                          {image.original_name}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">
                          已优化的 Ozon 图片
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-[3/4] bg-red-50 flex flex-col items-center justify-center p-6 text-center border-b border-red-100">
                      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className="text-red-600 font-medium mb-1">翻译失败</p>
                      <p className="text-red-400 text-xs">{image.error || "未知错误"}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
