"use client";
import { useState } from "react";
import { useGame } from "@/lib/game-store";
import { Crosshair, Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function Auth() {
  const { setSession, setPlayerKey, setScreen, setAuthState } = useGame();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (tab === "register") body.name = name;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Authentication failed");
        return;
      }
      // account confirmed — switch playerKey to the account's persisted profile
      try { localStorage.setItem("vanguard_player_key", data.playerKey); } catch {}
      setPlayerKey(data.playerKey);
      setSession({ email: data.email, name: data.name, playerKey: data.playerKey });
      setAuthState("authenticated");
      setScreen("menu");
    } catch (err) {
      // Round 20a: Show a more helpful error. The old "Network error" message
      // was misleading — it fired for ANY fetch failure, including DB errors
      // (which return a 503 JSON response that res.json() can parse). Now we
      // check if the error is a TypeError (actual network failure) vs other.
      const isNetwork = err instanceof TypeError;
      toast.error(isNetwork ? "Network error — check your connection" : "Server error — please retry");
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    setAuthState("guest");
    setScreen("menu");
    toast("Playing as guest — progress stays on this device only", { description: "Create an account anytime to sync across devices." });
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#07090c]">
      {/* animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-amber-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full bg-rose-600/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      <main className="relative flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* logo */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/40">
                <Crosshair className="w-7 h-7 text-white" />
                <div className="absolute inset-0 rounded-xl ring-1 ring-white/20" />
              </div>
            </div>
            <h1 className="text-3xl font-black tracking-[0.25em] text-white">VANGUARD</h1>
            <p className="text-[11px] tracking-[0.5em] text-amber-400/80 mt-1">OPS · CLASSIFIED</p>
          </div>

          {/* card */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur-xl p-6 shadow-2xl">
            {/* tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 mb-5">
              <button
                onClick={() => setTab("login")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "login" ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white/80"}`}
              >
                <LogIn className="w-4 h-4" /> Sign In
              </button>
              <button
                onClick={() => setTab("register")}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "register" ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white/80"}`}
              >
                <UserPlus className="w-4 h-4" /> Register
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {tab === "register" && (
                <Field icon={<User className="w-4 h-4" />} label="Callsign">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={20}
                    placeholder="e.g. Ghost-01"
                    className="w-full bg-transparent text-white placeholder:text-white/30 outline-none text-sm"
                  />
                </Field>
              )}
              <Field icon={<Mail className="w-4 h-4" />} label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="operatives@example.com"
                  className="w-full bg-transparent text-white placeholder:text-white/30 outline-none text-sm"
                />
              </Field>
              <Field icon={<Lock className="w-4 h-4" />} label="Password">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-white placeholder:text-white/30 outline-none text-sm"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="text-white/40 hover:text-white/70">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </Field>

              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold tracking-wide">
                {loading ? "Authenticating…" : tab === "login" ? "Deploy" : "Create Account"}
              </Button>
            </form>

            {/* divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={continueAsGuest}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all"
            >
              Continue as Guest <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-center text-[11px] text-white/30 mt-4 leading-relaxed">
            Accounts persist your level, unlocks & loadouts across devices.<br />Guest progress is stored only in this browser.
          </p>
        </div>
      </main>

      <footer className="relative border-t border-white/10 py-3 text-center text-[11px] text-white/30">
        VANGUARD OPS · Browser FPS · Secure credentials auth
      </footer>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">{label}</span>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-black/40 border border-white/10 focus-within:border-amber-500/50 transition-colors">
        <span className="text-amber-400/70">{icon}</span>
        {children}
      </div>
    </label>
  );
}
