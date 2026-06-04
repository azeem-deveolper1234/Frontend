import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  callNextPatient, callPatientByToken, completeQueue, getAnalyticsOverall, 
  getAllPayments, createMedicalReport, getAllUsers, getAllDoctors,
  getPatientQueue, completeFinalPayment, addDoctor,
  updateDoctor, deleteDoctor, clearOldData, getPatientClinicHistory
} from '../services/api';

import { 
  LayoutDashboard, Users, UserPlus, Stethoscope, FileText, 
  CreditCard, History, LogOut, CheckCircle2, AlertCircle, 
  Clock, Activity, Trash2, Edit2, Wallet, Banknote, ShieldCheck, 
  RefreshCw, ChevronRight, X, TrendingUp, Sparkles, AlertTriangle, Check
} from 'lucide-react';

function describeAdvancePayment(p) {
  if (!p) return '—';
  if (p.walletChannel === 'easypaisa') return 'Easypaisa (advance)';
  if (p.walletChannel === 'jazzcash') return 'JazzCash (advance)';
  if (p.paymentMethod === 'card') return 'Debit/credit card (advance)';
  if (p.paymentMethod === 'cash') return 'Cash (advance)';
  if (p.paymentMethod === 'online') return 'Online (advance)';
  return p.paymentMethod || '—';
}

function describeFinalSettlement(p) {
  if (!p || p.finalStatus !== 'paid') return null;
  if (p.finalSettlementWallet === 'easypaisa') return 'Easypaisa (remaining)';
  if (p.finalSettlementWallet === 'jazzcash') return 'JazzCash (remaining)';
  if (p.finalSettlementMethod === 'card') return 'Debit/credit card (remaining)';
  if (p.finalSettlementMethod === 'cash') return 'Cash (remaining)';
  if (p.finalSettlementMethod === 'online') return 'Online (remaining)';
  if (p.paymentMethod === 'cash') return 'Cash (remaining)';
  if (p.paymentMethod === 'online') return 'Online (remaining)';
  return p.paymentMethod ? `${p.paymentMethod} (remaining)` : '—';
}

