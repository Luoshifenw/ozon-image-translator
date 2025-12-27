
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-10 border border-white/70">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 mb-5 text-amber-500 shadow-sm border border-amber-100">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Access Required</h2>
                    <p className="text-slate-500 font-medium mt-2">Invites Only</p>
                </div>

                <div className="space-y-5">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="输入访问通行证"
                            className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-transparent focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 outline-none text-center font-bold text-lg tracking-widest placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal transition-all duration-300"
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 text-red-500 text-sm text-center font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-4 rounded-xl bg-aether-accent text-slate-900 font-bold text-base shadow-lg shadow-amber-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Verifying..." : "Enter Workspace"}
                    </button>
                </div>
            </div>
        </div>
    );
}
