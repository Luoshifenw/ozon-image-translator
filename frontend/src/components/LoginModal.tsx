
import { useState } from "react";
import axios from "axios";

interface LoginModalProps {
    onLoginSuccess: (token: string, quota: number) => void;
}

export function LoginModal({ onLoginSuccess }: LoginModalProps) {
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!code.trim()) return;

        setLoading(true);
        setError("");

        try {
            const response = await axios.post("/api/auth/verify", { code: code.trim() });
            const { token, remaining_quota } = response.data;

            // 保存 token 到本地存储
            localStorage.setItem("auth_token", token);

            // 回调以更新 App 状态
            onLoginSuccess(token, remaining_quota);

        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                setError(err.response.data.detail || "验证失败，请检查邀请码");
            } else {
                setError("网络错误，请稍后重试");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-slate-200">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4 text-blue-600">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">请输入邀请码</h2>
                    <p className="text-slate-500 mt-2">此服务仅限受邀用户使用</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="请输入您的专属邀请码"
                            className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-center text-lg font-bold tracking-widest placeholder:font-normal placeholder:tracking-normal transition-all"
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? "验证中..." : "解锁访问"}
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-xs">
                        需要邀请码？请联系管理员获取 access key
                    </p>
                </div>
            </div>
        </div>
    );
}
