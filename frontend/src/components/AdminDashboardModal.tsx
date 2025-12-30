import { useState } from "react";

interface Metrics {
    total_users: number;
    dau: number;
    paid_amount: number;
}

interface AdminDashboardModalProps {
    onClose: () => void;
    onLoad: () => Promise<Metrics>;
}

export function AdminDashboardModal({ onClose, onLoad }: AdminDashboardModalProps) {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLoad = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await onLoad();
            setMetrics(data);
        } catch (err) {
            setError("没有权限或加载失败");
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
                    <p className="text-sm text-slate-500 mt-1">仅管理员账号可查看核心指标</p>
                </div>
                <div className="mb-6">
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
