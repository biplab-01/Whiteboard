import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { BookOpen, Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';

export const Auth = () => {
  const { setShowAuthModal } = useAuthStore();
  const [isLogin, setIsLogin] = useState(false); // default to Sign up as requested
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: supaError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (supaError) {
          setError(supaError.message);
          return;
        }
        if (data.session) {
          setShowAuthModal(false);
        }
      } else {
        const { data, error: supaError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (supaError) {
          setError(supaError.message);
          return;
        }

        // If email confirmation is enabled on Supabase, session will be null and confirmation_sent_at is present
        if (data.user && !data.session) {
          setConfirmationSent(true);
          return;
        }

        if (data.session) {
          setShowAuthModal(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center text-white w-full">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 mt-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <BookOpen size={24} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-1 text-white">
          {confirmationSent ? 'Check your email' : isLogin ? 'Welcome back' : 'Create an account'}
        </h2>
        <p className="text-center text-gray-400 mb-6 text-xs">
          {confirmationSent
            ? `We sent a confirmation link to ${email}. Please check your inbox (and spam folder) to verify your account.`
            : isLogin
            ? 'Enter your details to access your notebooks.'
            : 'Sign up to start organizing and exporting your ideas.'}
        </p>

        {confirmationSent ? (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
              <p className="text-xs text-indigo-300 mb-2">
                Once verified, you can sign in directly with your email and password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setConfirmationSent(false);
                setIsLogin(true);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleAuth} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#121422] border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-gray-300">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-[#121422] border border-gray-700/80 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono tracking-wider"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 mt-2 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>{isLogin ? 'Sign in' : 'Create Account'}</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-xs">
              <span className="text-gray-400">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </span>
              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
