import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  callNextPatient, 
  completeQueue, 
  getAnalyticsToday, 
  getAnalyticsOverall, 
  getAllPayments, 
  createMedicalReport, 
  getAllUsers, 
  getAllDoctors,
  getPatientQueue,
  getQueuePayment,
  completeFinalPayment,
  addDoctor,
  updateDoctor,
  deleteDoctor,
  clearOldData,
  getPatientClinicHistory
} from '../services/api';

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
  if (s === 'completed') return { text: 'Completed', cls: 'bg-green-100 text-green-800' };
  if (s === 'cancelled') return { text: 'Cancelled', cls: 'bg-red-100 text-red-800' };
  if (s === 'serving') return { text: 'Serving', cls: 'bg-blue-100 text-blue-800' };
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
const [doctors, setDoctors] = useState([]); // 👈 yahan
const [doctorForm, setDoctorForm] = useState({

  name: '',
  specialization: '',
  email: '',
  phone: '',
  slotDuration: 15,
  maxPatientsPerDay: 20,
  consultationFee: 1000,
  schedule: [
    { day: 'Monday', startTime: '09:00', endTime: '5:00', isAvailable: true },
    { day: 'Tuesday', startTime: '09:00', endTime: '5:00', isAvailable: true },
    { day: 'Wednesday', startTime: '09:00', endTime: '5:00', isAvailable: true },
    { day: 'Thursday', startTime: '09:00', endTime: '5:00', isAvailable: true },
    { day: 'Friday', startTime: '09:00', endTime: '5:00', isAvailable: true },
  ]
});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [historyUserId, setHistoryUserId] = useState('');
  const [patientHistoryData, setPatientHistoryData] = useState(null);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  /** Remaining payment — Easypaisa / JazzCash / card: same mock flow as patient dashboard */
  const [showFinalPayGateway, setShowFinalPayGateway] = useState(false);
  const [finalPayStep, setFinalPayStep] = useState('phone');
  const [finalPayPhone, setFinalPayPhone] = useState('');
  const [finalPayOtp, setFinalPayOtp] = useState('');
  const [finalPayMeta, setFinalPayMeta] = useState({
    method: 'card',
    amount: 0,
    patientName: ''
  });
  const finalPayContextRef = useRef(null);
  const finalPayTimersRef = useRef([]);

  const clearFinalPayTimers = () => {
    finalPayTimersRef.current.forEach((id) => clearTimeout(id));
    finalPayTimersRef.current = [];
  };

  const [serviceName, setServiceName] = useState('General Doctor');
  const [tokenNumber, setTokenNumber] = useState('');
  const [reportForm, setReportForm] = useState({
    patientId: '',
    doctorId: '',
    queueId: '',
    diagnosis: '',
    symptoms: '',
    bloodPressure: '',
    temperature: '',
    weight: '',
    doctorNotes: '',
    nextAppointment: '',
    followUp: false,
    prescription: [{ medicineName: '', dosage: '', frequency: '', duration: '' }]
  });

