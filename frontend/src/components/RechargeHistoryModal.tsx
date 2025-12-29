import { useMemo } from "react";

export interface OrderRecord {
    out_trade_no: string;
    amount: number;
    credits: number;
    status: string;
    created_at: string;
    paid_at?: string | null;
}

interface RechargeHistoryModalProps {
    orders: OrderRecord[];
    loading: boolean;
    error: string;
    onClose: () => void;
    onRetry: () => void;
}

export function RechargeHistoryModal({
    orders,
    loading,
    error,
    onClose,
    onRetry,
}: RechargeHistoryModalProps) {
    const hasOrders = useMemo(() => orders.length > 0, [orders.length]);

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
                    <h3 className="text-xl font-bold text-slate-900">充值记录</h3>
                    <p className="text-sm text-slate-500 mt-1">查看每笔订单金额与到账积分</p>
                </div>

                {loading && (
                    <div className="text-sm text-slate-500">正在加载记录...</div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md p-3 flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={onRetry}
                            className="text-xs font-bold text-red-600 hover:text-red-700"
                        >
                            重试
                        </button>
                    </div>
                )}

                {!loading && !error && !hasOrders && (
                    <div className="text-sm text-slate-500">暂无充值记录</div>
                )}

                {!loading && !error && hasOrders && (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                        {orders.map((order) => (
                            <div
                                key={order.out_trade_no}
                                className="border border-slate-200 rounded-lg p-4 bg-slate-50/40"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">
                                            ¥{order.amount.toFixed(2)} / {order.credits} 积分
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            订单号: {order.out_trade_no}
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs font-bold px-2 py-1 rounded ${order.status === "paid"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-700"
                                            }`}
                                    >
                                        {order.status === "paid" ? "已支付" : "待支付"}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-2">
                                    创建时间: {new Date(order.created_at).toLocaleString()}
                                    {order.paid_at && (
                                        <span className="ml-3">
                                            支付时间: {new Date(order.paid_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