function formatHistoryDate(d) {
  if (d == null) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime())
    ? '—'
    : x.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatHistoryDay(d) {
  if (d == null) return '—';
  const x = new Date(d);
  return Number.isNaN(x.getTime())
    ? '—'
    : x.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function visitStatusLabel(s) {
  if (s === 'completed') return { text: 'Completed', cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
  if (s === 'cancelled') return { text: 'Cancelled', cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
  if (s === 'serving') return { text: 'Serving', cls: 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse' };
  return { text: 'Waiting', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
}

const AdminDashboard = () => {  
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [todayStats, setTodayStats] = useState(null);
  const [overallStats, setOverallStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]); 
  const [doctorForm, setDoctorForm] = useState({
    name: '', specialization: '', email: '', phone: '',
    slotDuration: 15, maxPatientsPerDay: 20, consultationFee: 1000,
    schedule: [
      { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Thursday', startTime: '09:00', endTime: '17:00', isAvailable: true },
      { day: 'Friday', startTime: '09:00', endTime: '17:00', isAvailable: true },
    ]
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [historyUserId, setHistoryUserId] = useState('');
  const [patientHistoryData, setPatientHistoryData] = useState(null);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  const [clearRetentionDays, setClearRetentionDays] = useState(14);
  
  const [showFinalPayGateway, setShowFinalPayGateway] = useState(false);
  const [finalPayStep, setFinalPayStep] = useState('phone');
  const [finalPayPhone, setFinalPayPhone] = useState('');
  const [finalPayOtp, setFinalPayOtp] = useState('');
  const [finalPayMeta, setFinalPayMeta] = useState({
    method: 'card', amount: 0, patientName: ''
  });
  const finalPayContextRef = useRef(null);
  const finalPayTimersRef = useRef([]);

  const clearFinalPayTimers = () => {
    finalPayTimersRef.current.forEach((id) => clearTimeout(id));
    finalPayTimersRef.current = [];
  };

  const [serviceName, setServiceName] = useState('');
  const [tokenNumber, setTokenNumber] = useState('');
  const [reportForm, setReportForm] = useState({
    patientId: '', doctorId: '', queueId: '', diagnosis: '',
    symptoms: '', bloodPressure: '', temperature: '', weight: '',
    doctorNotes: '', nextAppointment: '', followUp: false,
    prescription: [{ medicineName: '', dosage: '', frequency: '', duration: '' }]
  });

  const fetchTodayStats = async () => {
    try {
      const res = await api.get('/analytics/today');
      setTodayStats(res.data);
    } catch (error) {
      console.error("Error fetching today stats:", error);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const res = await getAnalyticsOverall();
      setOverallStats(res.data);
    } catch (err) {}
  };

  const fetchPayments = async () => {
    try {
      const res = await getAllPayments();
      setPayments(res.data.payments);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await getAllUsers();
      setUsers(res.data || []);
      if (!res.data?.length && user?.role === 'doctor') {
        setError('No patients found for your queue yet. Patients must book an appointment with your name first.');
      }
    } catch (err) {
      setUsers([]);
      setError(err.response?.data?.message || 'Failed to load patient list');
    }
  };

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await getAllDoctors();
      setDoctors(res.data);
      if (res.data.length > 0) {
        setServiceName((prev) => prev || res.data[0].name);
      }
    } catch (err) {}
  }, []);

  useEffect(() => {
    fetchTodayStats();
    fetchOverallStats();
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    return () => clearFinalPayTimers();
  }, []);

  // Auto-populate currently serving token for the selected doctor
  useEffect(() => {
    if (todayStats?.allQueueToday && serviceName) {
      const serving = todayStats.allQueueToday.find(
        (q) => q.serviceName === serviceName && q.status === 'serving'
      );
      if (serving) {
        setTokenNumber(serving.tokenNumber.toString());
      } else {
        setTokenNumber('');
      }
    }
  }, [todayStats, serviceName]);

  const isDoctor = user?.role === 'doctor';

  useEffect(() => {
    if (isDoctor && doctors.length > 0) {
      const myDoc = doctors.find(d => d.email === user.email || d._id === user.doctorId);
      if (myDoc) {
        setServiceName(myDoc.name);
      }
    }
  }, [doctors, user, isDoctor]);

  useEffect(() => {
    if (isDoctor && user?.doctorId) {
      setReportForm(prev => ({ ...prev, doctorId: user.doctorId }));
    }
  }, [user, isDoctor]);

  const handleInlineCall = async (docName, tokenNum, queueId) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await callPatientByToken({
        serviceName: docName,
        tokenNumber: tokenNum,
        queueId: queueId || undefined
      });
      setMessage(`✅ Token ${res.data.tokenNumber} called! Priority: ${res.data.priority}`);
      fetchTodayStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to call patient');
    }
    setLoading(false);
  };

  const handleInlineComplete = async (tNum, docName, queueId) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await completeQueue({
        tokenNumber: tNum,
        serviceName: docName,
        queueId: queueId || undefined
      });
      setMessage(`✅ Token ${res.data.tokenNumber} completed!`);
      fetchTodayStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete visit');
    }
    setLoading(false);
  };

  const handleCallNext = async () => {
    if(!serviceName) return setError('Select a doctor first!');
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await callNextPatient({ serviceName });
      setMessage(`✅ Token ${res.data.tokenNumber} called! Priority: ${res.data.priority}`);
      fetchTodayStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to call patient');
    }
    setLoading(false);
  };

  const handleComplete = async () => {
    if (!tokenNumber) return setError('Enter token number!');
    if(!serviceName) return setError('Select a doctor first!');
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await completeQueue({ tokenNumber: parseInt(tokenNumber), serviceName });
      setMessage(`✅ Token ${res.data.tokenNumber} completed!`);
      setTokenNumber('');
      fetchTodayStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete visit');
    }
    setLoading(false);
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await createMedicalReport(reportForm);
      setMessage('✅ Medical report created successfully!');
      setReportForm({
        patientId: '', doctorId: '', queueId: '', diagnosis: '',
        symptoms: '', bloodPressure: '', temperature: '', weight: '',
        doctorNotes: '', nextAppointment: '', followUp: false,
        prescription: [{ medicineName: '', dosage: '', frequency: '', duration: '' }]
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create report');
    }
    setLoading(false);
  };

  const addMedicine = () => {
    setReportForm({
      ...reportForm,
      prescription: [...reportForm.prescription, { medicineName: '', dosage: '', frequency: '', duration: '' }]
    });
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...reportForm.prescription];
    updated[index][field] = value;
    setReportForm({ ...reportForm, prescription: updated });
  };

  const loadPatientHistory = async (userId) => {
    if (!userId) {
      setPatientHistoryData(null);
      return;
    }
    setPatientHistoryLoading(true);
    setError('');
    try {
      const res = await getPatientClinicHistory(userId);
      setPatientHistoryData(res.data);
    } catch (err) {
      setPatientHistoryData(null);
      setError(err.response?.data?.message || 'History load failed');
    } finally {
      setPatientHistoryLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage('');
    setError('');
    if (tab === 'payments') fetchPayments();
    if (tab === 'doctors') fetchDoctors();
    if (tab === 'reports') {
      fetchUsers();
      fetchDoctors();
    }
    if (tab === 'patientHistory') {
      fetchUsers();
      setHistoryUserId('');
      setPatientHistoryData(null);
    }
  };

  const handlePatientChange = async (patientId) => {
    setReportForm({ ...reportForm, patientId });
    if (patientId) {
      try {
        const res = await getPatientQueue(patientId);
        if (res.data) {
          setReportForm(prev => ({ ...prev, patientId, queueId: res.data._id }));
        }
      } catch (err) {}
    }
  };

  const handleClearOldData = async () => {
    const days = Math.max(14, Number(clearRetentionDays) || 14);
    if (
      !window.confirm(
        `Purana queue data delete karein?\n\nSirf wo records jo ${days} din se ZYADA purane hon (aaj se pehle ki cutoff date). Pehle ${days} din ka data safe rahega — minimum 14 din ki policy hai.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await clearOldData({ days });
      const base = res.data?.message || 'Done';
      const hint = res.data?.hint;
      setMessage(hint ? `✅ ${base}\n\n${hint}` : `✅ ${base}`);
      fetchTodayStats();
      fetchOverallStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear data');
    }
    setLoading(false);
  };

  const openFinalPaymentGateway = (payment, method) => {
  setError('');
  clearFinalPayTimers();
  if (method === 'cash') {
    // Direct cash settlement without gateway UI
    (async () => {
      try {
        await completeFinalPayment(payment._id, { method: 'cash' });
        setMessage(`✅ Cash settlement completed for ${payment.user?.name || 'Patient'}`);
        fetchPayments();
      } catch (err) {
        setError(err.response?.data?.message || 'Cash settlement failed');
      }
    })();
    return;
  }
  // For other methods, open the gateway modal
  finalPayContextRef.current = { paymentId: payment._id, method };
  setFinalPayMeta({
    method,
    amount: Number(payment.remainingAmount) || 0,
    patientName: payment.user?.name || 'Patient'
  });
  setFinalPayStep('phone');
  setFinalPayPhone('');
  setFinalPayOtp('');
  setShowFinalPayGateway(true);
};

  const closeFinalPaymentGateway = () => {
    clearFinalPayTimers();
    finalPayContextRef.current = null;
    setShowFinalPayGateway(false);
    setFinalPayStep('phone');
    setFinalPayPhone('');
    setFinalPayOtp('');
    setError('');
  };

  const handleFinalPayGatewayNext = () => {
  if (finalPayStep === 'phone') {
    // Validate phone/card input based on payment method
    const cleaned = String(finalPayPhone).replace(/\D/g, '');
    if (finalPayMeta.method === 'easypaisa' || finalPayMeta.method === 'jazzcash') {
      if (!/^03\d{9}$/.test(cleaned)) {
        setError('Please enter a valid 11‑digit mobile number starting with 03.');
        return;
      }
    } else if (finalPayMeta.method === 'card') {
      if (!/^\d{16}$/.test(cleaned)) {
        setError('Please enter a valid 16‑digit card number.');
        return;
      }
    }
    setFinalPayPhone(cleaned);
    setError('');
    setFinalPayStep('otp');
    return;
  }
  if (finalPayStep === 'otp') {
    if (!/^\d{4}$/.test(finalPayOtp)) {
      setError('Please enter the 4‑digit verification code.');
      return;
    }
    setError('');
    setFinalPayStep('processing');
    clearFinalPayTimers();
    const t1 = setTimeout(() => {
      setFinalPayStep('success');
      const t2 = setTimeout(async () => {
        const ctx = finalPayContextRef.current;
        try {
          await completeFinalPayment(ctx.paymentId, { method: ctx.method });
          setMessage(`✅ Remaining Rs. ${finalPayMeta.amount} — ${ctx.method} — ${finalPayMeta.patientName}`);
          fetchPayments();
        } catch (err) {
          setError(err.response?.data?.message || 'Payment failed');
        } finally {
          closeFinalPaymentGateway();
        }
      }, 1200);
      finalPayTimersRef.current.push(t2);
    }, 1800);
    // Removed duplicate final payment handling block
    finalPayTimersRef.current.push(t1);
    return;
  }
};

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    try {
      if (doctorForm._id) {
        await updateDoctor(doctorForm._id, doctorForm);
        setMessage('Doctor updated successfully!');
      } else {
        await addDoctor(doctorForm);
        setMessage('Doctor added successfully!');
      }
      setDoctorForm({
        name: '', specialization: '', email: '', phone: '',
        slotDuration: 15, maxPatientsPerDay: 20, consultationFee: 1000,
        schedule: [
          { day: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true },
          { day: 'Tuesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
          { day: 'Wednesday', startTime: '09:00', endTime: '17:00', isAvailable: true },
          { day: 'Thursday', startTime: '09:00', endTime: '17:00', isAvailable: true },
          { day: 'Friday', startTime: '09:00', endTime: '17:00', isAvailable: true },
        ]
      });
      fetchDoctors();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save doctor');
    }
  };

  const handleEditDoctor = (doc) => {
    setDoctorForm(doc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm('Delete this doctor?')) return;
    try {
      await deleteDoctor(id);
      setMessage('Doctor deleted successfully');
      fetchDoctors();
    } catch (err) {
      setError('Failed to delete doctor');
    }
  };

  const fpMethod = finalPayMeta.method;

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'queue', label: 'Queue Manager', icon: Users },
    ...(!isDoctor ? [{ id: 'doctors', label: 'Manage Doctors', icon: Stethoscope }] : []),
    ...(isDoctor ? [{ id: 'reports', label: 'Create Report', icon: FileText }] : []),
    ...(!isDoctor ? [{ id: 'payments', label: 'Financial Records', icon: CreditCard }] : []),
    { id: 'patientHistory', label: isDoctor ? 'Patient Lookup' : 'Reports & History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background Decorative Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Messages Overlay */}
      <AnimatePresence>
        {(message || error) && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none"
          >
            <div className={`shadow-xl rounded-2xl px-6 py-4 flex items-center gap-3 backdrop-blur-xl border ${
              message ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30 shadow-emerald-950/20' : 'bg-rose-950/80 text-rose-300 border-rose-500/30 shadow-rose-950/20'
            }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                message ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {message ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <span className="font-semibold text-sm whitespace-pre-line text-slate-200">{message || error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final Payment Gateway Modal */}
      <AnimatePresence>
        {showFinalPayGateway && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-800"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-teal-500/10 pointer-events-none"></div>

              <div className={`p-8 text-center text-white relative overflow-hidden border-b border-slate-800/80 ${
                fpMethod === 'easypaisa' ? 'bg-gradient-to-br from-emerald-900/30 to-emerald-950/20' : 
                fpMethod === 'jazzcash' ? 'bg-gradient-to-br from-red-950/30 to-red-950/20' : 'bg-gradient-to-br from-indigo-950/40 to-indigo-950/20'
              }`}>
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl"></div>

                <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
                  fpMethod === 'easypaisa' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                  fpMethod === 'jazzcash' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                }`}>
                  {fpMethod === 'card' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                </div>

                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-1">
                  Virtual Settlement terminal
                </p>
                <h2 className="text-2xl font-black tracking-tight text-slate-100">
                  {fpMethod === 'easypaisa' ? 'Easypaisa Secure' : fpMethod === 'jazzcash' ? 'JazzCash Secure' : 'Debit / Credit Card'}
                </h2>
                <p className="text-slate-400 text-xs mt-1 font-medium">
                  Patient Settlement: <span className="text-slate-200 font-bold">{finalPayMeta.patientName}</span>
                </p>
              </div>

              <div className="p-8 relative z-10">
                {finalPayStep === 'phone' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                    <div className="text-center bg-slate-950/50 p-5 rounded-3xl border border-slate-800">
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">Remaining Balance</p>
                      <p className="text-3xl font-black text-teal-400 mt-1">Rs. {finalPayMeta.amount}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                        {fpMethod === 'card' ? 'Card Number' : 'Account Mobile Number'}
                      </label>
                      <div className="relative">
                        <input 
                          type={fpMethod === 'card' ? 'text' : 'tel'}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-4 rounded-2xl text-lg font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                          placeholder={fpMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                          value={finalPayPhone}
                          onChange={(e) => setFinalPayPhone(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleFinalPayGatewayNext}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold text-[15px] shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2"
                    >
                      Process Collection <ChevronRight className="w-5 h-5" />
                    </button>
                    <button onClick={closeFinalPaymentGateway} className="w-full text-center text-slate-500 font-bold text-sm hover:text-slate-300 transition mt-2">
                      Cancel Collection
                    </button>
                  </motion.div>
                )}

                {finalPayStep === 'otp' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6 text-center">
                    <div className="w-16 h-16 bg-indigo-950/50 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-500/20 shadow-inner">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Enter verification code sent to</p>
                      <strong className="text-slate-200 text-lg block mt-1">{finalPayPhone}</strong>
                    </div>
                    <input 
                      type="text" maxLength="4"
                      className="w-44 mx-auto bg-slate-950/80 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-2xl text-3xl font-black tracking-[0.5em] text-center text-slate-100 focus:outline-none transition-all placeholder-slate-850"
                      placeholder="••••" value={finalPayOtp} onChange={(e) => setFinalPayOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus
                    />
                    
                    <button onClick={handleFinalPayGatewayNext} className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 py-4 rounded-2xl font-bold text-[15px] shadow-lg shadow-teal-500/10 hover:-translate-y-0.5 transition-all">
                      Confirm & Secure Payment
                    </button>
                    <button onClick={() => setFinalPayStep('phone')} className="text-slate-500 font-bold text-sm hover:text-slate-300 transition">Go Back</button>
                  </motion.div>
                )}

                {finalPayStep === 'processing' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-indigo-500 animate-spin"></div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-200">Verifying Transaction...</h3>
                    <p className="text-slate-500 text-xs mt-1">Collecting remaining Rs. {finalPayMeta.amount}</p>
                  </motion.div>
                )}

                {finalPayStep === 'success' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10 text-center">
                    <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-xl border border-emerald-500/30">
                      <Check className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-100">Payment Secured!</h3>
                    <p className="text-slate-400 text-xs mt-1">Status marked as Paid overall</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Header Navigation */}
      <nav className="bg-slate-950/80 border-b border-slate-800/60 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                <LayoutDashboard className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="font-black text-lg tracking-tight text-slate-100">City Medical <span className="text-indigo-400 font-bold">Admin Portal</span></h1>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mt-0.5">Control Command Center</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 bg-slate-900 border border-slate-850 px-4 py-2 rounded-2xl">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-glow"></div>
                <span className="text-xs font-black text-slate-300 tracking-wide uppercase">{user?.name}</span>
              </div>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={logoutUser} 
                className="text-slate-400 hover:text-rose-400 p-3 rounded-2xl bg-slate-900/60 border border-slate-850 transition-colors" 
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Responsive Grid Layout */}
      <div className="flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full flex-1">
        {/* Responsive Sidebar Navigation */}
        <aside className="w-full lg:w-72 bg-slate-950/20 border-r border-slate-900 lg:min-h-[calc(100vh-5rem)] flex-shrink-0 hide-scrollbar overflow-x-auto lg:overflow-y-auto">
          <div className="flex lg:flex-col p-6 gap-2 min-w-max lg:min-w-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-3.5 px-5 py-4 rounded-2xl font-bold text-sm transition-all whitespace-nowrap lg:whitespace-normal relative w-full ${
                    isActive ? 'text-indigo-400 font-extrabold bg-indigo-500/10 border-l-4 border-indigo-500' : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="tracking-wide">{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeAdminTabGlow"
                      className="absolute right-3 w-1.5 h-1.5 bg-indigo-400 rounded-full" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Dynamic Main Workspace Pane */}
        <main className="flex-1 p-6 sm:p-8 overflow-hidden relative z-10">
          
          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900/40 p-6 rounded-[2rem] border border-slate-900">
                <div>
                  <h2 className="text-3xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                    {isDoctor ? `Dr. ${serviceName}'s Command Center` : "Today's Control Desk"} <Sparkles className="w-5 h-5 text-indigo-400" />
                  </h2>
                  <p className="text-slate-400 text-sm mt-1 font-medium">
                    {isDoctor ? "Real-time patient queue details and clinical commands." : "Real-time analytical indicators and administration clean-up tools."}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  {!isDoctor && (
                    <>
                      <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold">
                        <span className="text-slate-400 font-bold whitespace-nowrap">Retention Period:</span>
                        <select
                          value={clearRetentionDays}
                          onChange={(e) => setClearRetentionDays(Number(e.target.value))}
                          className="bg-slate-900 border-none outline-none focus:ring-0 text-slate-200 font-black cursor-pointer pr-8"
                        >
                          {[14, 30, 60, 90, 180].map((d) => (
                            <option key={d} value={d} className="bg-slate-900">{d} Days</option>
                          ))}
                        </select>
                      </div>
                      
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleClearOldData} 
                        disabled={loading} 
                        className="px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 shrink-0"
                      >
                        <Trash2 className="w-4.5 h-4.5" /> Purge Old Data
                      </motion.button>
                    </>
                  )}
                  
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={fetchTodayStats} 
                    className="px-5 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 shrink-0"
                  >
                    <RefreshCw className="w-4.5 h-4.5" /> Refresh Live
                  </motion.button>
                </div>
              </div>

              {/* KPI Widgets Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { id: 'all', label: 'Total Walk-ins', value: todayStats?.totalPatients || 0, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', shadow: 'hover:shadow-indigo-950/30', icon: Users },
                  { id: 'completed', label: 'Visit Finished', value: todayStats?.completedPatients || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', shadow: 'hover:shadow-emerald-950/30', icon: CheckCircle2 },
                  { id: 'waiting', label: 'Pending Checkup', value: todayStats?.waitingPatients || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', shadow: 'hover:shadow-amber-950/30', icon: Clock },
                  { id: 'emergency', label: 'High Priority', value: todayStats?.emergencyPatients || 0, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', shadow: 'hover:shadow-rose-950/30', icon: AlertTriangle },
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -3 }}
                    onClick={() => { setSelectedType(stat.id); setShowDetails(true); }} 
                    className={`bg-slate-900/60 rounded-[2rem] border ${stat.border} p-6 cursor-pointer transition-all hover:bg-slate-900 ${stat.shadow} group relative overflow-hidden`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                      <stat.icon className="w-20 h-20 text-white" />
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${stat.bg}`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className="text-4xl font-black text-slate-100 tracking-tight">{stat.value}</div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                      {stat.label} <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Patient Details Sliding Overlay */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 15 }} 
                    className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
                  >
                    <div className="px-8 py-5 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/40">
                      <h3 className="font-extrabold text-slate-200 flex items-center gap-2.5 uppercase tracking-wider text-xs sm:text-sm">
                        <Activity className="w-5 h-5 text-indigo-400" /> {selectedType} Patients Detail Logs
                      </h3>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDetails(false)} 
                        className="text-slate-400 hover:bg-slate-800 hover:text-slate-200 p-2 rounded-xl transition"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                    
                    <div className="overflow-x-auto max-h-[620px]">
                      <table className="w-full text-left text-base whitespace-nowrap min-w-[1120px]">
                        <thead className="bg-slate-950/60 text-slate-300 font-extrabold uppercase tracking-wider text-xs border-b border-slate-850">
                          <tr>
                            <th className="px-8 py-4.5">Token Number</th>
                            <th className="px-8 py-4.5">Patient Profile</th>
                            <th className="px-8 py-4.5">Assigned Consultant</th>
                            <th className="px-8 py-4.5">Current Status</th>
                            <th className="px-8 py-4.5">Priority Pill</th>
                            <th className="px-8 py-4.5 text-center min-w-[170px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {(() => {
                            const dataSource = selectedType === 'Overall' ? overallStats?.allQueueHistory : todayStats?.allQueueToday;
                            if (!dataSource || dataSource.length === 0) return (
                              <tr>
                                <td colSpan="6" className="px-8 py-12 text-center text-slate-500 italic">
                                  No clinical queue records found.
                                </td>
                              </tr>
                            );
                            const filtered = dataSource.filter(q => (selectedType === 'all' || selectedType === 'Overall' ? true : selectedType === 'emergency' ? q.priority === 'emergency' : q.status === selectedType));
                            const sorted = [...filtered].sort((a, b) => (a.tokenNumber || 0) - (b.tokenNumber || 0));
                            if (filtered.length === 0) return (
                              <tr>
                                <td colSpan="6" className="px-8 py-12 text-center text-slate-400 italic text-sm">
                                  No records match this selective filter today.
                                </td>
                              </tr>
                            );
                            return sorted.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                                <td className="px-8 py-4.5 font-black text-indigo-300 text-xl">#{item.tokenNumber}</td>
                                <td className="px-8 py-4.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-sm uppercase">
                                      {item.user?.name ? item.user.name.slice(0,2) : 'WI'}
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-100 text-[15px]">{item.user?.name || 'Walk-in Patient'}</p>
                                      <p className="text-slate-400 text-xs tracking-wide mt-0.5">{item.user?.email || 'Registered over counter'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-4.5">
                                  <p className="font-bold text-slate-200 text-[15px]">
                                    Dr. {isDoctor ? (user?.name || item.serviceName) : item.serviceName}
                                  </p>
                                  <p className="text-slate-400 text-xs tracking-wide">Specialist</p>
                                </td>
                                <td className="px-8 py-4.5">
                                  <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                    item.status === 'serving' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse' :
                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-8 py-4.5">
                                  <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    item.priority === 'emergency' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {item.priority}
                                  </span>
                                </td>
                                <td className="px-8 py-4.5 text-center min-w-[170px]">
                                  {item.status === 'serving' && (
                                    <button
                                      onClick={() => handleInlineComplete(item.tokenNumber, item.serviceName, item._id)}
                                      className="w-24 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition shadow-md shadow-emerald-900/20"
                                    >
                                      Finish
                                    </button>
                                  )}
                                  {item.status === 'waiting' && (
                                    <button
                                      onClick={() => handleInlineCall(item.serviceName, item.tokenNumber, item._id)}
                                      className="w-24 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition shadow-md shadow-indigo-900/20"
                                    >
                                      Call
                                    </button>
                                  )}
                                  {item.status === 'completed' && (
                                    <span className="text-emerald-400 text-sm font-bold">Done</span>
                                  )}
                                  {item.status === 'cancelled' && (
                                    <span className="text-rose-400 text-sm font-bold">Cancelled</span>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Overall Analytics Grid */}
              <div className="space-y-5">
                <h3 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
                  <TrendingUp className="w-5 h-5 text-indigo-400" /> Clinic Historical Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <motion.div 
                    whileHover={{ y: -3 }}
                    onClick={() => { setSelectedType('Overall'); setShowDetails(true); }} 
                    className="bg-gradient-to-br from-indigo-900 to-slate-950 rounded-[2rem] p-8 border border-indigo-900/30 cursor-pointer shadow-lg group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                      <Users className="w-20 h-20 text-white" />
                    </div>
                    <div className="text-5xl font-black text-slate-100 tracking-tight">{overallStats?.totalPatients || 0}</div>
                    <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider mt-3 flex items-center justify-between">
                      Lifetime Tokens Served <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition" />
                    </div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ y: -3 }}
                    className="bg-gradient-to-br from-emerald-950/80 to-slate-950 rounded-[2rem] p-8 border border-emerald-950/30 shadow-lg group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                      <CheckCircle2 className="w-20 h-20 text-white" />
                    </div>
                    <div className="text-5xl font-black text-emerald-400 tracking-tight">{overallStats?.completionRate || '0%'}</div>
                    <div className="text-emerald-300 font-bold text-xs uppercase tracking-wider mt-3">Checkup Completion Rate</div>
                  </motion.div>

                  <motion.div 
                    whileHover={{ y: -3 }}
                    className="bg-gradient-to-br from-teal-950/80 to-slate-950 rounded-[2rem] p-8 border border-teal-950/30 shadow-lg group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                      <Stethoscope className="w-20 h-20 text-white" />
                    </div>
                    <div className="text-5xl font-black text-teal-400 tracking-tight truncate max-w-full">{overallStats?.mostBusyService || 'N/A'}</div>
                    <div className="text-teal-300 font-bold text-xs uppercase tracking-wider mt-3">High-Volume Specialist</div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== QUEUE MANAGER TAB ==================== */}
          {activeTab === 'queue' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
              <div>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight">Queue Flow Board</h2>
                <p className="text-slate-400 text-sm mt-1">Select clinical expert block to execute flow-actions like calling or checking out patients.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Select Active Doctor Session</label>
                  <select
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    disabled={isDoctor}
                    className="w-full px-5 py-4 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-2xl font-bold text-base focus:outline-none transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-slate-900 text-slate-500">-- Choose Consultant Doctor --</option>
                    {doctors.map(doc => (
                      <option key={doc._id} value={doc.name} className="bg-slate-900">Dr. {doc.name} ({doc.specialization})</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-850">
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className="bg-indigo-950/10 rounded-3xl p-6 border border-indigo-500/10 text-center flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/10">
                        <Activity className="w-6 h-6 animate-pulse" />
                      </div>
                      <h3 className="font-extrabold text-slate-100 text-lg mb-1">Call Next Patient</h3>
                      <p className="text-xs text-indigo-300 max-w-xs mx-auto mb-6 leading-relaxed">
                        Calls the top waiting patient in priority hierarchy for <strong className="text-slate-200 font-bold">{serviceName ? `Dr. ${serviceName}` : 'Doctor'}</strong>.
                      </p>
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleCallNext} 
                      disabled={loading || !serviceName} 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition disabled:opacity-40 shadow-lg shadow-indigo-900/30 w-full"
                    >
                      Call Next (🔔 Sound Alert)
                    </motion.button>
                  </motion.div>

                  <motion.div 
                    whileHover={{ y: -2 }}
                    className="bg-emerald-950/10 rounded-3xl p-6 border border-emerald-500/10 text-center flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/10">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-extrabold text-slate-100 text-lg mb-1">Complete Visit Slot</h3>
                      <p className="text-xs text-emerald-300 max-w-xs mx-auto mb-6 leading-relaxed">
                        Mark a completed clinical visit by referencing the patient token explicitly.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="number" 
                        placeholder="Token No. (e.g. 5)" 
                        value={tokenNumber} 
                        onChange={(e) => setTokenNumber(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 px-4 py-3 rounded-2xl font-bold text-center text-slate-200 text-sm focus:outline-none transition-all placeholder-slate-700"
                      />
                      <motion.button 
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleComplete} 
                        disabled={loading || !tokenNumber || !serviceName} 
                        className="bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-6 rounded-2xl font-black text-sm tracking-wide transition disabled:opacity-40 shadow-lg shadow-emerald-900/30 w-full"
                      >
                        Finish Visit ✅
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== DOCTORS TAB ==================== */}
          {activeTab === 'doctors' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight">Manage Doctors</h2>
                <p className="text-slate-400 text-sm mt-1">Configure specialist doctors, fees structure, email data, and patient slots caps.</p>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                
                {/* Doctor Form Panel */}
                <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] overflow-hidden xl:col-span-1 shadow-xl">
                  <div className="bg-slate-950/50 px-6 py-5 border-b border-slate-850/80">
                    <h3 className="font-extrabold text-slate-200 flex items-center gap-2.5 text-xs sm:text-sm uppercase tracking-wider">
                      <UserPlus className="w-5 h-5 text-indigo-400" /> {doctorForm._id ? 'Edit Specialist Details' : 'Add New Consultant'}
                    </h3>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleDoctorSubmit} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Doctor Full Name</label>
                        <input type="text" required value={doctorForm.name} onChange={e=>setDoctorForm({...doctorForm, name:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700" placeholder="e.g. Ali Khan"/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Specialization Category</label>
                        <input type="text" required value={doctorForm.specialization} onChange={e=>setDoctorForm({...doctorForm, specialization:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700" placeholder="e.g. Cardiologist"/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Email ID</label>
                        <input type="email" required value={doctorForm.email} onChange={e=>setDoctorForm({...doctorForm, email:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700" placeholder="e.g. doctor@clinic.com"/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Contact Number</label>
                        <input type="text" required value={doctorForm.phone} onChange={e=>setDoctorForm({...doctorForm, phone:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700" placeholder="e.g. 03001234567"/>
                      </div>
                      {!doctorForm._id && (
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Login Password</label>
                          <input type="password" required={!doctorForm._id} value={doctorForm.password || ''} onChange={e=>setDoctorForm({...doctorForm, password:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700" placeholder="At least 6 characters"/>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Consultation Fee (Rs.)</label>
                        <input type="number" required value={doctorForm.consultationFee} onChange={e=>setDoctorForm({...doctorForm, consultationFee:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all"/>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Duration (min)</label>
                          <input type="number" required value={doctorForm.slotDuration} onChange={e=>setDoctorForm({...doctorForm, slotDuration:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all"/>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Max Patients/Day</label>
                          <input type="number" required value={doctorForm.maxPatientsPerDay} onChange={e=>setDoctorForm({...doctorForm, maxPatientsPerDay:e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all"/>
                        </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wide transition shadow-lg shadow-indigo-900/20">
                          {doctorForm._id ? 'Update' : 'Add Doctor'}
                        </button>
                        {doctorForm._id && (
                          <button type="button" onClick={() => setDoctorForm({name:'', specialization:'', email:'', phone:'', slotDuration:15, maxPatientsPerDay:20, consultationFee:1000, schedule:[]})} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wide transition">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* Doctor Cards Container */}
                <div className="xl:col-span-2 space-y-4">
                  <h3 className="text-lg font-black text-slate-100 flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-indigo-400" /> Active Specialist Roster
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {doctors.map(doc => (
                      <motion.div 
                        key={doc._id} 
                        whileHover={{ y: -2 }}
                        className="bg-slate-900 border border-slate-850 rounded-[2rem] p-6 flex flex-col justify-between gap-5 relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>

                        <div className="flex gap-4">
                          <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-500/20">
                            <Stethoscope className="w-7 h-7" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-100 text-lg group-hover:text-indigo-400 transition-colors">Dr. {doc.name}</h4>
                            <p className="text-indigo-400 font-bold text-xs uppercase tracking-wider mt-0.5">{doc.specialization}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                <Banknote className="w-3.5 h-3.5 text-slate-500" /> Rs. {doc.consultationFee}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                <Users className="w-3.5 h-3.5 text-slate-500" /> {doc.maxPatientsPerDay}/day
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                <Clock className="w-3.5 h-3.5 text-slate-500" /> {doc.slotDuration}m
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2.5 pt-4 border-t border-slate-850/80 mt-auto">
                          <button onClick={() => handleEditDoctor(doc)} className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/10 rounded-xl transition flex justify-center items-center gap-2 font-bold text-xs uppercase tracking-wide"><Edit2 className="w-3.5 h-3.5"/> Edit</button>
                          <button onClick={() => handleDeleteDoctor(doc._id)} className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-xl transition flex justify-center items-center gap-2 font-bold text-xs uppercase tracking-wide"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ==================== MEDICAL REPORTS TAB ==================== */}
          {activeTab === 'reports' && isDoctor && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
              <div>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight">Create Medical Report</h2>
                <p className="text-slate-400 text-sm mt-1">Only doctors can generate reports. Select a patient who booked with you.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative">
                <form onSubmit={handleCreateReport} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Select Patient Profile</label>
                      <select required value={reportForm.patientId} onChange={(e) => handlePatientChange(e.target.value)} className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl font-semibold text-sm focus:outline-none cursor-pointer">
                        <option value="" className="bg-slate-900 text-slate-500">-- Choose Patient --</option>
                        {users.filter(u => u.role === 'user').map(u => (
                          <option key={u._id} value={u._id} className="bg-slate-900">{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Select Attending Doctor</label>
                      <select required value={reportForm.doctorId} onChange={(e) => setReportForm({...reportForm, doctorId: e.target.value})} disabled={isDoctor} className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-xl font-semibold text-sm focus:outline-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed">
                        <option value="" className="bg-slate-900 text-slate-500">-- Choose Doctor --</option>
                        {doctors.map(d => (
                          <option key={d._id} value={d._id} className="bg-slate-900">Dr. {d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Clinical Diagnosis</label>
                    <input type="text" required value={reportForm.diagnosis} onChange={(e) => setReportForm({...reportForm, diagnosis: e.target.value})} placeholder="e.g. Acute Gastritis, Seasonal Viral Fever" className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all placeholder-slate-700"/>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Reported Symptoms</label>
                    <textarea value={reportForm.symptoms} onChange={(e) => setReportForm({...reportForm, symptoms: e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3.5 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all resize-none placeholder-slate-700" rows="3" placeholder="Enter patient complaints..."></textarea>
                  </div>

                  <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-850">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Activity className="w-4.5 h-4.5 text-indigo-400" /> Vitals Mapping</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <input type="text" placeholder="BP (e.g. 120/80)" value={reportForm.bloodPressure} onChange={(e) => setReportForm({...reportForm, bloodPressure: e.target.value})} className="bg-slate-900 border border-slate-800 focus:border-indigo-500 px-3 py-2.5 rounded-xl text-slate-200 font-semibold text-xs focus:outline-none text-center"/>
                      <input type="text" placeholder="Temp (e.g. 98.6 °F)" value={reportForm.temperature} onChange={(e) => setReportForm({...reportForm, temperature: e.target.value})} className="bg-slate-900 border border-slate-800 focus:border-indigo-500 px-3 py-2.5 rounded-xl text-slate-200 font-semibold text-xs focus:outline-none text-center"/>
                      <input type="text" placeholder="Weight (e.g. 70 kg)" value={reportForm.weight} onChange={(e) => setReportForm({...reportForm, weight: e.target.value})} className="bg-slate-900 border border-slate-800 focus:border-indigo-500 px-3 py-2.5 rounded-xl text-slate-200 font-semibold text-xs focus:outline-none text-center"/>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Prescription Builder</h3>
                      <button type="button" onClick={addMedicine} className="text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 border border-indigo-500/10 rounded-xl text-xs font-bold hover:bg-indigo-500/20 transition">+ Add Medicine</button>
                    </div>
                    
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                      {reportForm.prescription.map((med, index) => (
                        <div key={index} className="flex gap-2 items-center bg-slate-950/60 p-3.5 rounded-xl border border-slate-850">
                          <input type="text" placeholder="Medicine Name" value={med.medicineName} onChange={(e) => updateMedicine(index, 'medicineName', e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" required />
                          <input type="text" placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedicine(index, 'dosage', e.target.value)} className="w-24 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" />
                          <input type="text" placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedicine(index, 'frequency', e.target.value)} className="w-28 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" />
                          <input type="text" placeholder="Days" value={med.duration} onChange={(e) => updateMedicine(index, 'duration', e.target.value)} className="w-20 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Physician's Notes / Directives</label>
                    <textarea value={reportForm.doctorNotes} onChange={(e) => setReportForm({...reportForm, doctorNotes: e.target.value})} className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 px-4 py-3 rounded-xl text-sm font-semibold text-slate-200 focus:outline-none transition-all resize-none placeholder-slate-700" rows="2" placeholder="Dietary restrictions or rest instructions..."></textarea>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-slate-850">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-black uppercase tracking-wider text-slate-400">
                      <input type="checkbox" checked={reportForm.followUp} onChange={(e) => setReportForm({...reportForm, followUp: e.target.checked})} className="w-5 h-5 bg-slate-950 border border-slate-800 text-indigo-500 rounded focus:ring-0" />
                      Requires Follow-up Checkup
                    </label>
                    <input type="date" value={reportForm.nextAppointment} onChange={(e) => setReportForm({...reportForm, nextAppointment: e.target.value})} className="px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer" />
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/30 mt-4 transition-all">
                    Compile & Save Medical Report
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* ==================== PAYMENTS TAB ==================== */}
          {activeTab === 'payments' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-100 tracking-tight">Financial Records</h2>
                  <p className="text-slate-400 text-sm mt-1">View advance collections, balance payments, and finalize over-the-counter settlements.</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchPayments} 
                  className="px-5 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-2xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh Ledger
                </motion.button>
              </div>
              
              <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-850">
                      <tr>
                        <th className="px-6 py-5">Patient Details</th>
                        <th className="px-6 py-5">Total Fee</th>
                        <th className="px-6 py-5">Paid Advance</th>
                        <th className="px-6 py-5">Outstanding</th>
                        <th className="px-6 py-5 text-center">Settlement Actions</th>
                        <th className="px-6 py-5">Settlement Status</th>
                        <th className="px-6 py-5">Advance Mode</th>
                        <th className="px-6 py-5">Final Settled By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {payments.map((p) => {
                        const isPending = p.finalStatus === 'pending' || p.finalStatus === 'partial';
                        const advDesc = describeAdvancePayment(p);
                        const finalDesc = describeFinalSettlement(p);
                        return (
                          <tr key={p._id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-5">
                              <p className="font-bold text-slate-200">{p.user?.name || 'Walk-in'}</p>
                              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide mt-0.5">Token: #{p.queue?.tokenNumber || '-'}</p>
                            </td>
                            <td className="px-6 py-5 font-bold text-slate-200">Rs. {p.totalAmount}</td>
                            <td className="px-6 py-5 text-emerald-400 font-bold">Rs. {p.paidAmount}</td>
                            <td className="px-6 py-5 text-rose-400 font-bold">Rs. {p.remainingAmount}</td>
                            <td className="px-6 py-5 text-center">
                              {isPending ? (
                                <div className="flex gap-2 justify-center flex-wrap min-w-[180px]">
                                  <button onClick={() => openFinalPaymentGateway(p, 'cash')} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition">Cash</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'card')} className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition">Card</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'easypaisa')} className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition">Easypaisa</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'jazzcash')} className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition">JazzCash</button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-bold uppercase tracking-wider"><Check className="w-3.5 h-3.5 text-emerald-400" /> Settled</span>
                              )}
                            </td>
                            <td className="px-6 py-5">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isPending ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {isPending ? 'Pending Balance' : 'Fully Settled'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-slate-400 text-xs">{advDesc}</td>
                            <td className="px-6 py-5 text-slate-400 text-xs">{finalDesc || '—'}</td>
                          </tr>
                        );
                      })}
                      {payments.length === 0 && (
                        <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500 italic">No historical financial records on registry ledger.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== PATIENT HISTORY TAB ==================== */}
          {activeTab === 'patientHistory' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-3xl font-black text-slate-100 tracking-tight">Patient Search Lookup</h2>
                <p className="text-slate-400 text-sm mt-1">
                  {isDoctor
                    ? 'Search your patients, view visit history and past reports.'
                    : 'Superadmin view only: search patients and read medical reports (doctors create reports).'}
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <select
                    value={historyUserId}
                    onChange={(e) => setHistoryUserId(e.target.value)}
                    className="flex-1 px-5 py-4 bg-slate-950/60 border border-slate-800 focus:border-indigo-500 text-slate-200 rounded-2xl font-bold text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-500">-- Select Patient Profile to Fetch --</option>
                    {users.filter(u => u.role !== 'admin').map(u => (
                      <option key={u._id} value={u._id} className="bg-slate-900">{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => loadPatientHistory(historyUserId)}
                    disabled={!historyUserId || patientHistoryLoading}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition disabled:opacity-40 shadow-lg shadow-indigo-900/20 whitespace-nowrap"
                  >
                    {patientHistoryLoading ? 'Searching...' : 'View History'}
                  </motion.button>
                </div>

                {patientHistoryData?.patient && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                    
                    {/* Patient Card Banner */}
                    <div className="bg-indigo-500/10 rounded-[2rem] p-6 flex flex-col sm:flex-row justify-between sm:items-center border border-indigo-500/20 gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-indigo-400">{patientHistoryData.patient.name}</h3>
                        <p className="text-slate-350 text-sm mt-1.5 font-medium">{patientHistoryData.patient.email} | Contact: {patientHistoryData.patient.phone || '—'}</p>
                      </div>
                      <div className="bg-slate-950/50 px-5 py-3 rounded-2xl border border-slate-800">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Consultation Visits</span>
                        <span className="block text-3xl font-black text-indigo-400 text-right mt-1">{(patientHistoryData.visits ?? []).length}</span>
                      </div>
                    </div>

                    {/* Timeline Checkups */}
                    <div>
                      <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-xs sm:text-sm mb-4 flex items-center gap-2.5">
                        <History className="w-5 h-5 text-indigo-400" /> Clinical Visit Timelines
                      </h4>
                      <div className="space-y-4">
                        {(patientHistoryData.visits ?? []).length === 0 ? (
                          <p className="text-slate-500 italic bg-slate-950/30 p-6 rounded-2xl text-center border border-slate-850">No clinical appointment logs.</p>
                        ) : (
                          (patientHistoryData.visits ?? []).map((q) => {
                            const vs = visitStatusLabel(q.status);
                            return (
                              <motion.div 
                                key={q._id} 
                                whileHover={{ x: 2 }}
                                className="bg-slate-950/30 border border-slate-850 rounded-3xl p-6 hover:border-slate-800 transition"
                              >
                                <div className="flex flex-wrap justify-between items-start gap-4 mb-4 border-b border-slate-900 pb-4">
                                  <div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h5 className="font-extrabold text-slate-200 text-lg">Dr. {q.serviceName}</h5>
                                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${vs.cls}`}>{vs.text}</span>
                                    </div>
                                    <p className="text-slate-550 text-xs mt-1.5 font-semibold">Appointment Date: {formatHistoryDay(q.appointmentDate)} (Token: #{q.tokenNumber})</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Booked Timestamp</p>
                                    <p className="text-xs text-slate-400 font-bold">{formatHistoryDate(q.createdAt)}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-850">
                                    <span className="text-[9px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Directives / Symptoms notes</span>
                                    <span className="text-xs text-slate-300 font-semibold">{q.notes || 'No notes noted over checkin desk.'}</span>
                                  </div>
                                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-850">
                                    <span className="text-[9px] font-black text-slate-500 block uppercase tracking-wider mb-1.5">Session Priority</span>
                                    <span className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${q.priority === 'emergency' ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                                      {q.priority === 'emergency' ? 'Emergency Case 🚨' : 'Standard Priority'}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Medical Reports */}
                    <div>
                      <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-xs sm:text-sm mb-4 flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-indigo-400" /> Diagnostic Medical Reports
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(patientHistoryData.reports ?? []).length === 0 ? (
                          <p className="text-slate-550 italic bg-slate-950/30 p-6 rounded-2xl text-center border border-slate-850 md:col-span-2 text-xs">No compiled medical records found on database logs.</p>
                        ) : (
                          (patientHistoryData.reports ?? []).map((r) => (
                            <div key={r._id} className="bg-slate-950/40 border border-slate-850 rounded-3xl p-5 text-sm hover:border-slate-800 transition relative overflow-hidden group">
                              <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full blur-lg"></div>
                              <div className="flex justify-between items-start gap-2 mb-3">
                                <span className="font-black text-slate-200 text-sm tracking-wide group-hover:text-indigo-400 transition-colors">{r.diagnosis}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{formatHistoryDay(r.createdAt)}</span>
                              </div>
                              <p className="text-xs text-slate-450 font-bold">
                                Practitioner: <span className="text-slate-350">Dr. {r.doctor?.name || 'Physician'}</span> · Token: #{r.queue?.tokenNumber ?? '—'}
                              </p>
                              {r.symptoms && (
                                <div className="mt-3 pt-3 border-t border-slate-900/60">
                                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Symptoms Description</p>
                                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{r.symptoms}</p>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Financial Ledger */}
                    <div>
                      <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-xs sm:text-sm mb-4 flex items-center gap-2.5">
                        <CreditCard className="w-5 h-5 text-indigo-400" /> Billing Log Ledger
                      </h4>
                      <div className="bg-slate-950/20 border border-slate-850 rounded-3xl overflow-hidden">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-900">
                            <tr>
                              <th className="px-5 py-4.5">Receipt Date</th>
                              <th className="px-5 py-4.5">Total Amount</th>
                              <th className="px-5 py-4.5">Paid Advance</th>
                              <th className="px-5 py-4.5">Remaining Bal</th>
                              <th className="px-5 py-4.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900/80">
                            {(patientHistoryData.payments ?? []).length === 0 ? (
                              <tr>
                                <td colSpan="5" className="px-5 py-8 text-center text-slate-500 italic">No receipt records located.</td>
                              </tr>
                            ) : (
                              (patientHistoryData.payments ?? []).map((p) => (
                                <tr key={p._id} className="hover:bg-slate-900/30">
                                  <td className="px-5 py-4 text-slate-400 font-semibold">{formatHistoryDate(p.createdAt)}</td>
                                  <td className="px-5 py-4 font-bold text-slate-200">Rs. {p.totalAmount ?? 0}</td>
                                  <td className="px-5 py-4 text-emerald-400 font-bold">Rs. {p.paidAmount ?? p.advanceAmount ?? 0}</td>
                                  <td className="px-5 py-4 text-rose-400 font-bold">Rs. {p.remainingAmount ?? 0}</td>
                                  <td className="px-5 py-4">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                                      p.finalStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {p.finalStatus || 'pending'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </motion.div>
          )}

        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;