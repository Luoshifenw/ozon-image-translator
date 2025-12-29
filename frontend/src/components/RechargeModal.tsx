import { useState } from "react";

export interface RechargePackage {
    id: string;
    name: string;
    credits: number;
    price: number;
    description: string;
}

interface RechargeModalProps {
    packages: RechargePackage[];
    onClose: () => void;
    onPurchase: (packageId: string) => Promise<void>;
}

export function RechargeModal({ packages, onClose, onPurchase }: RechargeModalProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handlePurchase = async (packageId: string) => {
        setLoadingId(packageId);
        try {
            await onPurchase(packageId);
        } finally {
            setLoadingId(null);
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
                    <h3 className="text-xl font-bold text-slate-900">选择充值套餐</h3>
                    <p className="text-sm text-slate-500 mt-1">选择合适的方案，立即获得积分</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {packages.map((pkg) => (
                        <div
                            key={pkg.id}
                            className="border border-slate-200 rounded-lg p-5 bg-slate-50/40 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-slate-700">{pkg.name}</span>
                                <span className="text-xs font-mono text-slate-400">{pkg.credits} 积分</span>
                            </div>
                            <div className="text-2xl font-bold text-slate-900 mb-1">
                                ¥{pkg.price.toFixed(2)}
                            </div>
                            <p className="text-xs text-slate-500 mb-4">{pkg.description}</p>
                            <button
                                onClick={() => handlePurchase(pkg.id)}
                                disabled={loadingId === pkg.id}
                                className="mt-auto w-full py-2 rounded-md bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {loadingId === pkg.id ? "跳转支付..." : "立即购买"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
