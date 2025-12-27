import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { UploadZone } from "./components/UploadZone";
import { LoginModal } from "./components/LoginModal";

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

interface QuotaInfo {
  usage: number;
  limit: number;
  remaining: number;
}

type Status = "idle" | "uploading" | "processing" | "completed" | "error";

function App() {
  // Auth & Quota State
  const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"));
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  // Fetch Quota Logic
  const fetchQuota = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get<QuotaInfo>("/api/auth/quota", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuota(res.data);
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
        setToken(null);
        localStorage.removeItem("auth_token");
      }
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchQuota();
    }
  }, [token, fetchQuota]);

  const handleLoginSuccess = (newToken: string, _quotaLeft: number) => {
    setToken(newToken);
    fetchQuota();
  };
  // ... rest of state
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
          "Authorization": `Bearer ${token}`
        },
        timeout: 30000,
      });

      // Update quota after submission
      fetchQuota();

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

  // Status logic handled inline now or via simple helpers if needed

  const isProcessing = status === "uploading" || status === "processing";
  const hasResults = status === "completed" && translatedImages.length > 0;
  const successCount = translatedImages.filter(
    (img) => img.status === "success"
  ).length;

  return (
    <div className="min-h-screen font-sans selection:bg-aether-accent/30 selection:text-aether-dark">
      {/* Background handled in index.css */}

      <div className="relative max-w-6xl mx-auto px-6 py-16 z-10">
        {!token && <LoginModal onLoginSuccess={handleLoginSuccess} />}

        {/* Modern SaaS Header */}
        <header className="mb-16 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">System v2.1 Online</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            Ozon <span className="text-transparent bg-clip-text bg-gradient-to-r from-aether-accent to-amber-500">图片智能翻译</span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            专为跨境电商打造的自动化视觉流水线。
            <span className="block mt-2 text-slate-400 text-lg">智能排版 · 批量处理 · 无损画质</span>
          </p>

          {quota && (
            <div className="mt-8 inline-flex items-center justify-center gap-6 p-1 pr-6 bg-white rounded-full border border-slate-100 shadow-float">
              <div className="w-10 h-10 rounded-full bg-aether-accent flex items-center justify-center text-aether-dark shadow-glow">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">剩余额度</div>
                <div className="text-sm font-bold text-slate-900">{quota.remaining} <span className="text-slate-400 font-normal">/ {quota.limit}</span></div>
              </div>
            </div>
          )}
        </header>

        {/* Upload & Config Section */}
        {!hasResults && (
          <div className="space-y-10 max-w-4xl mx-auto">
            <div className="aether-card p-2">
              <UploadZone
                onFilesSelected={handleFilesSelected}
                disabled={isProcessing}
              />
            </div>

            {/* Configuration Panel */}
            {selectedFiles.length > 0 && (
              <div className="aether-card p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                    任务配置
                    <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{selectedFiles.length} 个文件</span>
                  </h3>
                  <button
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors"
                  >
                    清空列表
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    onClick={() => !isProcessing && setTargetMode("original")}
                    className={`
                      cursor-pointer relative p-6 rounded-2xl border-2 transition-all duration-300
                      ${targetMode === "original"
                        ? "border-aether-accent bg-amber-50/30 shadow-sm"
                        : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-bold text-lg ${targetMode === "original" ? "text-slate-900" : "text-slate-600"}`}>保持原比例</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${targetMode === "original" ? "border-aether-accent bg-aether-accent" : "border-slate-200"
                        }`}>
                        {targetMode === "original" && <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">不做裁剪，保持原图尺寸进行翻译。适合非标品或长图。</p>
                  </div>

                  <div
                    onClick={() => !isProcessing && setTargetMode("ozon_3_4")}
                    className={`
                      cursor-pointer relative p-6 rounded-2xl border-2 transition-all duration-300
                      ${targetMode === "ozon_3_4"
                        ? "border-aether-accent bg-amber-50/30 shadow-sm"
                        : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-bold text-lg ${targetMode === "ozon_3_4" ? "text-slate-900" : "text-slate-600"}`}>Ozon 标准 (3:4)</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${targetMode === "ozon_3_4" ? "border-aether-accent bg-aether-accent" : "border-slate-200"
                        }`}>
                        {targetMode === "ozon_3_4" && <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">自动填充背景并调整为 3:4。完全符合 Ozon 主图规范。</p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="mt-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${status === 'idle' ? 'bg-slate-100 text-slate-500' :
                      status === 'uploading' ? 'bg-amber-100 text-amber-700' :
                        status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${status === 'idle' ? 'bg-slate-400' :
                        status === 'uploading' ? 'bg-amber-500 animate-pulse' :
                          status === 'processing' ? 'bg-blue-500 animate-pulse' :
                            status === 'completed' ? 'bg-emerald-500' :
                              'bg-red-500'
                        }`}></span>
                      {status === 'idle' ? '等待就绪' :
                        status === 'uploading' ? '上传中...' :
                          status === 'processing' ? 'AI处理中' :
                            status === 'completed' ? '处理完成' :
                              '遇到错误'}
                    </div>

                    {isProcessing && (
                      <div className="text-sm font-mono text-slate-400">
                        {progress.processed} / {progress.total}
                      </div>
                    )}
                  </div>

                  {status === "idle" && (
                    <button
                      onClick={handleStartTranslation}
                      className="aether-btn-primary"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      立即开始处理
                    </button>
                  )}
                </div>
                {errorMessage && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Grid - Modern View */}
        {hasResults && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-bold text-slate-900">
                处理结果
              </h2>

              <div className="flex gap-4">
                <button
                  onClick={handleClearAll}
                  className="aether-btn-secondary py-2.5 px-5"
                >
                  开始新任务
                </button>
                {successCount > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    className="aether-btn-primary py-2.5 px-6 bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white shadow-emerald-200"
                  >
                    批量下载全部
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {translatedImages.map((image, index) => (
                <div
                  key={index}
                  className="aether-card aether-card-hover group flex flex-col h-full overflow-hidden"
                >
                  <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                    {image.status === "success" ? (
                      <>
                        <img
                          src={`/api/download/${image.file_path}`}
                          alt={image.translated_name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                          <button
                            onClick={() => handleDownloadImage(image)}
                            className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-float hover:scale-105 transition-transform"
                          >
                            下载图片
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-3">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <span className="text-sm text-slate-500 font-medium">{image.error || '处理失败'}</span>
                      </div>
                    )}

                    <div className="absolute top-3 left-3">
                      {image.status === 'success' ? (
                        <span className="aether-badge bg-emerald-400 text-emerald-900 shadow-sm">SUCCESS</span>
                      ) : (
                        <span className="aether-badge bg-red-100 text-red-600">FAILED</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-white flex-1 flex flex-col justify-end border-t border-slate-50">
                    <div className="font-medium text-slate-700 text-sm truncate" title={image.original_name}>
                      {image.original_name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      {targetMode === 'ozon_3_4' ? 'Ozon 3:4' : '原比例'}
                    </div>
                  </div>
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
