import React, { useState, useEffect, useRef } from 'react';
import AppointmentReceipt from '../components/AppointmentReceipt';
import LiveQueueCard from '../components/LiveQueueCard';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, CalendarPlus, Clock, History, FileText, User, LogOut, 
  CheckCircle2, CreditCard, Wallet, AlertCircle, 
  RefreshCw, Activity, HeartPulse, ChevronRight, ShieldCheck, Banknote, Lock,
  Users, Hourglass, Calendar, Sparkles, FileDown, ShieldAlert
} from 'lucide-react';
import {
  getAllDoctors, joinQueue, getQueueStatus, cancelQueue, 
  getQueueHistory, getMyReports, createPayment, getPaymentHistory
} from '../services/api';

function localDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PatientDashboard = () => {
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [doctors, setDoctors] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  
  const [joinForm, setJoinForm] = useState({
    serviceName: '', priority: 'normal', appointmentDate: '', 
    notes: '', totalAmount: '', paymentMethod: 'cash'
  });

  const [showGateway, setShowGateway] = useState(false);
  const [gatewayStep, setGatewayStep] = useState('phone'); 
  const [gatewayPhone, setGatewayPhone] = useState('');
  const [gatewayOtp, setGatewayOtp] = useState('');
  const pendingBookingRef = useRef(null);
  const gatewayTimersRef = useRef([]);
  
  const clearGatewayTimers = () => {
    gatewayTimersRef.current.forEach((id) => clearTimeout(id));
    gatewayTimersRef.current = [];
  };

  const [payments, setPayments] = useState([]);

  useEffect(() => {
    fetchDoctors();
    fetchQueueStatus();

    const interval = setInterval(() => {
      fetchQueueStatus();
    }, 30000);

    socket.on('queueUpdated', (data) => {
      fetchQueueStatus();
      setMessage(`🔔 Token ${data.tokenNumber} called! Please be ready!`);
      if (Notification.permission === 'granted') {
        new Notification('City Medical Clinic', {
          body: `Token ${data.tokenNumber} called! Please be ready!`,
          icon: '🏥'
        });
      }
    });

    socket.on('queueCompleted', (data) => {
      fetchQueueStatus();
      setMessage(`✅ Checkup completed! Token: ${data.tokenNumber}. Thank you!`);
    });

    socket.on('queueCancelled', () => {
      fetchQueueStatus();
    });

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      clearInterval(interval);
      clearGatewayTimers();
      socket.off('queueUpdated');
      socket.off('queueCompleted');
      socket.off('queueCancelled');
    };
  }, []);
 
  const fetchDoctors = async () => {
    try {
      const res = await getAllDoctors();
      setDoctors(res.data);
    } catch (err) {}
  };

  const fetchQueueStatus = async () => {
    try {
      const res = await getQueueStatus();
      setQueueStatus(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setQueueStatus(null);
      }
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await getQueueHistory();
      setHistory(res.data.history);
    } catch (err) {}
  };

  const fetchPayments = async () => {
    try {
      const res = await getPaymentHistory();
      setPayments(res.data.payments);
    } catch (err) {}
  };

  const fetchReports = async () => {
    try {
      const res = await getMyReports();
      setReports(res.data.reports);
    } catch (err) {}
  };

  const processJoinQueue = async (formSnapshot) => {
    const form = formSnapshot || joinForm;
    const doctorObj = doctors.find((d) => d.name === form.serviceName);
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const queueRes = await joinQueue({
        serviceName: form.serviceName,
        priority: form.priority,
        appointmentDate: form.appointmentDate,
        notes: form.notes
      });

      const newQueueId = queueRes.data._id;
      const fee = Number(form.totalAmount) || (doctorObj && Number(doctorObj.consultationFee)) || 1000;

      if (newQueueId && doctorObj) {
        try {
          const pm = form.paymentMethod;
          const isWallet = pm === 'easypaisa' || pm === 'jazzcash';
          await createPayment({
            queueId: newQueueId,
            doctorId: doctorObj._id,
            totalAmount: fee,
            paymentMethod: isWallet ? 'online' : pm,
            ...(isWallet ? { walletChannel: pm } : {})
          });
        } catch (payErr) {
          try { await cancelQueue(); } catch (_) {}
          throw payErr;
        }
      }

      const bookedAt = new Date();
      const pm = form.paymentMethod;
      const paymentMethodLabels = {
        easypaisa: 'Easypaisa',
        jazzcash: 'JazzCash',
        card: 'Online Card',
        cash: 'Cash at clinic'
      };
      
      setReceiptData({
        tokenNumber: queueRes.data.tokenNumber,
        patientName: user.name,
        email: user.email,
        phone: user.phone || '',
        doctorName: form.serviceName,
        appointmentDate: form.appointmentDate,
        bookingTime: bookedAt.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }),
        priority: form.priority,
        notes: form.notes,
        totalAmount: doctorObj ? Number(doctorObj.consultationFee) || fee : fee,
        paymentMethod: pm,
        paymentMethodLabel: paymentMethodLabels[pm] || pm,
        paidViaLastDigits: form.paidViaLastDigits || null
      });

      setShowReceipt(true);
      fetchQueueStatus();
      setActiveTab('home');
      setJoinForm({
        serviceName: '', priority: 'normal', appointmentDate: '',
        notes: '', totalAmount: '', paymentMethod: 'cash'
      });
    } catch (err) {
      const apiMsg = err.response?.data?.message;
      setError(typeof apiMsg === 'string' ? apiMsg : apiMsg?.message || err.message || 'Booking failed');
      fetchQueueStatus();
    } finally {
      pendingBookingRef.current = null;
      setLoading(false);
      setShowGateway(false);
      setGatewayStep('phone');
      setGatewayPhone('');
      setGatewayOtp('');
      clearGatewayTimers();
    }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await getQueueStatus();
      setError('You are already in an active queue. Please wait for your turn or cancel your current queue first.');
      return;
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Status check failed');
        return;
      }
    }

    const snapshot = { ...joinForm };
    pendingBookingRef.current = snapshot;

    if (['easypaisa', 'jazzcash', 'card'].includes(joinForm.paymentMethod)) {
      clearGatewayTimers();
      setGatewayStep('phone');
      setGatewayPhone('');
      setGatewayOtp('');
      setShowGateway(true);
    } else {
      await processJoinQueue(snapshot);
    }
  };

  const handleGatewayNext = () => {
    if (gatewayStep === 'phone') {
      if (!gatewayPhone) return setError('Please enter your details');
      setError('');
      setGatewayStep('otp');
    } else if (gatewayStep === 'otp') {
      if (gatewayOtp.length < 4) return setError('4-digit OTP required');
      setError('');
      const locked = pendingBookingRef.current && pendingBookingRef.current.serviceName 
        ? { ...pendingBookingRef.current } 
        : { ...joinForm };
        
      if (!locked.serviceName || !locked.appointmentDate) {
        setError('Missing details. Please check the form again.');
        return;
      }
      setGatewayStep('processing');
      clearGatewayTimers();

      const digits = String(gatewayPhone).replace(/\D/g, '');
      let paidViaLastDigits = null;
      if (locked.paymentMethod === 'easypaisa' || locked.paymentMethod === 'jazzcash') {
        paidViaLastDigits = digits.slice(-4) || null;
      } else if (locked.paymentMethod === 'card') {
        paidViaLastDigits = digits.slice(-4) || null;
      }
      const payload = paidViaLastDigits ? { ...locked, paidViaLastDigits } : locked;

      const t1 = setTimeout(() => {
        setGatewayStep('success');
        const t2 = setTimeout(() => {
          processJoinQueue(payload);
        }, 1500);
        gatewayTimersRef.current.push(t2);
      }, 2000);
      gatewayTimersRef.current.push(t1);
    }
  };

  const handleCancelQueue = async () => {
    if (!window.confirm('Are you sure you want to cancel?')) return;
    try {
      await cancelQueue();
      setMessage('Queue cancelled successfully');
      setQueueStatus(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage('');
    setError('');
    if (tab === 'history') fetchHistory();
    if (tab === 'reports') fetchReports();
    if (tab === 'payments') fetchPayments();
  };

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'book', label: 'Book Appointment', icon: CalendarPlus },
    { id: 'status', label: 'Queue Tracker', icon: Clock },
    { id: 'history', label: 'Visit History', icon: History },
    { id: 'reports', label: 'Medical Reports', icon: FileText }
  ];

  // Proximity details helper for the large active boarding pass ticket card
  const getProximityTicketStyle = () => {
    if (!queueStatus) return {};
    const { status, peopleAhead } = queueStatus;
    if (status === 'serving' || peopleAhead === 0) {
      return {
        bg: 'from-emerald-500 via-teal-500 to-emerald-600',
        glow: 'shadow-[0_15px_40px_rgba(16,185,129,0.3)]',
        badge: 'bg-emerald-100 text-emerald-800',
        statusLabel: 'Aapki bari aa gayi! Proceed Inside 🏃‍♂️'
      };
    }
    if (peopleAhead <= 2) {
      return {
        bg: 'from-rose-500 via-pink-500 to-rose-600',
        glow: 'shadow-[0_15px_40px_rgba(244,63,94,0.3)]',
        badge: 'bg-rose-100 text-rose-800',
        statusLabel: 'Turn is extremely close! Be outside doctor room 🚨'
      };
    }
    if (peopleAhead <= 5) {
      return {
        bg: 'from-amber-500 via-orange-500 to-amber-600',
        glow: 'shadow-[0_15px_40px_rgba(245,158,11,0.25)]',
        badge: 'bg-amber-100 text-amber-800',
        statusLabel: 'Your turn is approaching shortly.'
      };
    }
    return {
      bg: 'from-slate-800 via-indigo-900 to-slate-900',
      glow: 'shadow-[0_15px_40px_rgba(99,102,241,0.2)]',
      badge: 'bg-slate-700/50 text-white',
      statusLabel: 'Waiting in queue. Keep tracking live updates.'
    };
  };

  const ticketStyle = getProximityTicketStyle();

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col font-sans">
      
      {/* Dynamic Messages Overlay banner */}
      <AnimatePresence>
        {(message || error) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className={`shadow-xl rounded-full px-6 py-3 flex items-center gap-3 backdrop-blur-md ${
              message 
                ? 'bg-emerald-500/90 text-white shadow-emerald-500/10' 
                : 'bg-rose-500/90 text-white shadow-rose-500/10'
            }`}>
              {message ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-bold text-xs tracking-wide">{message || error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Gateway Modal */}
      <AnimatePresence>
        {showGateway && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800"
            >
              {/* Wallet Header */}
              <div className={`p-8 text-center text-white relative overflow-hidden ${
                joinForm.paymentMethod === 'easypaisa' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 
                joinForm.paymentMethod === 'jazzcash' ? 'bg-gradient-to-br from-red-500 to-rose-600' : 
                'bg-gradient-to-br from-slate-800 to-slate-950'
              }`}>
                <div className="absolute inset-0 bg-white/5 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]"></div>
                <h2 className="text-2xl font-black tracking-tight relative z-10 flex items-center justify-center gap-2">
                  {joinForm.paymentMethod === 'card' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                  {joinForm.paymentMethod === 'easypaisa' ? 'Easypaisa' : joinForm.paymentMethod === 'jazzcash' ? 'JazzCash' : 'Secure Card'}
                </h2>
                <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mt-1 relative z-10">
                  {joinForm.paymentMethod === 'card' ? 'Online Checkout' : 'Mobile Wallet Checkout'}
                </p>
              </div>

              {/* Form step columns */}
              <div className="p-8">
                {gatewayStep === 'phone' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                    <div className="text-center bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                      <p className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-wider">Amount to Pay (50% Advance)</p>
                      <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1">
                        Rs. {(doctors.find(d => d.name === joinForm.serviceName)?.consultationFee || 1000) / 2}
                      </p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                        {joinForm.paymentMethod === 'card' ? 'Card Number' : 'Account Mobile Number'}
                      </label>
                      <input 
                        type={joinForm.paymentMethod === 'card' ? 'text' : 'tel'}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 px-4 py-3.5 rounded-2xl text-lg font-mono placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        placeholder={joinForm.paymentMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                        value={gatewayPhone}
                        onChange={(e) => setGatewayPhone(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <button 
                      onClick={handleGatewayNext}
                      className={`w-full py-4 rounded-2xl text-white font-extrabold text-sm shadow-lg transition-all hover:scale-[1.01] flex justify-center items-center gap-2 ${
                        joinForm.paymentMethod === 'easypaisa' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/10' : 
                        joinForm.paymentMethod === 'jazzcash' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/10' : 
                        'bg-slate-800 hover:bg-slate-900 shadow-slate-800/10'
                      }`}
                    >
                      Continue to Pay <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearGatewayTimers();
                        pendingBookingRef.current = null;
                        setShowGateway(false);
                        setGatewayStep('phone');
                      }}
                      className="w-full text-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 font-extrabold text-xs mt-2 transition"
                    >
                      Cancel Payment
                    </button>
                  </motion.div>
                )}

                {gatewayStep === 'otp' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6 text-center">
                    <div className="w-16 h-16 bg-primary-50 dark:bg-slate-800 text-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs font-semibold leading-relaxed">Enter 4-digit verification code sent to</p>
                      <strong className="text-slate-800 dark:text-slate-100 text-lg block mt-1 tracking-wide">{gatewayPhone}</strong>
                    </div>
                    <input 
                      type="text" 
                      maxLength="4"
                      className="w-40 mx-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl text-3xl font-bold tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-100"
                      placeholder="1234"
                      value={gatewayOtp}
                      onChange={(e) => setGatewayOtp(e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={handleGatewayNext}
                      className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-950 text-white py-4 rounded-2xl font-extrabold text-sm shadow-md transition-all hover:bg-black"
                    >
                      Verify & Pay Rs. {(doctors.find(d => d.name === joinForm.serviceName)?.consultationFee || 1000) / 2}
                    </button>
                    <button onClick={() => setGatewayStep('phone')} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 font-extrabold text-xs block mx-auto transition">Go Back</button>
                  </motion.div>
                )}

                {gatewayStep === 'processing' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                      <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                        joinForm.paymentMethod === 'easypaisa' ? 'border-green-500' : 
                        joinForm.paymentMethod === 'jazzcash' ? 'border-red-500' : 'border-slate-800'
                      }`}></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Securing Payment</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">Safarish checking verification notes...</p>
                  </motion.div>
                )}

                {gatewayStep === 'success' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10 text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-10 h-10 animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Payment Successful</h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">Generating appointment receipt ticket...</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Global Layout with Top Nav & Tabs Bar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-800/80 z-30 relative shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 15 }}
                className="w-11 h-11 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20"
              >
                <HeartPulse className="w-6 h-6 text-primary-500" />
              </motion.div>
              <div>
                <span className="font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none block">Patient Portal</span>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">City Medical Smart Queue</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 py-1.5 pl-3.5 pr-1.5 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Aslam</span>
                <div className="w-7 h-7 rounded-xl bg-primary-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                  {user?.name ? user.name.slice(0,2) : 'PT'}
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={logoutUser}
                className="text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tabs Menu Section */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800/60 shadow-xs z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors relative ${
                    isActive ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-500 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`} />
                  {tab.label}
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-primary-500 rounded-t-full" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Assalam-o-Alaikum, {user?.name.split(' ')[0]}!</h2>
                <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-1">Real-time status check karein aur specialized care paayein.</p>
              </div>
            </div>

            {/* Premium Boarding Pass Active Queue Ticket */}
            {queueStatus ? (
              <motion.div 
                whileHover={{ y: -2 }}
                className={`bg-gradient-to-br ${ticketStyle.bg} rounded-[2.5rem] p-8 text-white ${ticketStyle.glow} relative overflow-hidden`}
              >
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Activity className="w-56 h-56" />
                </div>
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                  <div className="space-y-4">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${ticketStyle.badge}`}>
                      {queueStatus.status === 'serving' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5 animate-spin" />}
                      {ticketStyle.statusLabel}
                    </span>
                    <div>
                      <h3 className="text-5xl font-black tracking-tighter">Token #{queueStatus.yourToken}</h3>
                      <p className="text-white/80 font-bold mt-2 flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-teal-300" /> Dr. {queueStatus.serviceName} (Specialist Consultation)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 w-full lg:w-auto">
                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 flex-1 lg:w-36 border border-white/15 text-center shadow-xs">
                      <p className="text-4xl font-black tracking-tight">{queueStatus.peopleAhead}</p>
                      <p className="text-[10px] text-white/70 font-black uppercase tracking-widest mt-1.5">Patients Ahead</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 flex-1 lg:w-36 border border-white/15 text-center shadow-xs">
                      <p className="text-4xl font-black tracking-tight">{queueStatus.estimatedTime}m</p>
                      <p className="text-[10px] text-white/70 font-black uppercase tracking-widest mt-1.5">Est. Wait Time</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/15 flex justify-end relative z-10">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancelQueue}
                    className="bg-white/10 hover:bg-rose-500/90 text-white font-extrabold text-xs px-6 py-3 rounded-2xl transition duration-300 border border-white/10"
                  >
                    Cancel Appointment
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-[2.5rem] p-10 text-center shadow-md relative overflow-hidden"
              >
                <div className="absolute top-[10%] left-[5%] w-48 h-48 rounded-full bg-primary-500/5 blur-3xl pointer-events-none"></div>
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <CalendarPlus className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">No active queue appointment</h3>
                <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-2 max-w-md mx-auto leading-relaxed">
                  Aapki aaj ki koi active appointment nahi hai. Clinic ke specialists se consult karne ke liye niche click karke ticket book karein.
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleTabChange('book')}
                  className="mt-8 bg-primary-500 text-white px-8 py-3.5 rounded-2xl font-extrabold text-sm hover:bg-primary-600 hover:shadow-glow hover:shadow-primary-500/10 transition shadow-sm inline-flex items-center gap-2"
                >
                  Book Appointment <ChevronRight className="w-4.5 h-4.5" />
                </motion.button>
              </motion.div>
            )}

            {/* Premium Doctor Cards list */}
            <div className="space-y-5">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                Our Specialized Doctors
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map(doc => (
                  <motion.div 
                    key={doc._id} 
                    whileHover={{ y: -4 }}
                    className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xs hover:shadow-lg border border-slate-200/50 dark:border-slate-800 p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border border-indigo-100/30 dark:border-indigo-500/10">
                        <User className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg group-hover:text-primary-500 transition-colors">Dr. {doc.name}</h4>
                        <p className="text-primary-600 dark:text-primary-400 font-bold text-xs uppercase tracking-wider mt-0.5">{doc.specialization}</p>
                        
                        <div className="space-y-2 mt-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                            {doc.slotDuration} min consultations
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            <Banknote className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                            Consultation fee: <span className="font-black text-slate-800 dark:text-slate-200 ml-1">Rs. {doc.consultationFee}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== BOOK APPOINTMENT TAB ==================== */}
        {activeTab === 'book' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-md border border-slate-200/50 dark:border-slate-800 p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute top-[5%] right-[5%] w-40 h-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center shrink-0 border border-primary-500/10">
                  <CalendarPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">Book Appointment</h2>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1.5 uppercase tracking-wider">Select doctor & details for booking token</p>
                </div>
              </div>

              <form onSubmit={handleJoinQueue} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Select Doctor</label>
                    <select
                      value={joinForm.serviceName}
                      onChange={(e) => {
                        const selectedDoctor = doctors.find(d => d.name === e.target.value);
                        setJoinForm({ 
                          ...joinForm, 
                          serviceName: e.target.value,
                          totalAmount: selectedDoctor ? selectedDoctor.consultationFee : ''
                        });
                      }}
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-bold"
                    >
                      <option value="">-- Choose Specialist --</option>
                      {doctors.map(doc => (
                        <option key={doc._id} value={doc.name}>Dr. {doc.name} ({doc.specialization})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Appointment Date</label>
                    <input
                      type="date"
                      value={joinForm.appointmentDate}
                      onChange={(e) => setJoinForm({ ...joinForm, appointmentDate: e.target.value })}
                      required
                      min={localDateInputValue()}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-bold"
                    />
                  </div>
                </div>

                {/* Priority Selection Cards */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Priority Level</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition-all ${
                      joinForm.priority === 'normal' 
                        ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-1 ring-primary-500' 
                        : 'border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50'
                    }`}>
                      <input type="radio" name="priority" value="normal" checked={joinForm.priority === 'normal'} onChange={(e) => setJoinForm({...joinForm, priority: e.target.value})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${joinForm.priority === 'normal' ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>
                        {joinForm.priority === 'normal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">Normal Visit</span>
                    </label>
                    
                    <label className={`cursor-pointer border rounded-2xl p-4 flex items-center gap-3 transition-all ${
                      joinForm.priority === 'emergency' 
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 ring-1 ring-rose-500' 
                        : 'border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50'
                    }`}>
                      <input type="radio" name="priority" value="emergency" checked={joinForm.priority === 'emergency'} onChange={(e) => setJoinForm({...joinForm, priority: e.target.value})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${joinForm.priority === 'emergency' ? 'border-rose-500 bg-rose-500' : 'border-slate-300'}`}>
                        {joinForm.priority === 'emergency' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">Emergency</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Symptoms or Brief Notes</label>
                  <textarea
                    value={joinForm.notes}
                    onChange={(e) => setJoinForm({ ...joinForm, notes: e.target.value })}
                    placeholder="Describe symptoms briefly..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-700 dark:text-slate-200 text-xs font-semibold resize-none"
                  />
                </div>

                {/* Secure checkout options inside booking card */}
                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden mt-8">
                  <div className="bg-slate-50 dark:bg-slate-800/40 px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      Choose Secure Payment Method
                    </h3>
                  </div>
                  
                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'card', label: 'Credit Card', icon: CreditCard },
                        { id: 'easypaisa', label: 'Easypaisa', icon: Wallet },
                        { id: 'jazzcash', label: 'JazzCash', icon: Wallet }
                      ].map(method => (
                        <label key={method.id} className={`cursor-pointer border rounded-2xl p-4 flex flex-col items-center text-center gap-2 transition-all ${
                          joinForm.paymentMethod === method.id 
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500' 
                            : 'border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 hover:bg-slate-50'
                        }`}>
                          <input type="radio" name="paymentMethod" value={method.id} checked={joinForm.paymentMethod === method.id} onChange={(e) => setJoinForm({...joinForm, paymentMethod: e.target.value})} className="sr-only" />
                          <method.icon className={`w-6 h-6 ${joinForm.paymentMethod === method.id ? 'text-primary-500' : 'text-slate-400 dark:text-slate-600'}`} />
                          <span className="font-extrabold text-[10px] tracking-wide uppercase mt-1">{method.label}</span>
                        </label>
                      ))}
                    </div>

                    {joinForm.serviceName && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/20 space-y-2.5"
                      >
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <span>Total Consultation Fee</span>
                          <span className="text-slate-800 dark:text-slate-200">Rs. {joinForm.totalAmount}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-200/50">
                          <span>Pay Now (50% Advance)</span>
                          <span className="text-primary-600 dark:text-primary-400 text-sm font-black">Rs. {joinForm.totalAmount / 2}</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500 italic">
                          <span>*Remaining Rs. {joinForm.totalAmount / 2} will be paid at clinical reception.</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  type="submit"
                  disabled={loading || !joinForm.serviceName}
                  className="w-full bg-primary-500 text-white py-4 rounded-2xl font-extrabold text-sm hover:bg-primary-600 hover:shadow-glow hover:shadow-primary-500/10 transition-all disabled:opacity-50 disabled:pointer-events-none mt-4"
                >
                  {loading ? 'Securing booking gateway...' : 'Confirm & Secure Booking'}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ==================== QUEUE STATUS TAB ==================== */}
        {activeTab === 'status' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-md border border-slate-200/50 dark:border-slate-800 p-8 sm:p-10 relative overflow-hidden">
              <div className="absolute top-[5%] left-[5%] w-44 h-44 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/10">
                    <Clock className="w-6 h-6 text-primary-500 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Queue Status</h2>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">Real-time consultation details</p>
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={fetchQueueStatus}
                  className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary-500 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:border-primary-300 transition-colors shadow-xs"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </motion.button>
              </div>

              {queueStatus ? (
                <div className="space-y-6 relative z-10">
                  {/* Proximity visual alert block */}
                  <div className={`p-4.5 rounded-2xl border flex items-start gap-4 ${
                    queueStatus.peopleAhead === 0 ? 'bg-emerald-50/80 border-emerald-200/50 text-emerald-800' : 
                    queueStatus.peopleAhead <= 2 ? 'bg-rose-50/80 border-rose-200/50 text-rose-800' : 
                    queueStatus.peopleAhead <= 5 ? 'bg-amber-50/80 border-amber-200/50 text-amber-800' : 
                    'bg-slate-50/80 border-slate-200/50 text-slate-700'
                  }`}>
                    {queueStatus.peopleAhead <= 2 ? <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider leading-none mb-1">Live Status Notification</div>
                      <p className="text-xs font-bold leading-relaxed">{ticketStyle.statusLabel}</p>
                    </div>
                  </div>

                  {/* Layout Grid details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 p-5 rounded-[1.5rem] space-y-1">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Consultant Specialist</span>
                      <h4 className="text-xl font-black text-slate-800 dark:text-slate-100">Dr. {queueStatus.serviceName}</h4>
                      <span className="inline-block text-[10px] font-black text-primary-500 bg-primary-50 dark:bg-primary-950/20 border border-primary-500/10 px-2 py-0.5 rounded-md mt-2">
                        Token #{queueStatus.yourToken}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 p-5 rounded-[1.5rem] flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Estimated Arrival</span>
                        <div className="text-2xl font-black text-primary-600 dark:text-primary-400">
                          {new Date(Date.now() + queueStatus.estimatedTime * 60 * 1000).toLocaleTimeString('en-US', {
                            hour: '2-digit', minute: '2-digit', hour12: true
                          })}
                        </div>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-xl shadow-xs">
                        <Clock className="w-6 h-6 text-primary-500" />
                      </div>
                    </div>
                  </div>

                  {/* Progress statistics list */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 p-6 rounded-[2.5rem] space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-2"><Users className="w-4.5 h-4.5" /> Remaining Patients ahead:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-3 py-1 rounded-xl shadow-xs">
                        {queueStatus.peopleAhead} ahead
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-200/50 dark:border-slate-800/60">
                      <span className="flex items-center gap-2"><Hourglass className="w-4.5 h-4.5" /> Est. wait to consult:</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-3 py-1 rounded-xl shadow-xs">
                        {queueStatus.estimatedTime} minutes
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-200/50 dark:border-slate-800/60">
                      <span className="flex items-center gap-2"><Clock className="w-4.5 h-4.5" /> Now Serving Token:</span>
                      <span className="font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-500/10 px-3.5 py-1 rounded-xl shadow-xs">
                        Token #{queueStatus.currentServing}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleCancelQueue}
                    className="w-full text-center text-rose-500 hover:text-rose-600 dark:text-rose-400 font-extrabold text-xs py-4 rounded-2xl bg-rose-50/40 hover:bg-rose-50/80 dark:bg-rose-950/10 border border-rose-200/10 transition-colors"
                  >
                    Cancel Appointment & Leave Queue
                  </motion.button>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No active queue tracker</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">Aap abhi kisi queue line mein active nahi hain.</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTabChange('book')}
                    className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-extrabold text-xs tracking-wider uppercase mt-4 hover:bg-primary-600"
                  >
                    Join a Queue
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== VISIT HISTORY TAB ==================== */}
        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-left">
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Visit History</h2>
              <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-1">Timeline logs of all checkups and slot payments.</p>
            </div>

            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((item, idx) => (
                  <motion.div 
                    key={item._id || idx} 
                    whileHover={{ x: 4 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200/40">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-tight">Dr. {item.serviceName}</h4>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                          Appointment Date: <span className="text-slate-600 dark:text-slate-300 font-bold">{new Date(item.appointmentDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">Token #{item.tokenNumber} • {item.notes || 'Routine Clinic visit checkup.'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2.5rem] p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No past checkup history</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">Aapki abhi tak koi past clinical verification history nahi hai.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== MEDICAL REPORTS TAB ==================== */}
        {activeTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-left">
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Medical Reports</h2>
              <p className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-1">Download and view diagnostic checkup files.</p>
            </div>

            {reports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report, idx) => (
                  <motion.div 
                    key={report._id || idx} 
                    whileHover={{ y: -4 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-[2rem] p-6 shadow-xs relative overflow-hidden group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary-50 dark:bg-primary-950/20 text-primary-500 rounded-2xl flex items-center justify-center shrink-0 border border-primary-500/10">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-tight group-hover:text-primary-500 transition-colors">{report.fileName || 'Diagnostic Report'}</h4>
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Doctor: Dr. {report.doctorId?.name || 'Specialist'}</span>
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Date: {new Date(report.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200/50 dark:border-slate-800 flex justify-end">
                      <a 
                        href={`http://localhost:5000${report.filePath}`}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-50 dark:bg-slate-800 hover:bg-primary-500 dark:hover:bg-primary-500 text-slate-600 dark:text-slate-400 hover:text-white dark:hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-slate-200/60 dark:border-slate-800 transition duration-300 shadow-xs"
                      >
                        <FileDown className="w-4 h-4" /> Download PDF
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2.5rem] p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No medical reports issued</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-1">Iss clinic checkup ki reports abhi tak publish nahi ki gayi hain.</p>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Persistent printable checkout receipts */}
      <AnimatePresence>
        {showReceipt && receiptData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 relative border border-slate-100 dark:border-slate-800"
            >
              <AppointmentReceipt 
                receipt={receiptData} 
                onClose={() => {
                  setShowReceipt(false);
                  setReceiptData(null);
                }} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permanent floating live card overlay for active tokens tracking */}
      <LiveQueueCard queueStatus={queueStatus} onCancel={handleCancelQueue} />
    </div>
  );
};

export default PatientDashboard;