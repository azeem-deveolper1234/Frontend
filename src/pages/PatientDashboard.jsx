import React, { useState, useEffect, useRef } from 'react';
import AppointmentReceipt from '../components/AppointmentReceipt';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, CalendarPlus, Clock, History, FileText, User, LogOut, 
  Bell, CheckCircle2, XCircle, CreditCard, Wallet, AlertCircle, 
  RefreshCw, Activity, HeartPulse, ChevronRight, ShieldCheck, Banknote, Lock
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
    { id: 'book', label: 'Book', icon: CalendarPlus },
    { id: 'status', label: 'Queue Status', icon: Clock },
    { id: 'history', label: 'History', icon: History },
    { id: 'reports', label: 'Reports', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Messages Overlay */}
      <AnimatePresence>
        {(message || error) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
          >
            <div className={`shadow-lg rounded-full px-6 py-3 flex items-center gap-3 backdrop-blur-md ${message ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
              {message ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium text-sm">{message || error}</span>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative"
            >
              {/* Header */}
              <div className={`p-8 text-center text-white relative overflow-hidden ${
                joinForm.paymentMethod === 'easypaisa' ? 'bg-green-500' : 
                joinForm.paymentMethod === 'jazzcash' ? 'bg-red-500' : 'bg-slate-800'
              }`}>
                <div className="absolute inset-0 bg-white/10 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <h2 className="text-2xl font-bold tracking-tight relative z-10 flex items-center justify-center gap-2">
                  {joinForm.paymentMethod === 'card' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                  {joinForm.paymentMethod === 'easypaisa' ? 'Easypaisa' : joinForm.paymentMethod === 'jazzcash' ? 'JazzCash' : 'Secure Card'}
                </h2>
                <p className="text-white/80 text-sm mt-1 font-medium relative z-10">
                  {joinForm.paymentMethod === 'card' ? 'Online Checkout' : 'Mobile Wallet Checkout'}
                </p>
              </div>

              {/* Body */}
              <div className="p-8">
                {gatewayStep === 'phone' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-5">
                    <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Amount to Pay</p>
                      <p className="text-3xl font-bold text-slate-800 mt-1">
                        Rs. {(doctors.find(d => d.name === joinForm.serviceName)?.consultationFee || 1000) / 2}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {joinForm.paymentMethod === 'card' ? 'Card Number' : 'Mobile Number'}
                      </label>
                      <input 
                        type={joinForm.paymentMethod === 'card' ? 'text' : 'tel'}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl text-lg font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                        placeholder={joinForm.paymentMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                        value={gatewayPhone}
                        onChange={(e) => setGatewayPhone(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={handleGatewayNext}
                      className={`w-full py-4 rounded-xl text-white font-bold text-[15px] shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex justify-center items-center gap-2 ${
                        joinForm.paymentMethod === 'easypaisa' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/25' : 
                        joinForm.paymentMethod === 'jazzcash' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' : 
                        'bg-slate-800 hover:bg-slate-900 shadow-slate-800/25'
                      }`}
                    >
                      Continue <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearGatewayTimers();
                        pendingBookingRef.current = null;
                        setShowGateway(false);
                        setGatewayStep('phone');
                      }}
                      className="w-full text-center text-slate-500 font-medium text-sm mt-2 hover:text-slate-800 transition"
                    >
                      Cancel
                    </button>
                  </motion.div>
                )}

                {gatewayStep === 'otp' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6 text-center">
                    <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-slate-600 text-sm">Enter 4-digit verification code sent to</p>
                      <strong className="text-slate-800 text-lg block mt-1">{gatewayPhone}</strong>
                    </div>
                    <input 
                      type="text" 
                      maxLength="4"
                      className="w-40 mx-auto bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-3xl font-bold tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                      placeholder="1234"
                      value={gatewayOtp}
                      onChange={(e) => setGatewayOtp(e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={handleGatewayNext}
                      className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-slate-900/25 transition-all hover:bg-black hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Verify & Pay
                    </button>
                    <button onClick={() => setGatewayStep('phone')} className="text-slate-500 font-medium text-sm hover:text-slate-800 transition">Go Back</button>
                  </motion.div>
                )}

                {gatewayStep === 'processing' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className={`absolute inset-0 rounded-full border-4 border-slate-100`}></div>
                      <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                        joinForm.paymentMethod === 'easypaisa' ? 'border-green-500' : 
                        joinForm.paymentMethod === 'jazzcash' ? 'border-red-500' : 'border-slate-800'
                      }`}></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Processing Payment</h3>
                    <p className="text-slate-500 text-sm mt-2">Please do not close this window</p>
                  </motion.div>
                )}

                {gatewayStep === 'success' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10 text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ${
                      joinForm.paymentMethod === 'easypaisa' ? 'bg-green-100 text-green-500 shadow-green-500/20' : 
                      joinForm.paymentMethod === 'jazzcash' ? 'bg-red-100 text-red-500 shadow-red-500/20' : 'bg-blue-100 text-blue-500 shadow-blue-500/20'
                    }`}>
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">Successful!</h3>
                    <p className="text-slate-500 text-sm mt-2">Payment securely captured.</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showReceipt && receiptData && (
        <AppointmentReceipt
          key={`${receiptData.tokenNumber}-${receiptData.bookingTime}`}
          data={receiptData}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600">
                <HeartPulse className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-slate-800 font-bold text-xl tracking-tight">City Medical</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Patient Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-2 text-slate-600 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                <User className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-semibold">{user?.name}</span>
              </div>
              <button
                onClick={logoutUser}
                className="text-slate-500 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-5 flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors relative ${
                    isActive ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-500' : 'text-slate-400'}`} />
                  {tab.label}
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Good morning, {user?.name.split(' ')[0]}!</h2>
                <p className="text-slate-500 mt-1">Here is your health overview for today.</p>
              </div>
            </div>

            {/* Quick Status */}
            {queueStatus ? (
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-8 text-white shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Activity className="w-48 h-48" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 ${
                      queueStatus.status === 'serving' ? 'bg-white text-green-600' : 'bg-white/20 text-white'
                    }`}>
                      {queueStatus.status === 'serving' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {queueStatus.status === 'serving' ? 'Currently Serving You' : 'Waiting in Queue'}
                    </span>
                    <h3 className="text-4xl font-black tracking-tight">Token #{queueStatus.yourToken}</h3>
                    <p className="text-primary-100 font-medium mt-2 flex items-center gap-2">
                      <User className="w-4 h-4" /> Dr. {queueStatus.serviceName}
                    </p>
                  </div>

                  <div className="flex gap-4 w-full md:w-auto">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 md:w-32 border border-white/20 text-center">
                      <p className="text-3xl font-bold">{queueStatus.peopleAhead}</p>
                      <p className="text-xs text-primary-100 font-medium uppercase tracking-wider mt-1">Ahead</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1 md:w-32 border border-white/20 text-center">
                      <p className="text-3xl font-bold">{queueStatus.estimatedTime}m</p>
                      <p className="text-xs text-primary-100 font-medium uppercase tracking-wider mt-1">Wait Time</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/20 flex justify-end relative z-10">
                  <button
                    onClick={handleCancelQueue}
                    className="bg-white/10 hover:bg-red-500/80 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-white/20"
                  >
                    Cancel Queue
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarPlus className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">No active appointments</h3>
                <p className="text-slate-500 mt-2 max-w-sm mx-auto">You're all caught up. Book an appointment if you need to consult a doctor.</p>
                <button
                  onClick={() => handleTabChange('book')}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-700 transition shadow-sm inline-flex items-center gap-2"
                >
                  Book Appointment <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Doctors List */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                Our Specialists
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map(doc => (
                  <div key={doc._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-soft transition-all hover:-translate-y-1">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-secondary-50 text-secondary-600 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">Dr. {doc.name}</h4>
                        <p className="text-primary-600 font-medium text-sm mb-3">{doc.specialization}</p>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {doc.slotDuration} min consultation
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Banknote className="w-3.5 h-3.5 text-slate-400" />
                            Rs. {doc.consultationFee}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* BOOK APPOINTMENT TAB */}
        {activeTab === 'book' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center shrink-0">
                  <CalendarPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Book Appointment</h2>
                  <p className="text-slate-500 text-sm mt-1">Select a doctor and time to join the queue</p>
                </div>
              </div>

              <form onSubmit={handleJoinQueue} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Doctor</label>
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
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-700 font-medium"
                    >
                      <option value="">-- Choose Specialist --</option>
                      {doctors.map(doc => (
                        <option key={doc._id} value={doc.name}>Dr. {doc.name} ({doc.specialization})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Appointment Date</label>
                    <input
                      type="date"
                      value={joinForm.appointmentDate}
                      onChange={(e) => setJoinForm({ ...joinForm, appointmentDate: e.target.value })}
                      required
                      min={localDateInputValue()}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-700 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Priority Level</label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${joinForm.priority === 'normal' ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input type="radio" name="priority" value="normal" checked={joinForm.priority === 'normal'} onChange={(e) => setJoinForm({...joinForm, priority: e.target.value})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${joinForm.priority === 'normal' ? 'border-primary-600 bg-primary-600' : 'border-slate-300'}`}>
                        {joinForm.priority === 'normal' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-semibold text-slate-700 text-sm">Normal Visit</span>
                    </label>
                    <label className={`cursor-pointer border rounded-xl p-4 flex items-center gap-3 transition-all ${joinForm.priority === 'emergency' ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input type="radio" name="priority" value="emergency" checked={joinForm.priority === 'emergency'} onChange={(e) => setJoinForm({...joinForm, priority: e.target.value})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${joinForm.priority === 'emergency' ? 'border-red-600 bg-red-600' : 'border-slate-300'}`}>
                        {joinForm.priority === 'emergency' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-semibold text-red-700 text-sm">Emergency</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Symptoms or Notes</label>
                  <textarea
                    value={joinForm.notes}
                    onChange={(e) => setJoinForm({ ...joinForm, notes: e.target.value })}
                    placeholder="Briefly describe why you need to see the doctor..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all text-slate-700 text-sm resize-none"
                  />
                </div>

                {/* Payment Section */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden mt-8">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-slate-500" />
                      Payment Method
                    </h3>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        // { id: 'cash', label: 'Cash at Clinic', icon: Banknote },
                        { id: 'card', label: 'Online Card', icon: CreditCard },
                        { id: 'easypaisa', label: 'Easypaisa', icon: Wallet },
                        { id: 'jazzcash', label: 'JazzCash', icon: Wallet }
                      ].map(method => (
                        <label key={method.id} className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center text-center gap-2 transition-all ${joinForm.paymentMethod === method.id ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          <input type="radio" name="paymentMethod" value={method.id} checked={joinForm.paymentMethod === method.id} onChange={(e) => setJoinForm({...joinForm, paymentMethod: e.target.value})} className="sr-only" />
                          <method.icon className={`w-6 h-6 ${joinForm.paymentMethod === method.id ? 'text-primary-600' : 'text-slate-400'}`} />
                          <span className="font-semibold text-xs">{method.label}</span>
                        </label>
                      ))}
                    </div>

                    {joinForm.serviceName && (
                      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col gap-2">
                        <div className="flex justify-between text-sm font-medium text-slate-600">
                          <span>Total Consultation Fee</span>
                          <span>Rs. {joinForm.totalAmount}</span>
                        </div>
                        {joinForm.paymentMethod !== 'cash' && (
                          <>
                            <div className="flex justify-between text-sm font-medium text-slate-600">
                              <span>Pay Now (50% Advance)</span>
                              <span className="text-primary-600 font-bold">Rs. {joinForm.totalAmount / 2}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-slate-600">
                              <span>Pay at Clinic</span>
                              <span>Rs. {joinForm.totalAmount / 2}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !joinForm.serviceName}
                  className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-[15px] hover:bg-primary-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none mt-4"
                >
                  {loading ? 'Processing...' : 'Confirm & Book Appointment'}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* QUEUE STATUS TAB */}
        {activeTab === 'status' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Queue Status</h2>
                  <p className="text-slate-500 text-sm mt-1">Real-time updates for your appointment</p>
                </div>
                <button
                  onClick={fetchQueueStatus}
                  className="p-2.5 bg-slate-50 text-slate-600 hover:text-primary-600 rounded-xl border border-slate-200 hover:border-primary-200 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {queueStatus ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center">
                      <div className="text-5xl font-black text-slate-800">{queueStatus.yourToken}</div>
                      <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-2">Your Token</div>
                    </div>
                    <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center">
                      <div className="text-5xl font-black text-primary-600">{queueStatus.currentServing}</div>
                      <div className="text-sm font-medium text-primary-600 uppercase tracking-wider mt-2">Serving</div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-1 text-center">
                      <div className="text-2xl font-bold text-slate-700">{queueStatus.peopleAhead}</div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Ahead</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-1 text-center">
                      <div className="text-2xl font-bold text-slate-700">{queueStatus.estimatedTime}m</div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Est. Wait</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-slate-600">Current Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        queueStatus.status === 'serving' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {queueStatus.status === 'serving' ? 'Your Turn' : 'Waiting'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-600">Priority Level</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        queueStatus.priority === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {queueStatus.priority === 'emergency' ? 'Emergency' : 'Normal'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCancelQueue}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3.5 rounded-xl font-bold transition-colors mt-4"
                  >
                    Cancel Queue
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">No active queue</h3>
                  <p className="text-slate-500 mt-2">You are not currently waiting for any doctor.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Visit History</h2>
            {history.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No past visits</h3>
                <p className="text-slate-500">Your completed and cancelled appointments will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center shrink-0">
                        <CalendarPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">Dr. {item.serviceName}</h4>
                        <p className="text-slate-500 font-medium text-sm mt-0.5">{new Date(item.createdAt).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="text-slate-400 text-sm mt-1">Token: #{item.tokenNumber}</p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:items-end w-full sm:w-auto">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        item.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {item.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* MEDICAL REPORTS TAB */}
        {activeTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Medical Reports</h2>
            {reports.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No medical reports</h3>
                <p className="text-slate-500">Prescriptions and diagnosis reports will be available here after visits.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {reports.map((report, index) => (
                  <div key={index} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{report.diagnosis}</h4>
                        <p className="text-primary-600 font-medium text-sm flex items-center gap-1.5 mt-1">
                          <User className="w-3.5 h-3.5" /> Dr. {report.doctor?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-sm font-medium">{new Date(report.createdAt).toLocaleDateString()}</p>
                        {report.followUp && (
                          <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-md font-bold mt-2">
                            Follow Up Required
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {report.symptoms && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Symptoms</p>
                          <p className="text-slate-700 bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">{report.symptoms}</p>
                        </div>
                      )}

                      {report.prescription?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prescription</p>
                          <div className="grid gap-2">
                            {report.prescription.map((med, i) => (
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                                <span className="font-bold text-slate-800 min-w-[150px] flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                                  {med.medicineName}
                                </span>
                                <span className="text-slate-600 font-medium">{med.dosage}</span>
                                <span className="text-slate-500">{med.frequency}</span>
                                <span className="text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md text-xs font-semibold">{med.duration}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.doctorNotes && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Doctor Notes</p>
                          <p className="text-slate-700 bg-amber-50 p-4 rounded-xl text-sm border border-amber-100/50">{report.doctorNotes}</p>
                        </div>
                      )}

                      {report.nextAppointment && (
                        <div className="flex items-center gap-3 text-sm font-medium text-slate-700 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                          <CalendarPlus className="w-5 h-5 text-blue-500" />
                          Next Appointment: <strong className="text-slate-900">{new Date(report.nextAppointment).toLocaleDateString()}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default PatientDashboard;