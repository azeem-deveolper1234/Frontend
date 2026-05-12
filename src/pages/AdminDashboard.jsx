import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  callNextPatient, completeQueue, getAnalyticsToday, getAnalyticsOverall, 
  getAllPayments, createMedicalReport, getAllUsers, getAllDoctors,
  getPatientQueue, getQueuePayment, completeFinalPayment, addDoctor,
  updateDoctor, deleteDoctor, clearOldData, getPatientClinicHistory
} from '../services/api';

import { 
  LayoutDashboard, Users, UserPlus, Stethoscope, FileText, 
  CreditCard, History, LogOut, CheckCircle2, AlertCircle, 
  Clock, Activity, Trash2, Edit2, Wallet, Banknote, ShieldCheck, 
  RefreshCw, ChevronRight, X, User, Lock
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
  if (s === 'completed') return { text: 'Completed', cls: 'bg-emerald-100 text-emerald-800' };
  if (s === 'cancelled') return { text: 'Cancelled', cls: 'bg-red-100 text-red-800' };
  if (s === 'serving') return { text: 'Serving', cls: 'bg-indigo-100 text-indigo-800' };
  return { text: 'Waiting', cls: 'bg-amber-100 text-amber-900' };
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
  /** Clear old data: backend minimum 14 days — is se zyada purana hi delete hota hai */
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

  useEffect(() => {
    fetchTodayStats();
    fetchOverallStats();
    fetchDoctors(); 
  }, []);

  useEffect(() => {
    return () => clearFinalPayTimers();
  }, []);

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
      setUsers(res.data);
    } catch (err) {}
  };

  const fetchDoctors = async () => {
    try {
      const res = await getAllDoctors();
      setDoctors(res.data);
      if(res.data.length > 0 && !serviceName) {
          setServiceName(res.data[0].name);
      }
    } catch (err) {}
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
      setError(err.response?.data?.message || 'Failed');
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
      setError(err.response?.data?.message || 'Failed');
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
    const ctx = finalPayContextRef.current;
    if (!ctx?.paymentId) return;

    if (finalPayStep === 'phone') {
      if (!String(finalPayPhone).trim()) {
        setError(finalPayMeta.method === 'card' ? 'Card number required.' : 'Mobile number required.');
        return;
      }
      setError('');
      setFinalPayStep('otp');
      return;
    }

    if (finalPayStep === 'otp') {
      if (finalPayOtp.length < 4) {
        setError('4-digit OTP required.');
        return;
      }
      setError('');
      setFinalPayStep('processing');
      clearFinalPayTimers();

      const t1 = setTimeout(() => {
        setFinalPayStep('success');
        const t2 = setTimeout(async () => {
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
      finalPayTimersRef.current.push(t1);
    }
  };

  // Add/Edit/Delete Doctor Logic
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
    { id: 'queue', label: 'Queue', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'patientHistory', label: 'History', icon: History },
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
            className="fixed top-20 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none"
          >
            <div className={`shadow-lg rounded-full px-6 py-3 flex items-center gap-3 backdrop-blur-md ${message ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
              {message ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium text-sm whitespace-pre-line">{message || error}</span>
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden relative border-t-[6px] ${
                fpMethod === 'easypaisa' ? 'border-emerald-500' : fpMethod === 'jazzcash' ? 'border-red-600' : 'border-indigo-600'
              }`}
            >
              <div className={`p-8 text-center text-white relative overflow-hidden ${
                fpMethod === 'easypaisa' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 
                fpMethod === 'jazzcash' ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-indigo-600 to-indigo-800'
              }`}>
                <div className="absolute inset-0 bg-white/10 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 mb-2 relative z-10 font-bold">
                  Admin Virtual Terminal
                </p>
                <h2 className="text-2xl font-bold tracking-tight relative z-10 flex items-center justify-center gap-2">
                  {fpMethod === 'card' ? <CreditCard className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                  {fpMethod === 'easypaisa' ? 'Easypaisa' : fpMethod === 'jazzcash' ? 'JazzCash' : 'Secure Card'}
                </h2>
                <p className="text-white/90 text-sm mt-1 font-medium relative z-10">
                  Balance Collection — {finalPayMeta.patientName}
                </p>
              </div>

              <div className="p-8">
                {finalPayStep === 'phone' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-5">
                    <div className="text-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">Amount Due</p>
                      <p className="text-3xl font-bold text-slate-800 mt-1">Rs. {finalPayMeta.amount}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        {fpMethod === 'card' ? 'Card Number' : 'Mobile Number'}
                      </label>
                      <input 
                        type={fpMethod === 'card' ? 'text' : 'tel'}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl text-lg font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        placeholder={fpMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                        value={finalPayPhone}
                        onChange={(e) => setFinalPayPhone(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={handleFinalPayGatewayNext}
                      className={`w-full py-4 rounded-xl text-white font-bold text-[15px] shadow-lg transition-all hover:-translate-y-0.5 flex justify-center items-center gap-2 ${
                        fpMethod === 'easypaisa' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25' : 
                        fpMethod === 'jazzcash' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                      }`}
                    >
                      Process Payment <ChevronRight className="w-5 h-5" />
                    </button>
                    <button onClick={closeFinalPaymentGateway} className="w-full text-center text-slate-500 font-medium text-sm mt-2 hover:text-slate-800 transition">
                      Cancel
                    </button>
                  </motion.div>
                )}

                {finalPayStep === 'otp' && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6 text-center">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-slate-600 text-sm">Enter verification code sent to</p>
                      <strong className="text-slate-800 text-lg block mt-1">{finalPayPhone}</strong>
                    </div>
                    <input 
                      type="text" maxLength="4"
                      className="w-40 mx-auto bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-3xl font-bold tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      placeholder="1234" value={finalPayOtp} onChange={(e) => setFinalPayOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus
                    />
                    <button onClick={handleFinalPayGatewayNext} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all">
                      Verify & Collect
                    </button>
                    <button onClick={() => setFinalPayStep('phone')} className="text-slate-500 font-medium text-sm hover:text-slate-800 transition">Go Back</button>
                  </motion.div>
                )}

                {finalPayStep === 'processing' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                      <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                        fpMethod === 'easypaisa' ? 'border-emerald-500' : fpMethod === 'jazzcash' ? 'border-red-500' : 'border-indigo-600'
                      }`}></div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Processing...</h3>
                  </motion.div>
                )}

                {finalPayStep === 'success' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10 text-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl ${
                      fpMethod === 'easypaisa' ? 'bg-emerald-100 text-emerald-500 shadow-emerald-500/20' : 
                      fpMethod === 'jazzcash' ? 'bg-red-100 text-red-500 shadow-red-500/20' : 'bg-indigo-100 text-indigo-500 shadow-indigo-500/20'
                    }`}>
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">Payment Secured!</h3>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h1 className="font-bold text-lg tracking-tight">City Medical <span className="text-indigo-400 font-medium">Admin</span></h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="text-xs font-semibold text-slate-300">{user?.name}</span>
              </div>
              <button onClick={logoutUser} className="text-slate-400 hover:text-red-400 p-2 rounded-full hover:bg-slate-800 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row max-w-[1400px] mx-auto w-full">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 bg-white border-r border-slate-200 lg:min-h-[calc(100vh-4rem)] flex-shrink-0 hide-scrollbar overflow-x-auto lg:overflow-y-auto">
          <div className="flex lg:flex-col p-4 gap-2">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap lg:whitespace-normal ${
                    isActive ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-hidden">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Today's Overview</h2>
                  <p className="text-slate-500 text-sm mt-1">Live clinic statistics for today</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-500 sm:text-sm">
                    <span className="whitespace-nowrap font-medium text-slate-600">Delete older than</span>
                    <select
                      value={clearRetentionDays}
                      onChange={(e) => setClearRetentionDays(Number(e.target.value))}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      {[14, 30, 60, 90, 180].map((d) => (
                        <option key={d} value={d}>{d} days</option>
                      ))}
                    </select>
                    <span className="text-[11px] sm:text-xs text-slate-400 max-w-[200px] sm:max-w-none">(min 14 — recent data safe)</span>
                  </label>
                  <button onClick={handleClearOldData} disabled={loading} className="px-4 py-2 bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold transition flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Clean Data
                  </button>
                  <button onClick={fetchTodayStats} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { id: 'all', label: 'Total Patients', value: todayStats?.totalPatients || 0, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Users },
                  { id: 'completed', label: 'Completed', value: todayStats?.completedPatients || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
                  { id: 'waiting', label: 'Waiting', value: todayStats?.waitingPatients || 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                  { id: 'emergency', label: 'Emergency', value: todayStats?.emergencyPatients || 0, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
                ].map((stat, i) => (
                  <div key={i} onClick={() => { setSelectedType(stat.id); setShowDetails(true); }} className="bg-white rounded-3xl border border-slate-200 p-6 cursor-pointer hover:shadow-soft transition-all hover:-translate-y-1 group">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${stat.bg}`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</div>
                    <div className="text-slate-500 text-sm font-medium mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* DETAILS TABLE */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider text-sm">
                        <Activity className="w-4 h-4 text-slate-400" /> {selectedType} Patients List
                      </h3>
                      <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-1.5 rounded-lg transition"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                          <tr>
                            <th className="px-6 py-3 border-b border-slate-200">Token</th>
                            <th className="px-6 py-3 border-b border-slate-200">Patient</th>
                            <th className="px-6 py-3 border-b border-slate-200">Doctor</th>
                            <th className="px-6 py-3 border-b border-slate-200">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const dataSource = selectedType === 'Overall' ? overallStats?.allQueueHistory : todayStats?.allQueueToday;
                            if (!dataSource || dataSource.length === 0) return <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No records found.</td></tr>;
                            return dataSource
                              .filter(q => (selectedType === 'all' || selectedType === 'Overall' ? true : selectedType === 'emergency' ? q.priority === 'emergency' : q.status === selectedType))
                              .map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-6 py-4 font-bold text-slate-800">#{item.tokenNumber}</td>
                                  <td className="px-6 py-4 text-slate-600 font-medium">{item.user?.name || 'Walk-in'}</td>
                                  <td className="px-6 py-4 text-slate-500">{item.serviceName}</td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                      item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {item.status}
                                    </span>
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

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 mt-8">Overall Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div onClick={() => { setSelectedType('Overall'); setShowDetails(true); }} className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-8 text-white cursor-pointer hover:shadow-lg transition group">
                    <div className="text-4xl font-black">{overallStats?.totalPatients || 0}</div>
                    <div className="text-indigo-200 font-medium mt-1 flex items-center justify-between">Total Patients Ever <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" /></div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-8 text-white">
                    <div className="text-4xl font-black">{overallStats?.completionRate || '0%'}</div>
                    <div className="text-emerald-200 font-medium mt-1">Completion Rate</div>
                  </div>
                  <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-3xl p-8 text-white">
                    <div className="text-4xl font-black truncate">{overallStats?.mostBusyService || 'N/A'}</div>
                    <div className="text-violet-200 font-medium mt-1">Most Busy Doctor</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* QUEUE MANAGER TAB */}
          {activeTab === 'queue' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Queue Manager</h2>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Doctor to Manage</label>
                <select
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(doc => (
                    <option key={doc._id} value={doc.name}>Dr. {doc.name}</option>
                  ))}
                </select>
                
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 text-center mb-6">
                    <h3 className="font-bold text-indigo-900 mb-1">Call Next Patient</h3>
                    <p className="text-sm text-indigo-600 mb-4">Automatically calls the next person in line for {serviceName || 'selected doctor'}.</p>
                    <button onClick={handleCallNext} disabled={loading || !serviceName} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition disabled:opacity-50 w-full sm:w-auto shadow-md">
                      Next Please 🔔
                    </button>
                  </div>

                  <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 text-center">
                    <h3 className="font-bold text-emerald-900 mb-1">Complete Visit</h3>
                    <p className="text-sm text-emerald-600 mb-4">Mark a specific token as completed.</p>
                    <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto">
                      <input
                        type="number" placeholder="Token No." value={tokenNumber} onChange={(e) => setTokenNumber(e.target.value)}
                        className="flex-1 px-4 py-3 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-center sm:text-left"
                      />
                      <button onClick={handleComplete} disabled={loading || !tokenNumber || !serviceName} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50 shadow-md">
                        Done ✅
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* DOCTORS TAB */}
          {activeTab === 'doctors' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h2 className="text-2xl font-bold text-slate-800">Manage Doctors</h2>
              
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><UserPlus className="w-5 h-5 text-indigo-500" /> {doctorForm._id ? 'Edit Doctor' : 'Add New Doctor'}</h3>
                </div>
                <div className="p-6">
                  <form onSubmit={handleDoctorSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                        <input type="text" required value={doctorForm.name} onChange={e=>setDoctorForm({...doctorForm, name:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" placeholder="Dr. Ali"/>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Specialization</label>
                        <input type="text" required value={doctorForm.specialization} onChange={e=>setDoctorForm({...doctorForm, specialization:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" placeholder="Cardiologist"/>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                        <input type="email" required value={doctorForm.email} onChange={e=>setDoctorForm({...doctorForm, email:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" placeholder="doctor@clinic.com"/>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                        <input type="text" required value={doctorForm.phone} onChange={e=>setDoctorForm({...doctorForm, phone:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500" placeholder="03001234567"/>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Consultation Fee (Rs.)</label>
                        <input type="number" required value={doctorForm.consultationFee} onChange={e=>setDoctorForm({...doctorForm, consultationFee:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"/>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Slot Duration (min)</label>
                          <input type="number" required value={doctorForm.slotDuration} onChange={e=>setDoctorForm({...doctorForm, slotDuration:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Max Patients/Day</label>
                          <input type="number" required value={doctorForm.maxPatientsPerDay} onChange={e=>setDoctorForm({...doctorForm, maxPatientsPerDay:e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-md">
                        {doctorForm._id ? 'Update Doctor' : 'Save Doctor'}
                      </button>
                      {doctorForm._id && (
                        <button type="button" onClick={() => setDoctorForm({name:'', specialization:'', email:'', phone:'', slotDuration:15, maxPatientsPerDay:20, consultationFee:1000, schedule:[]})} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {doctors.map(doc => (
                  <div key={doc._id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">Dr. {doc.name}</h4>
                        <p className="text-indigo-600 font-medium text-sm mb-1">{doc.specialization}</p>
                        <p className="text-slate-500 text-xs">Fee: Rs. {doc.consultationFee} | {doc.maxPatientsPerDay} patients/day</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <button onClick={() => handleEditDoctor(doc)} className="flex-1 sm:flex-none p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition flex justify-center"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => handleDeleteDoctor(doc._id)} className="flex-1 sm:flex-none p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition flex justify-center"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* MEDICAL REPORTS TAB */}
          {activeTab === 'reports' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Create Medical Report</h2>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <form onSubmit={handleCreateReport} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Patient</label>
                      <select required value={reportForm.patientId} onChange={(e) => handlePatientChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Select Patient --</option>
                        {users.filter(u => u.role !== 'admin').map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Doctor</label>
                      <select required value={reportForm.doctorId} onChange={(e) => setReportForm({...reportForm, doctorId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Select Doctor --</option>
                        {doctors.map(d => (
                          <option key={d._id} value={d._id}>Dr. {d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Diagnosis</label>
                    <input type="text" required value={reportForm.diagnosis} onChange={(e) => setReportForm({...reportForm, diagnosis: e.target.value})} placeholder="e.g. Viral Fever" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Symptoms</label>
                    <textarea value={reportForm.symptoms} onChange={(e) => setReportForm({...reportForm, symptoms: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" rows="2"></textarea>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4">Vitals</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <input type="text" placeholder="BP (e.g. 120/80)" value={reportForm.bloodPressure} onChange={(e) => setReportForm({...reportForm, bloodPressure: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg text-sm"/>
                      <input type="text" placeholder="Temp (°F)" value={reportForm.temperature} onChange={(e) => setReportForm({...reportForm, temperature: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg text-sm"/>
                      <input type="text" placeholder="Weight (kg)" value={reportForm.weight} onChange={(e) => setReportForm({...reportForm, weight: e.target.value})} className="px-4 py-2 border border-slate-200 rounded-lg text-sm"/>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800">Prescription</h3>
                      <button type="button" onClick={addMedicine} className="text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition">+ Add Med</button>
                    </div>
                    <div className="space-y-3">
                      {reportForm.prescription.map((med, index) => (
                        <div key={index} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <input type="text" placeholder="Medicine" value={med.medicineName} onChange={(e) => updateMedicine(index, 'medicineName', e.target.value)} className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" required />
                          <input type="text" placeholder="Dosage" value={med.dosage} onChange={(e) => updateMedicine(index, 'dosage', e.target.value)} className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input type="text" placeholder="Frequency" value={med.frequency} onChange={(e) => updateMedicine(index, 'frequency', e.target.value)} className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                          <input type="text" placeholder="Days" value={med.duration} onChange={(e) => updateMedicine(index, 'duration', e.target.value)} className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Doctor Notes</label>
                    <textarea value={reportForm.doctorNotes} onChange={(e) => setReportForm({...reportForm, doctorNotes: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none" rows="2"></textarea>
                  </div>

                  <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={reportForm.followUp} onChange={(e) => setReportForm({...reportForm, followUp: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                      Needs Follow-up
                    </label>
                    <input type="date" value={reportForm.nextAppointment} onChange={(e) => setReportForm({...reportForm, nextAppointment: e.target.value})} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-[15px] hover:bg-indigo-700 transition shadow-md mt-6">
                    Save Medical Report
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Financial Records</h2>
                <button onClick={fetchPayments} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
              
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Patient</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Paid Adv.</th>
                        <th className="px-6 py-4">Remaining</th>
                        <th className="px-6 py-4">Adv. Method</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Final Settled By</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => {
                        const isPending = p.finalStatus === 'pending' || p.finalStatus === 'partial';
                        const advDesc = describeAdvancePayment(p);
                        const finalDesc = describeFinalSettlement(p);
                        return (
                          <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{p.user?.name || 'Walk-in'}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Token: #{p.queue?.tokenNumber || '-'}</p>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700">Rs. {p.totalAmount}</td>
                            <td className="px-6 py-4 text-emerald-600 font-medium">Rs. {p.paidAmount}</td>
                            <td className="px-6 py-4 text-red-500 font-bold">Rs. {p.remainingAmount}</td>
                            <td className="px-6 py-4 text-slate-600 text-xs">{advDesc}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {isPending ? 'Pending' : 'Paid'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">{finalDesc || '—'}</td>
                            <td className="px-6 py-4 text-center">
                              {isPending ? (
                                <div className="flex gap-2 justify-center flex-wrap">
                                  <button onClick={() => openFinalPaymentGateway(p, 'cash')} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">Cash</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'card')} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">Card</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'easypaisa')} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">Easypaisa</button>
                                  <button onClick={() => openFinalPaymentGateway(p, 'jazzcash')} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition">JazzCash</button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs font-medium">Settled</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {payments.length === 0 && (
                        <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500">No payment records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* PATIENT HISTORY TAB */}
          {activeTab === 'patientHistory' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Patient Lookup</h2>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <select
                    value={historyUserId}
                    onChange={(e) => setHistoryUserId(e.target.value)}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">-- Choose Patient --</option>
                    {users.filter(u => u.role !== 'admin').map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadPatientHistory(historyUserId)}
                    disabled={!historyUserId || patientHistoryLoading}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-md whitespace-nowrap"
                  >
                    {patientHistoryLoading ? 'Loading...' : 'View History'}
                  </button>
                </div>

                {patientHistoryData?.patient && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-indigo-50 rounded-2xl p-6 flex flex-col sm:flex-row justify-between sm:items-center border border-indigo-100 gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-indigo-900">{patientHistoryData.patient.name}</h3>
                        <p className="text-indigo-600 text-sm mt-1">{patientHistoryData.patient.email} | {patientHistoryData.patient.phone || '—'}</p>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-xl border border-indigo-100">
                        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Visits</span>
                        <span className="block text-2xl font-black text-indigo-600 text-right">{(patientHistoryData.visits ?? []).length}</span>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mt-8 mb-4 flex items-center gap-2"><History className="w-4 h-4" /> Queue / visits</h4>
                    <div className="space-y-4">
                      {(patientHistoryData.visits ?? []).length === 0 ? (
                        <p className="text-slate-500 italic bg-slate-50 p-6 rounded-2xl text-center border border-slate-100">No visits found.</p>
                      ) : (
                        (patientHistoryData.visits ?? []).map((q) => {
                          const vs = visitStatusLabel(q.status);
                          return (
                            <div key={q._id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition">
                              <div className="flex flex-wrap justify-between items-start gap-4 mb-3 border-b border-slate-100 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-slate-800 text-lg">Dr. {q.serviceName}</h5>
                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${vs.cls}`}>{vs.text}</span>
                                  </div>
                                  <p className="text-slate-500 text-sm mt-1">{formatHistoryDay(q.appointmentDate)} (Token #{q.tokenNumber})</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Booked On</p>
                                  <p className="text-sm text-slate-700 font-medium">{formatHistoryDate(q.createdAt)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider mb-1">Reason / Notes</span>
                                  <span className="text-sm text-slate-700">{q.notes || '—'}</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider mb-1">Priority</span>
                                  <span className={`text-sm font-bold ${q.priority === 'emergency' ? 'text-red-600' : 'text-slate-700'}`}>{q.priority === 'emergency' ? 'Emergency 🚨' : 'Normal'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mt-8 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Medical reports</h4>
                    <div className="space-y-3">
                      {(patientHistoryData.reports ?? []).length === 0 ? (
                        <p className="text-slate-500 italic bg-slate-50 p-4 rounded-2xl text-center border border-slate-100 text-sm">No reports on file.</p>
                      ) : (
                        (patientHistoryData.reports ?? []).map((r) => (
                          <div key={r._id} className="bg-white border border-slate-200 rounded-2xl p-4 text-sm">
                            <div className="flex flex-wrap justify-between gap-2 mb-2">
                              <span className="font-semibold text-slate-800">{r.diagnosis}</span>
                              <span className="text-slate-500">{formatHistoryDate(r.createdAt)}</span>
                            </div>
                            <p className="text-slate-600">
                              {r.doctor?.name ? `Dr. ${r.doctor.name}` : 'Doctor'} · Token #{r.queue?.tokenNumber ?? '—'}
                            </p>
                            {r.symptoms ? <p className="text-slate-500 mt-2 text-xs">Symptoms: {r.symptoms}</p> : null}
                          </div>
                        ))
                      )}
                    </div>

                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-sm mt-8 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payments</h4>
                    <div className="space-y-3">
                      {(patientHistoryData.payments ?? []).length === 0 ? (
                        <p className="text-slate-500 italic bg-slate-50 p-4 rounded-2xl text-center border border-slate-100 text-sm">No payment records.</p>
                      ) : (
                        (patientHistoryData.payments ?? []).map((p) => (
                          <div key={p._id} className="bg-white border border-slate-200 rounded-2xl p-4 text-sm flex flex-wrap justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-800">Rs. {p.totalAmount ?? 0}</span>
                              <span className="text-slate-500 ml-2">Advance: {p.advanceAmount ?? 0} · Remaining: {p.remainingAmount ?? 0}</span>
                            </div>
                            <div className="text-slate-500">
                              {p.finalStatus || p.advanceStatus || '—'} · {formatHistoryDate(p.createdAt)}
                            </div>
                          </div>
                        ))
                      )}
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