useEffect(() => {
  fetchTodayStats();
  fetchOverallStats();
  fetchDoctors(); // 👈 add karo
}, []);

  useEffect(() => {
    return () => clearFinalPayTimers();
  }, []);

 const fetchTodayStats = async () => {
  try {
    const res = await api.get('/analytics/today');
    console.log("Backend Data Check:", res.data); // Console mein check karein data aa raha hai ya nahi
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
    console.log("PAYMENTS DATA:", res.data); // 👈 ADD THIS
    setPayments(res.data.payments);
  } catch (err) {
    console.log(err);
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
  } catch (err) {}
};

  const handleCallNext = async () => {
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
    if (!tokenNumber) return setError('Token number daalo!');
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

const handleFinalPayment = async (tokenNum) => {
  try {
    // Pehle queue dhundo
    const queueRes = await getPatientQueue(tokenNum);
    if (!queueRes.data) return setError('Queue nahi mili!');
    
    // Payment dhundo
    const paymentRes = await getQueuePayment(queueRes.data._id);
    if (!paymentRes.data) return setError('Payment record nahi mila!');
    
    await completeFinalPayment(paymentRes.data._id, { method: 'cash' });
    setMessage(`✅ Final payment complete! Token: ${tokenNum}`);
    fetchPayments();
  } catch (err) {
    setError(err.response?.data?.message || 'Failed');
  }
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
    if (
      !window.confirm(
        'Poorana queue data delete karein? (Pehle se zyada purani createdAt ya appointmentDate wali rows — waiting/serving bhi agar purani appointment ho.)'
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await clearOldData({ days: 14 });
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
    finalPayContextRef.current = {
      paymentId: payment._id,
      method
    };
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
        setError(
          finalPayMeta.method === 'card'
            ? 'Card number enter karein.'
            : 'Mobile number enter karein.'
        );
        return;
      }
      setError('');
      setFinalPayStep('otp');
      return;
    }

    if (finalPayStep === 'otp') {
      if (finalPayOtp.length < 4) {
        setError('4-digit OTP zaroori hai.');
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
            setMessage(
              `✅ Remaining Rs. ${finalPayMeta.amount} — ${ctx.method} — ${finalPayMeta.patientName}`
            );
            fetchPayments();
          } catch (err) {
            setError(err.response?.data?.message || 'Payment failed');
          } finally {
            finalPayContextRef.current = null;
            clearFinalPayTimers();
            setShowFinalPayGateway(false);
            setFinalPayStep('phone');
            setFinalPayPhone('');
            setFinalPayOtp('');
          }
        }, 1200);
        finalPayTimersRef.current.push(t2);
      }, 1800);
      finalPayTimersRef.current.push(t1);
    }
  };

  const fpMethod = finalPayMeta.method;

  return (
    <div className="min-h-screen bg-gray-50">

      {showFinalPayGateway && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div
            className={`bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-t-4 ${
              fpMethod === 'easypaisa'
                ? 'border-emerald-500'
                : fpMethod === 'jazzcash'
                  ? 'border-red-600'
                  : 'border-blue-600'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pay-title"
          >
            <div
              className={`px-6 py-5 text-center text-white ${
                fpMethod === 'easypaisa'
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                  : fpMethod === 'jazzcash'
                    ? 'bg-gradient-to-br from-red-600 to-red-800'
                    : 'bg-gradient-to-br from-blue-600 to-indigo-800'
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 mb-1">
                Admin virtual terminal
              </p>
              <h2 id="admin-pay-title" className="text-2xl font-extrabold tracking-tight">
                {fpMethod === 'easypaisa'
                  ? 'Easypaisa'
                  : fpMethod === 'jazzcash'
                    ? 'JazzCash'
                    : 'Debit / credit card'}
              </h2>
              <p className="text-sm text-white/85 mt-1">
                Remaining balance — {finalPayMeta.patientName}
              </p>
              <p className="text-xs text-white/70 mt-2">
                Demo checkout (same flow as patient app)
              </p>
            </div>

            <div className="p-6">
              {finalPayStep === 'phone' && (
                <div className="space-y-4">
                  <p className="text-center text-slate-600 text-sm">
                    Amount to collect
                    <span className="block text-2xl font-bold text-slate-900 mt-1">
                      Rs. {finalPayMeta.amount}
                    </span>
                  </p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {fpMethod === 'card' ? 'Card number' : 'Wallet mobile number'}
                    </label>
                    <input
                      type={fpMethod === 'card' ? 'text' : 'tel'}
                      className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-lg font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                      placeholder={fpMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                      value={finalPayPhone}
                      onChange={(e) => setFinalPayPhone(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="text-red-600 text-xs font-semibold text-center">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleFinalPayGatewayNext}
                    className={`w-full py-3 rounded-xl text-white font-bold shadow-md transition hover:opacity-95 active:scale-[0.99] ${
                      fpMethod === 'easypaisa'
                        ? 'bg-emerald-600'
                        : fpMethod === 'jazzcash'
                          ? 'bg-red-600'
                          : 'bg-blue-600'
                    }`}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={closeFinalPaymentGateway}
                    className="w-full text-center text-slate-400 text-sm py-2 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {finalPayStep === 'otp' && (
                <div className="space-y-4 text-center">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-sm text-2xl">
                    💬
                  </div>
                  <p className="text-slate-600 text-sm">
                    4-digit code sent to
                    <br />
                    <strong className="text-slate-900">{finalPayPhone}</strong>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-36 mx-auto block bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-2xl font-bold tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                    placeholder="••••"
                    value={finalPayOtp}
                    onChange={(e) => setFinalPayOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-600 text-xs font-semibold">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleFinalPayGatewayNext}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-md hover:bg-black transition"
                  >
                    Verify & collect
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setFinalPayStep('phone');
                    }}
                    className="w-full text-slate-400 text-sm py-2 hover:text-slate-600"
                  >
                    Back
                  </button>
                </div>
              )}

              {finalPayStep === 'processing' && (
                <div className="py-10 text-center">
                  <div className="inline-block relative w-20 h-20 mb-4">
                    <div
                      className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                        fpMethod === 'easypaisa'
                          ? 'border-emerald-500'
                          : fpMethod === 'jazzcash'
                            ? 'border-red-500'
                            : 'border-blue-500'
                      }`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🔒</div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Processing…</h3>
                  <p className="text-slate-400 text-sm mt-1">Do not close this window</p>
                </div>
              )}

              {finalPayStep === 'success' && (
                <div className="py-10 text-center">
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg ${
                      fpMethod === 'easypaisa'
                        ? 'bg-emerald-100 text-emerald-600'
                        : fpMethod === 'jazzcash'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    ✓
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-800">Successful</h3>
                  <p className="text-slate-500 text-sm mt-1">Recording payment…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-gradient-to-r from-blue-900 to-blue-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🏥</span>
            <div>
              <h1 className="text-white font-bold text-xl">City Medical Clinic</h1>
              <p className="text-blue-300 text-xs">Admin Panel — Queue Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="bg-blue-800 text-blue-200 px-3 py-1 rounded-full text-xs font-semibold">👑 Admin</span>
            <span className="text-blue-200 text-sm">👤 {user?.name}</span>
            <button onClick={logoutUser} className="bg-white text-blue-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition">
              Logout
            </button>
          </div>
        </div>
      </nav>


      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {[
             { id: 'dashboard', label: '📊 Dashboard' },
{ id: 'queue', label: '👥 Queue Manager' },
{ id: 'doctors', label: '👨‍⚕️ Doctors' },
{ id: 'reports', label: '🏥 Medical Reports' },
{ id: 'payments', label: '💰 Payments' },
              { id: 'patientHistory', label: '📜 Patient history' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 whitespace-pre-line text-sm leading-relaxed">
            {message}
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">⚠️ {error}</div>}

        {/* DASHBOARD TAB */}
  {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Today's Overview</h2>
              <div className="flex space-x-3">
                <button 
                  onClick={handleClearOldData}
                  disabled={loading}
                  className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition"
                >
                  🗑️ Clear Old Data (14 Days)
                </button>
                <button onClick={fetchTodayStats} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-200 transition">
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { id: 'all', label: 'Total Patients', value: todayStats?.totalPatients || 0, color: 'blue', icon: '👥' },
                { id: 'completed', label: 'Completed', value: todayStats?.completedPatients || 0, color: 'green', icon: '✅' },
                { id: 'waiting', label: 'Waiting', value: todayStats?.waitingPatients || 0, color: 'yellow', icon: '⏳' },
                { id: 'emergency', label: 'Emergency', value: todayStats?.emergencyPatients || 0, color: 'red', icon: '🚨' },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  onClick={() => { setSelectedType(stat.id); setShowDetails(true); }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center cursor-pointer hover:bg-gray-50 transition active:scale-95"
                >
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-4xl font-bold text-${stat.color}-600`}>{stat.value}</div>
                  <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* DETAILS TABLE: Card par click karne se ye dikhega */}
            {showDetails && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="font-bold text-gray-700 uppercase">📋 {selectedType} Patients List</h3>
                  <button onClick={() => setShowDetails(false)} className="text-red-500 text-sm font-bold hover:bg-red-50 px-2 py-1 rounded">Close ✖</button>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-gray-50 shadow-sm">
                      <tr className="text-gray-600 text-sm border-b">
                        <th className="p-3">Token</th>
                        <th className="p-3">Patient Name</th>
                        <th className="p-3">Doctor/Service</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
  {(() => {
    // Data source select karein
    const dataSource = selectedType === 'Overall' 
      ? overallStats?.allQueueHistory 
      : todayStats?.allQueueToday;

    // Console mein check karne ke liye (Debug)
    console.log("Current Data Source:", dataSource);

    if (!dataSource || dataSource.length === 0) return null;

    return dataSource
      .filter(q => {
        if (selectedType === 'all' || selectedType === 'Overall') return true;
        if (selectedType === 'emergency') return q.priority === 'emergency';
        return q.status === selectedType;
      })
      .map((item, idx) => (
        <tr key={idx} className="hover:bg-blue-50 transition border-b">
          <td className="p-3 font-bold text-blue-600">#{item.tokenNumber}</td>
          <td className="p-3 text-gray-800 font-medium">
            {item.user?.name || 'Walk-in Patient'}
          </td>
          <td className="p-3 text-gray-600 text-sm">{item.serviceName}</td>
          <td className="p-3">
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
              item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {item.status?.toUpperCase() || 'WAITING'}
            </span>
          </td>
        </tr>
      ));
  })()}
</tbody>
                  </table>
                  {/* Jab koi data na ho */}
                  {(!(selectedType === 'Overall' ? overallStats?.allQueueHistory : todayStats?.allQueueToday)?.length) && (
                    <div className="text-center py-10 text-gray-400 italic">No bookings found in this category.</div>
                  )}
                </div>
              </div>
            )}

            <h3 className="text-xl font-bold text-gray-800 mb-4">Overall Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <div 
                onClick={() => { setSelectedType('Overall'); setShowDetails(true); }}
                className="bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl p-6 text-white cursor-pointer hover:shadow-lg transition active:scale-95"
              >
                <div className="text-4xl font-bold">{overallStats?.totalPatients || 0}</div>
                <div className="text-blue-100 mt-1">Total Patients Ever (Click to view)</div>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-green-400 rounded-2xl p-6 text-white">
                <div className="text-4xl font-bold">{overallStats?.completionRate || '0%'}</div>
                <div className="text-green-100 mt-1">Completion Rate</div>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl p-6 text-white">
                <div className="text-4xl font-bold">{overallStats?.mostBusyService || 'N/A'}</div>
                <div className="text-purple-100 mt-1">Most Busy Service</div>
              </div>
            </div>
          </div>
        
)}
{/* QUEUE MANAGER TAB */}
{activeTab === 'queue' && (
  <div className="max-w-2xl mx-auto space-y-6">
    <h2 className="text-2xl font-bold text-gray-800">Queue Manager</h2>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Select Doctor</label>
      <select
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      >
        <option value="">-- Select Doctor --</option>
        {doctors.map(doc => (
          <option key={doc._id} value={doc.name}>{doc.name} — {doc.specialization}</option>
        ))}
      </select>
    </div>

    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-bold text-gray-800 text-lg mb-2">Call Next Patient</h3>
      <p className="text-gray-500 text-sm mb-4">Emergency patients will be called first automatically</p>
      <button
        onClick={handleCallNext}
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-700 to-blue-500 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-800 hover:to-blue-600 transition disabled:opacity-50"
      >
        {loading ? '⏳ Calling...' : '📢 Call Next Patient'}
      </button>
    </div>

    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-bold text-gray-800 text-lg mb-2">Complete Patient</h3>
      <p className="text-gray-500 text-sm mb-4">Mark patient as served</p>
      <div className="flex space-x-3">
        <input
          type="number"
          value={tokenNumber}
          onChange={(e) => setTokenNumber(e.target.value)}
          placeholder="Token Number"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition"
        />
        <button
          onClick={handleComplete}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
        >
          ✅ Complete
        </button>
      </div>
    </div>

  </div>
)}
        {/* MEDICAL REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Medical Report</h2>

            <form onSubmit={handleCreateReport} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">

              {/* Patient Select */}
              <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
  <select
    value={reportForm.patientId}
    onChange={(e) => handlePatientChange(e.target.value)}
    required
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
  >
    <option value="">-- Select Patient --</option>
    {users.map(u => (
      <option key={u._id} value={u._id}>{u.name} — {u.email}</option>
    ))}
  </select>
</div>

              {/* Doctor ID */}
             {/* Doctor Select */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
  <select
    value={reportForm.doctorId}
    onChange={(e) => setReportForm({ ...reportForm, doctorId: e.target.value })}
    required
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
  >
    <option value="">-- Select Doctor --</option>
    {doctors.map(doc => (
      <option key={doc._id} value={doc._id}>{doc.name} — {doc.specialization}</option>
    ))}
  </select>
</div>

              {/* Queue ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Queue ID</label>
                <input
                  type="text"
                  value={reportForm.queueId}
                  onChange={(e) => setReportForm({ ...reportForm, queueId: e.target.value })}
                  placeholder="Queue ID"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={reportForm.diagnosis}
                  onChange={(e) => setReportForm({ ...reportForm, diagnosis: e.target.value })}
                  placeholder="Common Cold"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
                <textarea
                  value={reportForm.symptoms}
                  onChange={(e) => setReportForm({ ...reportForm, symptoms: e.target.value })}
                  placeholder="Fever, Cough, Sore throat"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Vitals */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={reportForm.bloodPressure}
                    onChange={(e) => setReportForm({ ...reportForm, bloodPressure: e.target.value })}
                    placeholder="120/80"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                  <input
                    type="text"
                    value={reportForm.temperature}
                    onChange={(e) => setReportForm({ ...reportForm, temperature: e.target.value })}
                    placeholder="99°F"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                  <input
                    type="text"
                    value={reportForm.weight}
                    onChange={(e) => setReportForm({ ...reportForm, weight: e.target.value })}
                    placeholder="70kg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
                  />
                </div>
              </div>

              {/* Prescription */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Prescription</label>
                  <button type="button" onClick={addMedicine} className="text-blue-600 text-sm font-semibold hover:underline">
                    + Add Medicine
                  </button>
                </div>
                {reportForm.prescription.map((med, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={med.medicineName}
                      onChange={(e) => updateMedicine(index, 'medicineName', e.target.value)}
                      placeholder="Medicine Name"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={med.dosage}
                      onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                      placeholder="Dosage (1 tablet)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={med.frequency}
                      onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                      placeholder="Frequency (3x day)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={med.duration}
                      onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                      placeholder="Duration (5 days)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              {/* Doctor Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Notes</label>
                <textarea
                  value={reportForm.doctorNotes}
                  onChange={(e) => setReportForm({ ...reportForm, doctorNotes: e.target.value })}
                  placeholder="Rest for 3 days..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Next Appointment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Appointment</label>
                <input
                  type="date"
                  value={reportForm.nextAppointment}
                  onChange={(e) => setReportForm({ ...reportForm, nextAppointment: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Follow Up */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="followUp"
                  checked={reportForm.followUp}
                  onChange={(e) => setReportForm({ ...reportForm, followUp: e.target.checked })}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="followUp" className="text-sm font-medium text-gray-700">Follow Up Required</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-700 to-blue-500 text-white py-3 rounded-lg font-semibold text-lg hover:from-blue-800 hover:to-blue-600 transition disabled:opacity-50"
              >
                {loading ? '⏳ Creating...' : '📋 Create Report'}
              </button>
            </form>
          </div>
        )}


{/* DOCTORS TAB */}
{activeTab === 'doctors' && (
  <div className="max-w-2xl mx-auto">
    <h2 className="text-2xl font-bold text-gray-800 mb-6">Doctor Management</h2>

    {/* Add Doctor Form */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <h3 className="font-bold text-gray-800 text-lg mb-4">➕ Add New Doctor</h3>
      <div className="space-y-3">
        <input type="text" placeholder="Doctor Name" value={doctorForm.name}
          onChange={(e) => setDoctorForm({...doctorForm, name: e.target.value})}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="text" placeholder="Specialization" value={doctorForm.specialization}
          onChange={(e) => setDoctorForm({...doctorForm, specialization: e.target.value})}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="email" placeholder="Email" value={doctorForm.email}
          onChange={(e) => setDoctorForm({...doctorForm, email: e.target.value})}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="text" placeholder="Phone" value={doctorForm.phone}
          onChange={(e) => setDoctorForm({...doctorForm, phone: e.target.value})}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="grid grid-cols-3 gap-3">
          <input type="number" placeholder="Slot (min)" value={doctorForm.slotDuration}
            onChange={(e) => setDoctorForm({...doctorForm, slotDuration: e.target.value})}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" placeholder="Max Patients" value={doctorForm.maxPatientsPerDay}
            onChange={(e) => setDoctorForm({...doctorForm, maxPatientsPerDay: e.target.value})}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" placeholder="Fee (Rs.)" value={doctorForm.consultationFee}
            onChange={(e) => setDoctorForm({...doctorForm, consultationFee: e.target.value})}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button
          onClick={async () => {
            try {
              await addDoctor(doctorForm);
              setMessage('✅ Doctor added successfully!');
              fetchDoctors();
              setDoctorForm({name:'',specialization:'',email:'',phone:'',slotDuration:15,maxPatientsPerDay:20,consultationFee:1000,schedule:[
                {day:'Monday',startTime:'09:00',endTime:'5:00',isAvailable:true},
                {day:'Tuesday',startTime:'09:00',endTime:'5:00',isAvailable:true},
                {day:'Wednesday',startTime:'09:00',endTime:'5:00',isAvailable:true},
                {day:'Thursday',startTime:'09:00',endTime:'5:00',isAvailable:true},
                {day:'Friday',startTime:'09:00',endTime:'5:00',isAvailable:true},
              ]});
            } catch (err) {
              setError(err.response?.data?.message || 'Failed');
            }
          }}
          className="w-full bg-gradient-to-r from-blue-700 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-blue-800 hover:to-blue-600 transition"
        >
          ➕ Add Doctor
        </button>
      </div>
    </div>

    {/* Doctors List */}
    <h3 className="font-bold text-gray-800 text-lg mb-4">All Doctors</h3>
    <div className="space-y-4">
      {doctors.map((doc, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-gray-800">{doc.name}</h4>
              <p className="text-blue-600 text-sm">{doc.specialization}</p>
              <p className="text-gray-500 text-sm">📞 {doc.phone}</p>
              <p className="text-gray-500 text-sm">⏱️ {doc.slotDuration} min | 👥 Max {doc.maxPatientsPerDay}</p>
              <p className="text-green-600 text-sm font-semibold">💰 Rs. {doc.consultationFee}</p>
            </div>
            <button
              onClick={async () => {
                if (window.confirm('Delete karna chahte ho?')) {
                  try {
                    await deleteDoctor(doc._id);
                    setMessage('✅ Doctor removed!');
                    fetchDoctors();
                  } catch (err) {
                    setError('Failed to delete');
                  }
                }
              }}
              className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              🗑️ Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}


       {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">All Payments</h2>
            {payments.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="text-5xl mb-4">💰</div>
                <p className="text-gray-500">No payments yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{payment.user?.name}</h4>
                        <p className="text-gray-500 text-sm">{payment.user?.email}</p>
                        <p className="text-gray-500 text-sm">📞 {payment.user?.phone || 'N/A'}</p>
                        <p className="text-blue-600 text-sm font-semibold mt-1">👨‍⚕️ {payment.doctor?.name}</p>
                        <p className="text-gray-500 text-xs mt-1">📅 {new Date(payment.createdAt).toLocaleDateString()}</p>
                        <p className="text-gray-500 text-xs">💳 Advance: {describeAdvancePayment(payment)}</p>
                        {payment.finalStatus === 'paid' && (
                          <p className="text-gray-500 text-xs">✅ Remaining: {describeFinalSettlement(payment)}</p>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-bold text-gray-800 text-lg">Rs. {payment.totalAmount}</p>
                        <p className="text-green-600 text-sm">✅ Advance: Rs. {payment.advanceAmount}</p>
                        <p className="text-orange-500 text-sm">⏳ Remaining: Rs. {payment.remainingAmount}</p>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-block ${
                          payment.finalStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          payment.advanceStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.finalStatus === 'paid' ? '✅ Fully Paid' :
                           payment.advanceStatus === 'cancelled' ? '❌ Cancelled' : '⏳ Advance Paid'}
                        </span>
                        {payment.finalStatus !== 'paid' && payment.advanceStatus !== 'cancelled' && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-gray-500 font-medium">Collect remaining (Rs. {payment.remainingAmount})</p>
                            <div className="flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await completeFinalPayment(payment._id, { method: 'cash' });
                                    setMessage(`✅ Remaining — cash — ${payment.user?.name}`);
                                    fetchPayments();
                                  } catch (err) {
                                    setError(err.response?.data?.message || 'Payment failed');
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                              >
                                💵 Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => openFinalPaymentGateway(payment, 'easypaisa')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                              >
                                Easypaisa
                              </button>
                              <button
                                type="button"
                                onClick={() => openFinalPaymentGateway(payment, 'jazzcash')}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                              >
                                JazzCash
                              </button>
                              <button
                                type="button"
                                onClick={() => openFinalPaymentGateway(payment, 'card')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                              >
                                💳 Debit / credit
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'patientHistory' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Patient visit history</h2>
              <p className="text-gray-500 text-sm mt-1 max-w-2xl">
                Pehli dafa ya doosri dafa aane par doctor / admin yahan se dekh sakta hai: kab appointment
                thi, kis doctor/clinic service par token aya, status kya raha, aur agar checkup report bani
                ho to diagnosis / vitals — taake agli visit par purana record samajh aa sake.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Patient select karein
              </label>
              <select
                value={historyUserId}
                onChange={(e) => {
                  const id = e.target.value;
                  setHistoryUserId(id);
                  loadPatientHistory(id);
                }}
                className="w-full max-w-xl px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              >
                <option value="">-- Patient choose karein --</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — {u.email}
                    {u.phone ? ` — ${u.phone}` : ''}
                  </option>
                ))}
              </select>
              {patientHistoryLoading && (
                <p className="text-blue-600 text-sm mt-3 font-medium">⏳ Loading history…</p>
              )}
            </div>

            {patientHistoryData && !patientHistoryLoading && (
              <>
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white shadow-lg">
                  <p className="text-xs uppercase tracking-widest text-white/60">Selected patient</p>
                  <h3 className="text-2xl font-bold mt-1">{patientHistoryData.patient?.name}</h3>
                  <p className="text-white/85 text-sm mt-1">{patientHistoryData.patient?.email}</p>
                  <p className="text-white/70 text-sm">
                    Phone: {patientHistoryData.patient?.phone || 'N/A'}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-4 text-sm">
                    <span className="bg-white/10 rounded-lg px-3 py-1">
                      Visits (queue): <strong>{patientHistoryData.totalVisits}</strong>
                    </span>
                    <span className="bg-white/10 rounded-lg px-3 py-1">
                      Checkup reports: <strong>{patientHistoryData.totalReports}</strong>
                    </span>
                    <span className="bg-white/10 rounded-lg px-3 py-1">
                      Payments: <strong>{patientHistoryData.totalPayments}</strong>
                    </span>
                  </div>
                </div>

                <section>
                  <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">📅</span> Appointments (queue)
                  </h4>
                  {patientHistoryData.visits?.length === 0 ? (
                    <p className="text-gray-500 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                      Abhi koi queue / appointment record nahi.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 text-left">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Appointment date</th>
                            <th className="px-4 py-3 font-semibold">Doctor / service</th>
                            <th className="px-4 py-3 font-semibold">Token</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Booked</th>
                            <th className="px-4 py-3 font-semibold">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {patientHistoryData.visits.map((v) => {
                            const st = visitStatusLabel(v.status);
                            return (
                              <tr key={v._id} className="hover:bg-gray-50/80">
                                <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                                  {formatHistoryDay(v.appointmentDate)}
                                </td>
                                <td className="px-4 py-3 font-medium text-blue-800">{v.serviceName}</td>
                                <td className="px-4 py-3 font-mono">#{v.tokenNumber}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${st.cls}`}>
                                    {st.text}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                  {formatHistoryDate(v.createdAt)}
                                </td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={v.notes || ''}>
                                  {v.notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">🏥</span> Checkups (medical reports)
                  </h4>
                  {patientHistoryData.reports?.length === 0 ? (
                    <p className="text-gray-500 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                      Koi medical report abhi file nahi — jab admin report banaye ga yahan dikhe ga.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {patientHistoryData.reports.map((r) => (
                        <div
                          key={r._id}
                          className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:border-blue-200 transition"
                        >
                          <div className="flex flex-wrap justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wide">Checkup date</p>
                              <p className="font-semibold text-gray-900">{formatHistoryDate(r.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400 uppercase tracking-wide">Doctor</p>
                              <p className="font-semibold text-blue-800">
                                {r.doctor?.name || '—'}{' '}
                                <span className="text-gray-500 font-normal text-sm">
                                  {r.doctor?.specialization ? `(${r.doctor.specialization})` : ''}
                                </span>
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-gray-800">Diagnosis: </span>
                            {r.diagnosis}
                          </p>
                          {r.symptoms ? (
                            <p className="text-sm text-gray-600 mt-2">
                              <span className="font-medium">Symptoms: </span>
                              {r.symptoms}
                            </p>
                          ) : null}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-gray-600">
                            {r.bloodPressure ? <span>BP: {r.bloodPressure}</span> : null}
                            {r.temperature ? <span>Temp: {r.temperature}</span> : null}
                            {r.weight ? <span>Weight: {r.weight}</span> : null}
                            {r.queue?.tokenNumber != null ? (
                              <span>
                                Token: #{r.queue.tokenNumber} — {r.queue?.serviceName || ''}
                              </span>
                            ) : null}
                          </div>
                          {r.doctorNotes ? (
                            <p className="text-xs text-gray-500 mt-3 border-t border-dashed pt-2">
                              <span className="font-medium text-gray-600">Doctor notes: </span>
                              {r.doctorNotes}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-xl">💳</span> Payments (advance / remaining)
                  </h4>
                  {patientHistoryData.payments?.length === 0 ? (
                    <p className="text-gray-500 text-sm bg-gray-50 rounded-xl p-4 border border-gray-100">
                      Koi payment record nahi.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 text-left">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Date</th>
                            <th className="px-4 py-3 font-semibold">Doctor</th>
                            <th className="px-4 py-3 font-semibold">Total</th>
                            <th className="px-4 py-3 font-semibold">Advance</th>
                            <th className="px-4 py-3 font-semibold">Remaining</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {patientHistoryData.payments.map((p) => (
                            <tr key={p._id} className="hover:bg-gray-50/80">
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                {formatHistoryDate(p.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-blue-800 font-medium">
                                {p.doctor?.name || '—'}
                              </td>
                              <td className="px-4 py-3">Rs. {p.totalAmount}</td>
                              <td className="px-4 py-3 text-green-700">Rs. {p.advanceAmount}</td>
                              <td className="px-4 py-3 text-orange-600">Rs. {p.remainingAmount}</td>
                              <td className="px-4 py-3 text-xs">
                                <div>{describeAdvancePayment(p)}</div>
                                {p.finalStatus === 'paid' ? (
                                  <div className="text-green-700 mt-0.5">
                                    Final: {describeFinalSettlement(p)}
                                  </div>
                                ) : (
                                  <div className="text-amber-700 mt-0.5">Final pending</div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;