import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { UploadZone } from "./components/UploadZone";
import { LoginModal } from "./components/LoginModal";
import { RechargeModal } from "./components/RechargeModal";
import type { RechargePackage } from "./components/RechargeModal";
import { RechargeHistoryModal } from "./components/RechargeHistoryModal";
import type { OrderRecord } from "./components/RechargeHistoryModal";
import { AdminDashboardModal } from "./components/AdminDashboardModal";
import { FilePreviewGrid } from "./components/FilePreviewGrid";

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

interface BalanceInfo {
  credits: number;
}

type Status = "idle" | "uploading" | "processing" | "completed" | "error";

function App() {
  // Auth & Quota State
  const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"));
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [contactNotice, setContactNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  // Fetch Quota Logic
  const fetchBalance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get<BalanceInfo>("/api/auth/quota", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalance(res.data);
    } catch (e) {
      if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
        setToken(null);
        setBalance(null);
        setIsAdmin(false);
        localStorage.removeItem("auth_token");
      }
    }
  }, [token]);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get<{ is_admin: boolean }>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsAdmin(res.data.is_admin);
    } catch {
      setIsAdmin(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchBalance();
    fetchMe();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [token, fetchBalance, fetchMe]);
  useEffect(() => {
    if (!token) {
      setBalance(null);
      setOrders([]);
      setIsAdmin(false);
    }
  }, [token]);

  const handleLogout = useCallback(() => {
    setToken(null);
    setBalance(null);
    setShowRecharge(false);
    setShowHistory(false);
    setShowAdmin(false);
    setIsAdmin(false);
    localStorage.removeItem("auth_token");
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const res = await axios.get<OrderRecord[]>("/api/payments/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setOrdersError(error.response.data.detail || "加载充值记录失败");
      } else {
        setOrdersError("加载充值记录失败，请稍后重试");
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (showHistory) {
      fetchOrders();
    }
  }, [showHistory, fetchOrders]);

  const fetchAdminMetrics = useCallback(async () => {
    const res = await axios.get<{ total_users: number; dau: number; paid_amount: number }>(
      "/api/admin/metrics",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }, [token]);

  // Handle ZPay Return URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tradeStatus = params.get("trade_status");
    const outTradeNo = params.get("out_trade_no");

    if (tradeStatus === "TRADE_SUCCESS" && outTradeNo) {
      // Convert params to plain object for axios
      const payload = Object.fromEntries(params.entries());

      // Call notify endpoint from frontend context
      axios.post("/api/payments/notify", payload, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      })
        .then(() => {
          // Success: Clear URL and refresh balance
          window.history.replaceState({}, "", "/dashboard");
          alert("充值成功！积分已到账。");
          fetchBalance();
        })
        .catch((err) => {
          console.error("Payment verification failed", err);
          // Optional: alert("支付验证失败，请联系客服");
        });
    }
  }, [fetchBalance]);

  const handleLoginSuccess = (newToken: string, _credits: number) => {
    setToken(newToken);
    fetchBalance();
    fetchMe();
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
  // 文件选择处理
  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
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

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, []);


  // 开始翻译（异步轮询版本）
  const handleStartTranslation = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    if (!token) {
      setErrorMessage("请先登录后再提交任务");
      return;
    }

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

      // Update balance after submission
      fetchBalance();

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
  }, [selectedFiles, targetMode, token, fetchBalance]);

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

  const handleCopyEmail = useCallback(async () => {
    const email = "haoze8962@gmail.com";
    try {
      await navigator.clipboard.writeText(email);
      setContactNotice("邮箱已复制");
      setTimeout(() => setContactNotice(""), 2000);
    } catch {
      setContactNotice("复制失败，请手动复制");
    }
  }, []);

  // Status logic handled inline now or via simple helpers if needed

  const isProcessing = status === "uploading" || status === "processing";
  const hasResults = status === "completed" && translatedImages.length > 0;
  const successCount = translatedImages.filter(
    (img) => img.status === "success"
  ).length;

  const rechargePackages: RechargePackage[] = [
    { id: "starter", name: "入门版", credits: 100, price: 9.9, description: "适合体验与轻量使用" },
    { id: "pro", name: "专业版", credits: 500, price: 39.9, description: "高频翻译的稳定之选" },
    { id: "enterprise", name: "企业版", credits: 2000, price: 129.9, description: "团队批量处理更划算" },
  ];

  const handlePurchase = async (packageId: string) => {
    if (!token) return;
    try {
      const response = await axios.post<{ payment_url: string }>(
        "/api/payments/create",
        { package_id: packageId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      window.location.href = response.data.payment_url;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setErrorMessage(error.response.data.detail || "充值创建失败");
      } else {
        setErrorMessage("充值创建失败，请稍后重试");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Blueprint Grid Background is handled in index.css body */}



      <div className="relative max-w-5xl mx-auto px-6 py-12 z-10">
        {!token && <LoginModal onLoginSuccess={handleLoginSuccess} />}
        {showRecharge && (
          <RechargeModal
            packages={rechargePackages}
            onClose={() => setShowRecharge(false)}
            onPurchase={handlePurchase}
          />
        )}
        {showHistory && (
          <RechargeHistoryModal
            orders={orders}
            loading={ordersLoading}
            error={ordersError}
            onClose={() => setShowHistory(false)}
            onRetry={fetchOrders}
          />
        )}
        {showAdmin && isAdmin && (
          <AdminDashboardModal
            onClose={() => setShowAdmin(false)}
            onLoad={fetchAdminMetrics}
          />
        )}

        {/* Technical Header */}
        <header className="mb-12 border-b border-slate-200 pb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-blue-600 rounded-sm"></span>
                <span className="text-xs font-bold tracking-wider text-blue-600 uppercase">System v2.1.0</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Ozon 图片智能翻译
              </h1>
              <p className="text-slate-500 mt-1 text-sm font-medium">
                自动化排版与翻译流水线
              </p>
            </div>

            {balance && (
              <div className="flex items-center gap-4 bg-white px-4 py-2 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">实时余额</div>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    {balance.credits} <span className="text-slate-400 text-sm font-normal">积分</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <button
                  onClick={() => setShowRecharge(true)}
                  className="ml-2 px-3 py-2 text-xs font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  充值
                </button>
                <button
                  onClick={() => setShowHistory(true)}
                  className="px-3 py-2 text-xs font-bold rounded-md border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors"
                >
                  充值记录
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-xs font-bold rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
                >
                  登出
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setShowAdmin(true)}
                    className="px-3 py-2 text-xs font-bold rounded-md border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
                  >
                    网站数据
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* 上传区域 */}
        {!hasResults && (
          <div className="space-y-8">
            <UploadZone
              onFilesSelected={handleFilesSelected}
              disabled={isProcessing}
            />

            {/* Staging Area / Preview Grid */}
            {selectedFiles.length > 0 && (
              <FilePreviewGrid
                files={selectedFiles}
                onRemove={handleRemoveFile}
                disabled={isProcessing}
              />
            )}

            {/* Configuration Panel */}
            {selectedFiles.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-600 rounded-sm"></span>
                    任务配置
                  </h3>
                  <button
                    onClick={handleClearAll}
                    disabled={isProcessing}
                    className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors"
                  >
                    清空列表
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => !isProcessing && setTargetMode("original")}
                    className={`
                      cursor-pointer relative p-4 rounded-lg border transition-all duration-200
                      ${targetMode === "original"
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700">保持原比例</span>
                      {targetMode === "original" && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">不做裁剪，保持原图尺寸进行翻译。</p>
                  </div>

                  <div
                    onClick={() => !isProcessing && setTargetMode("ozon_3_4")}
                    className={`
                      cursor-pointer relative p-4 rounded-lg border transition-all duration-200
                      ${targetMode === "ozon_3_4"
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-700">Ozon 标准 (3:4)</span>
                      {targetMode === "ozon_3_4" && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">自动填充背景并调整为 Ozon 推荐的 3:4 比例。</p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-mono font-bold rounded ${status === 'idle' ? 'bg-slate-100 text-slate-500' :
                      status === 'uploading' ? 'bg-yellow-100 text-yellow-700' :
                        status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                      }`}>
                      {status === 'idle' ? '等待就绪' :
                        status === 'uploading' ? '正在上传' :
                          status === 'processing' ? '处理中' :
                            status === 'completed' ? '已完成' :
                              '出错'}
                    </span>
                    {isProcessing && (
                      <span className="text-sm text-slate-500 font-mono">
                        {progress.processed}/{progress.total}
                      </span>
                    )}
                  </div>

                  {status === "idle" && (
                    <button
                      onClick={handleStartTranslation}
                      className="blueprint-btn-primary flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      运行任务
                    </button>
                  )}
                </div>
                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-center gap-2">
                    <span className="font-bold">错误:</span> {errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Results Grid - Technical View */}
        {hasResults && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-emerald-500 rounded-sm"></span>
                处理结果
              </h2>

              <div className="flex gap-3">
                <button
                  onClick={handleClearAll}
                  className="blueprint-btn-secondary text-sm"
                >
                  重置表格
                </button>
                {successCount > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    className="blueprint-btn-primary text-sm bg-emerald-600 hover:bg-emerald-700"
                  >
                    批量下载
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {translatedImages.map((image, index) => (
                <div
                  key={index}
                  className="blueprint-card blueprint-card-hover group flex flex-col h-full"
                >
                  <div className="relative aspect-[3/4] bg-slate-100 border-b border-slate-200 overflow-hidden rounded-t-lg">
                    {image.status === "success" ? (
                      <>
                        <img
                          src={`/api/download/${image.file_path}`}
                          alt={image.translated_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleDownloadImage(image)}
                            className="bg-white text-slate-900 px-4 py-2 rounded-md font-bold text-sm shadow-sm hover:bg-blue-50"
                          >
                            保存图片
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-2">!</div>
                        <span className="text-xs text-red-500 font-medium">{image.error || '失败'}</span>
                      </div>
                    )}

                    <div className="absolute top-2 left-2">
                      <span className={`blueprint-badge shadow-sm border ${image.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                        {image.status === 'success' ? 'SUCCESS' : 'FAILED'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-b-lg flex-1 flex flex-col justify-end">
                    <div className="text-xs font-mono text-slate-500 truncate" title={image.original_name}>
                      {image.original_name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                      OUTPUT: {targetMode === 'ozon_3_4' ? '3:4 FORMAT' : 'ORIGINAL'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 border-t border-slate-200 bg-white/70">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">联系我们</div>
            <div className="text-sm font-bold text-slate-800">haoze8962@gmail.com</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyEmail}
              className="px-4 py-2 text-xs font-bold rounded-md border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 transition-colors"
            >
              复制邮箱
            </button>
            <a
              href="mailto:haoze8962@gmail.com"
              className="px-4 py-2 text-xs font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              发送邮件
            </a>
            {contactNotice && (
              <span className="text-xs text-slate-400">{contactNotice}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
