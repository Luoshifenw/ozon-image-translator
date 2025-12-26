
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-lg shadow-blueprint-lg border border-slate-300 p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 mb-4 border border-blue-100 text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
                    <p className="text-slate-500 text-sm mt-1">Please enter your access code to proceed.</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="ACCESS CODE"
                            className="w-full px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-center font-mono text-lg tracking-widest placeholder:text-slate-300 transition-all bg-slate-50 focus:bg-white"
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs text-center font-medium font-mono">
                            ERROR: {error}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-3 rounded-md bg-blue-600 text-white font-bold text-sm shadow-sm hover:bg-blue-700 active:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "VERIFYING..." : "AUTHENTICATE"}
                    </button>
                </div>

                <div className="mt-8 text-center border-t border-slate-100 pt-4">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">
                        Authorized Personnel Only
                    </p>
                </div>
            </div>
        </div>
    );
}
