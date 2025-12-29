
import { useState } from "react";
import axios from "axios";

interface LoginModalProps {
    onLoginSuccess: (token: string, credits: number) => void;
}

type ActiveTab = "login" | "register";

export function LoginModal({ onLoginSuccess }: LoginModalProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) return;

        setLoading(true);
        setError("");

        try {
            if (activeTab === "register") {
                const response = await axios.post("/api/auth/register", {
                    email: email.trim(),
                    password: password.trim(),
                    invite_code: inviteCode.trim() || undefined,
                });
                const { token, credits } = response.data;
                localStorage.setItem("auth_token", token);
                onLoginSuccess(token, credits);
            } else {
                const response = await axios.post("/api/auth/token", {
                    email: email.trim(),
                    password: password.trim(),
                });
                const { token, credits } = response.data;
                localStorage.setItem("auth_token", token);
                onLoginSuccess(token, credits);
            }
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                setError(err.response.data.detail || "登录失败，请检查输入");
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
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 mb-4 border border-blue-100 text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">账户中心</h2>
                    <p className="text-slate-500 text-sm mt-1">登录或注册后开始使用</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-6">
                    <button
                        onClick={() => {
                            setActiveTab("login");
                            setError("");
                        }}
                        className={`py-2 rounded-md text-sm font-bold transition-all ${activeTab === "login"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                    >
                        登录
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("register");
                            setError("");
                        }}
                        className={`py-2 rounded-md text-sm font-bold transition-all ${activeTab === "register"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                    >
                        注册
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">邮箱</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            className="w-full px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        />
                    </div>
                    {activeTab === "register" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">邀请码（可选）</label>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder="填写有效邀请码可获赠 100 积分"
                                className="w-full px-4 py-3 rounded-md border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            />
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-xs text-center font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3 rounded-md bg-blue-600 text-white font-bold text-sm shadow-sm hover:bg-blue-700 active:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "处理中..." : activeTab === "register" ? "创建账户" : "登录系统"}
                    </button>
                </div>

                <div className="mt-8 text-center border-t border-slate-100 pt-4">
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider">
                        Secure Access Required
                    </p>
                </div>
            </div>
        </div>
    );
}
