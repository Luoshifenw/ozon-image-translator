import { useState } from "react";

interface Metrics {
    total_users: number;
    dau: number;
    paid_amount: number;
}

interface AdminDashboardModalProps {
    onClose: () => void;
    onLoad: (token: string) => Promise<Metrics>;
}

export function AdminDashboardModal({ onClose, onLoad }: AdminDashboardModalProps) {
    const [token, setToken] = useState("");
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLoad = async () => {
        if (!token.trim()) {
            setError("请输入管理员令牌");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const data = await onLoad(token.trim());
            setMetrics(data);
        } catch (err) {
            setError("获取数据失败，请检查令牌");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-blueprint-lg border border-slate-200 p-8 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="关闭"
                >
                    ✕
                </button>
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-900">数据看板</h3>
                    <p className="text-sm text-slate-500 mt-1">输入管理员令牌查看核心指标</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ADMIN_TOKEN"
                        className="flex-1 px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                    />
                    <button
                        onClick={handleLoad}
                        disabled={loading}
                        className="px-5 py-3 rounded-md bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
                    >
                        {loading ? "加载中..." : "查看数据"}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md p-3 mb-4">
                        {error}
                    </div>
                )}

                {metrics && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
                            <div className="text-xs text-slate-500">总用户</div>
                            <div className="text-2xl font-bold text-slate-900">{metrics.total_users}</div>
                        </div>
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
                            <div className="text-xs text-slate-500">DAU</div>
                            <div className="text-2xl font-bold text-slate-900">{metrics.dau}</div>
                        </div>
                        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40">
                            <div className="text-xs text-slate-500">付费金额</div>
                            <div className="text-2xl font-bold text-slate-900">¥{metrics.paid_amount.toFixed(2)}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
