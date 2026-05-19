import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, ChevronUp, Clock, 
  Volume2, VolumeX, AlertTriangle, CheckCircle, Info 
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
  const triggerAudioChime = () => {
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
  };

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
  }, [currentServing, peopleAhead, status, queueStatus]);

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

  // Proximity Alert Config
  const getProximityConfig = () => {
    if (status === 'serving' || peopleAhead === 0) {
      return {
        themeColor: 'green',
        accentBg: 'bg-green-50/90 border-green-200 text-green-700',
        dotColor: 'bg-green-500',
        badge: 'Your Turn',
        alertMsg: 'Please proceed inside now! 🏃‍♂️',
        icon: CheckCircle,
        headerBg: 'bg-gradient-to-r from-green-500 to-emerald-600',
        badgeBg: 'bg-green-100 text-green-800'
      };
    }
    if (peopleAhead <= 2) {
      return {
        themeColor: 'red',
        accentBg: 'bg-red-50/90 border-red-200 text-red-700',
        dotColor: 'bg-red-500',
        badge: 'Very Close',
        alertMsg: 'Turn is extremely near. Be ready outside!',
        icon: AlertTriangle,
        headerBg: 'bg-gradient-to-r from-red-500 to-rose-600',
        badgeBg: 'bg-red-100 text-red-800'
      };
    }
    if (peopleAhead <= 5) {
      return {
        themeColor: 'amber',
        accentBg: 'bg-amber-50/90 border-amber-200 text-amber-700',
        dotColor: 'bg-amber-500',
        badge: 'Approaching',
        alertMsg: 'Your turn is coming up soon.',
        icon: Info,
        headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        badgeBg: 'bg-amber-100 text-amber-800'
      };
    }
    return {
      themeColor: 'blue',
      accentBg: 'bg-blue-50/90 border-blue-100 text-blue-700',
      dotColor: 'bg-blue-500',
      badge: 'Waiting',
      alertMsg: 'Waiting in queue.',
      icon: Info,
      headerBg: 'bg-gradient-to-r from-slate-700 to-slate-800',
      badgeBg: 'bg-slate-100 text-slate-700'
    };
  };

  const config = getProximityConfig();
  const IconComponent = config.icon;

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl py-3 px-4 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
        onClick={() => setIsMinimized(false)}
      >
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dotColor}`}></span>
        </span>
        <div className="text-xs font-semibold text-slate-700">
          Token #{yourToken} <span className="text-slate-400">|</span> {peopleAhead} Ahead
        </div>
        <ChevronUp className="w-4 h-4 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-[2rem] overflow-hidden transition-all duration-300 transform hover:shadow-glow">
      {/* Header bar */}
      <div className={`${config.headerBg} p-4 text-white flex justify-between items-center relative overflow-hidden`}>
        <div className="absolute inset-0 bg-white/5 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
        <div className="flex items-center gap-2 relative z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">Live Queue Card</span>
        </div>
        
        <div className="flex items-center gap-2 relative z-10">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="p-1 hover:bg-white/10 rounded-md transition"
            title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-white/10 rounded-md transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body details */}
      <div className="p-5 space-y-4">
        {/* Proximity alert box */}
        <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${config.accentBg}`}>
          <IconComponent className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider leading-none mb-1">
              {config.badge}
            </div>
            <p className="text-xs font-semibold leading-relaxed">
              {config.alertMsg}
            </p>
          </div>
        </div>

        {/* Doctor and token info */}
        <div>
          <h4 className="text-[15px] font-bold text-slate-800 leading-tight">Dr. {serviceName || 'Specialist'}</h4>
          <p className="text-slate-400 text-xs font-medium mt-1">Real-time tracker for your visit</p>
        </div>

        {/* Main token stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl text-center">
            <div className="text-3xl font-black text-slate-800">{yourToken}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Your Token</div>
          </div>
          <div className="bg-primary-50/50 border border-primary-100/50 p-3.5 rounded-2xl text-center">
            <div className="text-3xl font-black text-primary-600">{currentServing}</div>
            <div className="text-[10px] font-bold text-primary-500 uppercase tracking-wider mt-1">Serving Now</div>
          </div>
        </div>

        {/* Wait and arrival detail */}
        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Remaining Ahead:</span>
            <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              {peopleAhead} patients
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-500">Est. Wait Time:</span>
            <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
              {estimatedTime} mins
            </span>
          </div>
          <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/50">
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Expected Arrival:
            </span>
            <span className="font-extrabold text-primary-600">
              {getExpectedArrival()}
            </span>
          </div>
        </div>

        {/* Cancel queue option inside the card */}
        <button
          onClick={onCancel}
          className="w-full text-center text-red-500 hover:text-red-600 font-bold text-xs py-1.5 transition"
        >
          Cancel Appointment
        </button>
      </div>
    </div>
  );
}
