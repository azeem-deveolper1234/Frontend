import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronUp, Clock, Users, Hourglass,
  Volume2, VolumeX, AlertTriangle, CheckCircle2, Info 
} from 'lucide-react';

export default function LiveQueueCard({ queueStatus, onCancel }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('queue-card-muted') === 'true';
  });

  // Save mute preference
  useEffect(() => {
    localStorage.setItem('queue-card-muted', isMuted);
  }, [isMuted]);

  const { yourToken, currentServing, peopleAhead, estimatedTime, serviceName, status } = queueStatus || {};

  // Synthesized Sound Alerts
  const triggerAudioChime = useCallback(() => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Play a beautiful dual-tone chime
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.type = 'sine';
      osc2.type = 'sine';

      // 5th harmony pitch
      if (peopleAhead === 0) {
        osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc2.frequency.setValueAtTime(1109, audioCtx.currentTime); // C#6
      } else {
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc2.frequency.setValueAtTime(739.99, audioCtx.currentTime); // F#5
      }

      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc1.start();
      osc2.start();
      osc1.stop(audioCtx.currentTime + 0.55);
      osc2.stop(audioCtx.currentTime + 0.55);
    } catch (e) {
      console.log('Audio Context Error:', e);
    }
  }, [isMuted, peopleAhead]);

  // Vibrate mobile browser near turn
  const triggerVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  // Handle live status alerts on update
  useEffect(() => {
    if (queueStatus && peopleAhead !== undefined && peopleAhead <= 3) {
      triggerAudioChime();
      triggerVibrate();
    }
  }, [currentServing, peopleAhead, status, queueStatus, triggerAudioChime]);

  if (!queueStatus) return null;

  // Expected Arrival Calculation
  const getExpectedArrival = () => {
    if (estimatedTime < 0) return 'N/A';
    const arrival = new Date(Date.now() + estimatedTime * 60 * 1000);
    return arrival.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Proximity Alert Config with premium colors and custom dark-mode support
  const getProximityConfig = () => {
    if (status === 'serving' || peopleAhead === 0) {
      return {
        themeColor: 'emerald',
        shadowGlow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]',
        accentBg: 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        dotColor: 'bg-emerald-500',
        badge: 'Your Turn',
        alertMsg: 'Your turn has arrived! Proceed inside now. 🏃‍♂️',
        icon: CheckCircle2,
        headerBg: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600',
        badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300',
        progressBarBg: 'from-emerald-400 to-teal-500'
      };
    }
    if (peopleAhead <= 2) {
      return {
        themeColor: 'rose',
        shadowGlow: 'shadow-[0_0_30px_rgba(244,63,94,0.3)]',
        accentBg: 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-500/20 text-rose-700 dark:text-rose-300',
        dotColor: 'bg-rose-500',
        badge: 'Very Close',
        alertMsg: 'Your turn is extremely close. Be ready outside! 🚨',
        icon: AlertTriangle,
        headerBg: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600',
        badgeBg: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300',
        progressBarBg: 'from-rose-400 to-pink-500'
      };
    }
    if (peopleAhead <= 5) {
      return {
        themeColor: 'amber',
        shadowGlow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
        accentBg: 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-500/20 text-amber-700 dark:text-amber-300',
        dotColor: 'bg-amber-500',
        badge: 'Approaching',
        alertMsg: 'Your turn is approaching. Be ready shortly.',
        icon: Info,
        headerBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600',
        badgeBg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300',
        progressBarBg: 'from-amber-400 to-orange-500'
      };
    }
    return {
      themeColor: 'indigo',
      shadowGlow: 'shadow-[0_0_30px_rgba(99,102,241,0.2)]',
      accentBg: 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300',
      dotColor: 'bg-indigo-500',
      badge: 'Waiting',
      alertMsg: 'You are currently in the queue. Please wait patiently.',
      icon: Info,
      headerBg: 'bg-gradient-to-r from-slate-800 via-indigo-950 to-slate-900',
      badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
      progressBarBg: 'from-indigo-400 to-blue-500'
    };
  };

  const config = getProximityConfig();
  const IconComponent = config.icon;

  // Calculate dynamic progress percentage
  // We assume max queue lookahead is 10 for visual tracking
  const progressPercent = Math.min(100, Math.max(15, 100 - (peopleAhead * 10)));

  return (
    <AnimatePresence>
      {isMinimized ? (
        <motion.div
          key="minimized-pill"
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 ${config.shadowGlow} rounded-2xl py-3.5 px-5 cursor-pointer select-none`}
          onClick={() => setIsMinimized(false)}
        >
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dotColor}`}></span>
          </span>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            Token #{yourToken} <span className="text-slate-300 dark:text-slate-700 mx-1">|</span> <span className="text-slate-500 dark:text-slate-400">{peopleAhead} Ahead</span>
          </div>
          <ChevronUp className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors" />
        </motion.div>
      ) : (
        <motion.div
          key="maximized-card"
          initial={{ opacity: 0, scale: 0.9, y: 80 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 80 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className={`fixed bottom-6 right-6 z-50 w-85 bg-white/80 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/50 dark:border-slate-800/80 ${config.shadowGlow} rounded-[2rem] overflow-hidden select-none shadow-2xl`}
        >
          {/* Top Header Section */}
          <div className={`${config.headerBg} p-5 text-white flex justify-between items-center relative overflow-hidden`}>
            {/* Design grid pattern background */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
            
            <div className="flex items-center gap-2.5 relative z-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/90">Live Queue Tracker</span>
            </div>
            
            <div className="flex items-center gap-1.5 relative z-10">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMuted(!isMuted)} 
                className="p-2 hover:bg-white/10 rounded-xl transition duration-200"
                title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-white/90" /> : <Volume2 className="w-4 h-4 text-white/90" />}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-white/10 rounded-xl transition duration-200"
              >
                <ChevronDown className="w-4 h-4 text-white/90" />
              </motion.button>
            </div>
          </div>

          {/* Main Card Body */}
          <div className="p-6 space-y-5">
            {/* Dynamic Banner Alert Box */}
            <motion.div 
              layoutId="proximity-banner"
              className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all duration-300 ${config.accentBg}`}
            >
              <div className={`p-2 rounded-xl bg-white dark:bg-slate-900 shadow-sm text-${config.themeColor}-500 shrink-0`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider leading-none mb-1 text-slate-500 dark:text-slate-400">
                  Status: <span className={`px-2 py-0.5 rounded-full font-bold ml-1 ${config.badgeBg}`}>{config.badge}</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  {config.alertMsg}
                </p>
              </div>
            </motion.div>

            {/* Specialist Doctor Info */}
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
                  Dr. {serviceName || 'Specialist Doctor'}
                </h4>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold mt-0.5 tracking-wide">
                  Clinic Consultation Queue
                </p>
              </div>
            </div>

            {/* Custom Interactive Linear Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                <span>Serving</span>
                <span>You</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full bg-gradient-to-r ${config.progressBarBg} rounded-full absolute left-0 top-0`}
                />
              </div>
            </div>

            {/* Big Statistics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 p-4 rounded-[1.25rem] text-center shadow-sm relative group hover:border-slate-200/80 dark:hover:border-slate-700/80 transition duration-300">
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight group-hover:scale-105 transition-transform duration-300">{yourToken}</div>
                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Your Token</div>
              </div>
              <div className="bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-500/10 p-4 rounded-[1.25rem] text-center shadow-sm relative group hover:border-indigo-200/40 dark:hover:border-indigo-500/20 transition duration-300">
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight group-hover:scale-105 transition-transform duration-300">{currentServing}</div>
                <div className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">Serving Now</div>
              </div>
            </div>

            {/* Detailed Table Rows */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 p-4.5 rounded-[1.25rem] space-y-3.5 shadow-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" /> Remaining Ahead:
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-3 py-1 rounded-xl shadow-xs">
                  {peopleAhead} patients
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-slate-400 shrink-0" /> Est. Wait Time:
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-3 py-1 rounded-xl shadow-xs">
                  {estimatedTime} mins
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-3.5 border-t border-slate-200/60 dark:border-slate-800/80">
                <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500/80 shrink-0" /> Expected Arrival:
                </span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                  {getExpectedArrival()}
                </span>
              </div>
            </div>

            {/* Cancel appointment interactive action */}
            <div className="pt-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="w-full text-center text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-extrabold text-xs py-3.5 rounded-2xl bg-rose-50/30 hover:bg-rose-50/80 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 border border-rose-200/20 hover:border-rose-200/40 dark:border-rose-500/10 dark:hover:border-rose-500/20 transition-all duration-300"
              >
                Cancel Appointment
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
