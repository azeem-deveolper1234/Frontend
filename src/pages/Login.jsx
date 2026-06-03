import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { HeartPulse, Mail, Lock, ArrowRight, AlertCircle, Loader2, Users, Star, Clock } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(formData);
      loginUser(res.data.user, res.data.token);
      if (res.data.user.role === 'superadmin' || res.data.user.role === 'doctor') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      
      {/* LEFT COLUMN: Premium Clinical Hero Showcase (Visible on Large Screens) */}
      <div className="hidden lg:flex lg:col-span-7 bg-gradient-to-tr from-slate-900 via-teal-950 to-indigo-950 relative flex-col justify-between p-12 text-white overflow-hidden">
        {/* Dynamic backdrop reflection grids */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
        <div className="absolute -top-[20%] -left-[10%] w-[40rem] h-[40rem] rounded-full bg-teal-500/10 opacity-60 blur-3xl"></div>
        <div className="absolute top-[40%] -right-[15%] w-[40rem] h-[40rem] rounded-full bg-indigo-500/10 opacity-60 blur-3xl"></div>
        
        {/* Logo and Brand Header */}
        <div className="flex items-center gap-3 relative z-10">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-12 h-12 bg-teal-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-glow"
          >
            <HeartPulse className="w-6 h-6 text-teal-400" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">City Medical</h1>
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest leading-none">Smart Queue Center</span>
          </div>
        </div>

        {/* Hero Central Branding Message */}
        <div className="my-auto space-y-6 relative z-10 max-w-xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </span>
            Real-time Queue Updates enabled
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4.5xl font-black leading-[1.1] tracking-tight"
          >
            Smarter patient visits, <br/>
            <span className="shimmer-text">zero waiting anxiety.</span>
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-slate-300 font-medium leading-relaxed text-[15px]"
          >
            No need to wait in long, exhausting queues. Join the live clinic queue from home, track your token in real-time, and get estimated arrival alerts straight to your device.
          </motion.p>

          {/* Glowing Metrics Cards Grid */}
          <div className="grid grid-cols-3 gap-4 pt-6">
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white/5 backdrop-blur-sm border border-white/5 p-4 rounded-2xl"
            >
              <Users className="w-5 h-5 text-teal-400 mb-2" />
              <div className="text-2xl font-black tracking-tight">10k+</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tokens Served</div>
            </motion.div>
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white/5 backdrop-blur-sm border border-white/5 p-4 rounded-2xl"
            >
              <Star className="w-5 h-5 text-amber-400 mb-2" />
              <div className="text-2xl font-black tracking-tight">99.8%</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Care Quality</div>
            </motion.div>
            <motion.div 
              whileHover={{ y: -4 }}
              className="bg-white/5 backdrop-blur-sm border border-white/5 p-4 rounded-2xl"
            >
              <Clock className="w-5 h-5 text-sky-400 mb-2" />
              <div className="text-2xl font-black tracking-tight">~15m</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Avg Wait</div>
            </motion.div>
          </div>
        </div>

        {/* Footer Brand tagline */}
        <p className="text-slate-500 text-xs font-semibold tracking-wide relative z-10">
          © 2026 City Medical Clinic. Engineered for perfect health journeys.
        </p>
      </div>

      {/* RIGHT COLUMN: Modern High-Fidelity Login Form Panel */}
      <div className="lg:col-span-5 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 relative">
        {/* Background bubbles */}
        <div className="absolute top-[10%] right-[10%] w-60 h-60 rounded-full bg-teal-500/5 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[10%] left-[10%] w-72 h-72 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[24rem] space-y-8 z-10"
        >
          {/* Header Mobile Brand (Only on Mobile) */}
          <div className="flex lg:hidden flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20 shadow-glow">
              <HeartPulse className="w-6 h-6 text-primary-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">City Medical Clinic</h1>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Smart Queue Center</p>
          </div>

          {/* Form Header */}
          <div className="text-left">
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">Welcome Back</h2>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold mt-2">Sign in to manage your health journey</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-500/20 text-red-700 dark:text-red-300 p-4 rounded-2xl flex items-start gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-600" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-500 focus:border-transparent dark:focus:border-transparent focus:bg-white dark:focus:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-100 font-medium transition duration-200 text-[14px]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center pl-1">
                <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-600" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-500 focus:border-transparent dark:focus:border-transparent focus:bg-white dark:focus:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-100 font-medium transition duration-200 text-[14px]"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-4 rounded-2xl font-extrabold text-sm hover:bg-primary-600 hover:shadow-glow hover:shadow-primary-500/20 active:bg-primary-700 transition duration-300 disabled:opacity-70 disabled:pointer-events-none flex justify-center items-center gap-2 group pt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </motion.button>
          </form>

          {/* Switch Action */}
          <div className="text-center pt-2">
            <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold">
              New to our clinic?{' '}
              <Link to="/register" className="text-primary-500 dark:text-primary-400 font-extrabold hover:text-primary-600 dark:hover:text-primary-300 underline underline-offset-2 transition-colors ml-1">
                Create an account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

    </div>
  );
};

export default Login;
