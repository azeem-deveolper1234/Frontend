import React, { useState, useEffect, useRef } from 'react';
import AppointmentReceipt from '../components/AppointmentReceipt';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import { getAllDoctors, joinQueue, getQueueStatus, cancelQueue, getQueueHistory, getMyReports ,createPayment, getPaymentHistory} from '../services/api';

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
  serviceName: '',
  priority: 'normal',
  appointmentDate: '',
  notes: '',
  totalAmount: '',
  paymentMethod: 'cash'
});

const [showGateway, setShowGateway] = useState(false);
const [gatewayStep, setGatewayStep] = useState('phone'); // phone, otp, processing, success
const [gatewayPhone, setGatewayPhone] = useState('');
const [gatewayOtp, setGatewayOtp] = useState('');
const pendingBookingRef = useRef(null);
const gatewayTimersRef = useRef([]);
const clearGatewayTimers = () => {
  gatewayTimersRef.current.forEach((id) => clearTimeout(id));
  gatewayTimersRef.current = [];
};

const [payments, setPayments] = useState([]);
const [paymentForm, setPaymentForm] = useState({
  queueId: '',
  doctorId: '',
  totalAmount: '',
  paymentMethod: 'cash'
});
useEffect(() => {
  fetchDoctors();
  fetchQueueStatus();

  // Har 30 second mein automatically refresh
  const interval = setInterval(() => {
    fetchQueueStatus();
  }, 30000);

  // Socket.io — real-time updates
  socket.on('queueUpdated', (data) => {
    fetchQueueStatus();
    setMessage(`🔔 Token ${data.tokenNumber} called! Please be ready!`);
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('City Medical Clinic', {
        body: `Token ${data.tokenNumber} called! Please be ready!`,
        icon: '🏥'
      });
    }
  });

  socket.on('queueCompleted', (data) => {
    fetchQueueStatus();
    setMessage(`✅ Aapka checkup complete ho gaya! Token: ${data.tokenNumber} — Shukriya!`);
  });

  socket.on('queueCancelled', () => {
    fetchQueueStatus();
  });

  // Browser notification permission
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
    setQueueStatus(null);
    // Agar "Not in queue" aaye toh check karo history mein
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
    const fee =
      Number(form.totalAmount) ||
      (doctorObj && Number(doctorObj.consultationFee)) ||
      1000;

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
        try {
          await cancelQueue();
        } catch (_) {
          /* queue cancel optional */
        }
        throw payErr;
      }
    }

    const bookedAt = new Date();
    setReceiptData({
      tokenNumber: queueRes.data.tokenNumber,
      patientName: user.name,
      email: user.email,
      phone: user.phone || '',
      doctorName: form.serviceName,
      appointmentDate: form.appointmentDate,
      bookingTime: bookedAt.toLocaleString('en-PK', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }),
      priority: form.priority,
      notes: form.notes,
      totalAmount: doctorObj ? Number(doctorObj.consultationFee) || fee : fee
    });

    setShowReceipt(true);
    fetchQueueStatus();
    setActiveTab('home');
    setJoinForm({
      serviceName: '',
      priority: 'normal',
      appointmentDate: '',
      notes: '',
      totalAmount: '',
      paymentMethod: 'cash'
    });
  } catch (err) {
    const apiMsg = err.response?.data?.message;
    setError(
      typeof apiMsg === 'string'
        ? apiMsg
        : apiMsg?.message || err.message || 'Booking failed'
    );
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
    setError(
      'Aap pehle se active queue mein hain. Naya appointment ke liye Home se queue cancel karein ya apna turn complete hone dein.'
    );
    return;
  } catch (err) {
    if (err.response?.status !== 404) {
      setError(err.response?.data?.message || 'Status check failed');
      return;
    }
  }

  const snapshot = { ...joinForm };
  pendingBookingRef.current = snapshot;

  if (
    joinForm.paymentMethod === 'easypaisa' ||
    joinForm.paymentMethod === 'jazzcash' ||
    joinForm.paymentMethod === 'card'
  ) {
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
    if (!gatewayPhone) return setError('Pehle number tou dalein!');
    setError('');
    setGatewayStep('otp');
  } else if (gatewayStep === 'otp') {
    if (gatewayOtp.length < 4) return setError('4-digit OTP laazmi hai');
    setError('');
    const locked =
      pendingBookingRef.current && pendingBookingRef.current.serviceName
        ? { ...pendingBookingRef.current }
        : { ...joinForm };
    if (!locked.serviceName || !locked.appointmentDate) {
      setError('Doctor aur appointment date zaroori hain — form dubara check karein.');
      return;
    }
    setGatewayStep('processing');
    clearGatewayTimers();

    const t1 = setTimeout(() => {
      setGatewayStep('success');
      const t2 = setTimeout(() => {
        processJoinQueue(locked);
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

  return (

    <div className="min-h-screen bg-gray-50">

{showReceipt && receiptData && (
  <AppointmentReceipt
    key={`${receiptData.tokenNumber}-${receiptData.bookingTime}`}
    data={receiptData}
    onClose={() => setShowReceipt(false)}
  />
)}

{/* --- MOCK PAYMENT GATEWAY MODAL --- */}
{showGateway && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
    <div className={`bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden ${(joinForm.paymentMethod === 'easypaisa' ? 'border-t-4 border-green-500' : (joinForm.paymentMethod === 'jazzcash' ? 'border-t-4 border-red-500' : 'border-t-4 border-blue-500'))}`}>
        
      {/* Header */}
      <div className={`p-6 text-center text-white ${(joinForm.paymentMethod === 'easypaisa' ? 'bg-gradient-to-br from-green-500 to-green-600' : (joinForm.paymentMethod === 'jazzcash' ? 'bg-gradient-to-br from-red-600 to-red-700' : 'bg-gradient-to-br from-blue-600 to-blue-800'))}`}>
        <h2 className="text-2xl font-extrabold tracking-tight">
          {joinForm.paymentMethod === 'easypaisa' ? 'Easypaisa' : (joinForm.paymentMethod === 'jazzcash' ? 'JazzCash' : 'Secure Card')}
        </h2>
        <p className="text-white/80 text-sm mt-1">Virtual Checkout</p>
      </div>

      {/* Body */}
      <div className="p-6">
        
        {/* Step: Phone / Card Input */}
        {gatewayStep === 'phone' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <p className="text-center text-gray-600 font-medium text-sm">Amount to Pay: <span className="text-xl font-bold text-gray-800 block mt-1">Rs. {(doctors.find(d => d.name === joinForm.serviceName)?.consultationFee || 1000) / 2}</span></p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {joinForm.paymentMethod === 'card' ? 'Card Number' : 'Mobile Number'}
              </label>
              <input 
                type={joinForm.paymentMethod === 'card' ? 'text' : 'tel'}
                className="w-full bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-lg font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all shadow-inner"
                placeholder={joinForm.paymentMethod === 'card' ? '4111 1111 1111 1111' : '03XX XXXXXXX'}
                value={gatewayPhone}
                onChange={(e) => setGatewayPhone(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-xs font-semibold text-center mt-2">{error}</p>}
            <button 
              onClick={handleGatewayNext}
              className={`w-full py-3 mt-2 rounded-xl text-white font-bold text-lg shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] ${(joinForm.paymentMethod === 'easypaisa' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : (joinForm.paymentMethod === 'jazzcash' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'))}`}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                clearGatewayTimers();
                pendingBookingRef.current = null;
                setShowGateway(false);
                setGatewayStep('phone');
              }}
              className="w-full text-center text-gray-400 text-sm mt-3 hover:text-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Step: OTP */}
        {gatewayStep === 'otp' && (
          <div className="space-y-4 text-center animate-in slide-in-from-right-4 duration-300">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-gray-600 text-sm">Enter 4-digit verification code sent to <br/><strong className="text-gray-800">{gatewayPhone}</strong></p>
            <input 
              type="text" 
              maxLength="4"
              className="w-32 mx-auto bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl text-2xl font-bold tracking-[0.5em] text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
              placeholder="1234"
              value={gatewayOtp}
              onChange={(e) => setGatewayOtp(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
            <button 
              onClick={handleGatewayNext}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-lg shadow-md transition-all hover:bg-black hover:scale-[1.02] active:scale-[0.98] mt-2"
            >
              Verify & Pay
            </button>
            <button onClick={() => setGatewayStep('phone')} className="w-full text-center text-gray-400 text-sm mt-3 hover:text-gray-600 transition">Back</button>
          </div>
        )}

        {/* Step: Processing */}
        {gatewayStep === 'processing' && (
          <div className="py-10 text-center animate-pulse">
            <div className="inline-block relative w-20 h-20 mb-4">
              <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${(joinForm.paymentMethod === 'easypaisa' ? 'border-green-500' : (joinForm.paymentMethod === 'jazzcash' ? 'border-red-500' : 'border-blue-500'))}`}></div>
              <div className="absolute inset-0 flex items-center justify-center text-3xl">🔒</div>
            </div>
            <h3 className="text-xl font-bold text-gray-800">Processing Payment...</h3>
            <p className="text-gray-400 text-sm mt-2">Please do not close this window</p>
          </div>
        )}

        {/* Step: Success */}
        {gatewayStep === 'success' && (
          <div className="py-10 text-center animate-in zoom-in-90 duration-500">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl shadow-xl ${(joinForm.paymentMethod === 'easypaisa' ? 'bg-green-100 text-green-600 shadow-green-500/20' : (joinForm.paymentMethod === 'jazzcash' ? 'bg-red-100 text-red-600 shadow-red-500/20' : 'bg-blue-100 text-blue-600 shadow-blue-500/20'))}`}>
              <span>✓</span>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-800">Successful!</h3>
            <p className="text-gray-500 text-sm mt-2">Payment securely captured.</p>
            <p className="text-xs text-gray-400 mt-6 animate-pulse">Redirecting to clinic receipt...</p>
          </div>
        )}

      </div>
    </div>
  </div>
)}
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🏥</span>
            <div>
              <h1 className="text-white font-bold text-xl">City Medical Clinic</h1>
              <p className="text-blue-200 text-xs">Virtual Queue System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-blue-200 text-sm">👤 {user?.name}</span>
            <button
              onClick={logoutUser}
              className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'home', label: '🏠 Home', },
              { id: 'book', label: '📋 Book Appointment' },
              { id: 'status', label: '⏳ Queue Status' },
              { id: 'history', label: '📅 History' },
              { id: 'reports', label: '🏥 Medical Reports' },
              
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
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

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Messages */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Welcome, {user?.name}! 👋</h2>

         {/* Quick Status */}
{queueStatus ? (
  <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl p-6 text-white mb-6">
    <h3 className="text-lg font-semibold mb-4">Your Current Queue Status</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold">{queueStatus.yourToken}</div>
        <div className="text-sm opacity-80">Your Token</div>
      </div>
      <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold">{queueStatus.currentServing}</div>
        <div className="text-sm opacity-80">Now Serving</div>
      </div>
      <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold">{queueStatus.peopleAhead}</div>
        <div className="text-sm opacity-80">People Ahead</div>
      </div>
      <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
        <div className="text-3xl font-bold">{queueStatus.estimatedTime}</div>
        <div className="text-sm opacity-80">Est. Minutes</div>
      </div>
    </div>
    <div className="mt-4 flex justify-between items-center">
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
        queueStatus.status === 'serving' ? 'bg-green-400' : 'bg-yellow-400 text-gray-800'
      }`}>
        {queueStatus.status === 'serving' ? '🟢 Your Turn!' : '⏳ Waiting'}
      </span>
      <button
        onClick={handleCancelQueue}
        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
      >
        Cancel Queue
      </button>
    </div>
  </div>
) : (
  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 text-center">
    <div className="text-4xl mb-2">✅</div>
    <p className="text-green-700 font-semibold text-lg">Aapka checkup complete ho gaya!</p>
    <p className="text-gray-500 text-sm mt-1">Medical Reports tab mein apni report dekh sakte hain</p>
    <button
      onClick={() => handleTabChange('book')}
      className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
    >
      Naya Appointment Book Karein →
    </button>
  </div>
)}
            {/* Doctors */}
            <h3 className="text-xl font-bold text-gray-800 mb-4">Available Doctors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doc => (
                <div key={doc._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 rounded-full p-3 text-2xl">👨‍⚕️</div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{doc.name}</h4>
                      <p className="text-blue-600 text-sm">{doc.specialization}</p>
                      <p className="text-gray-500 text-xs mt-1">⏱️ {doc.slotDuration} min per patient</p>
                      <p className="text-gray-500 text-xs">👥 Max {doc.maxPatientsPerDay} patients/day</p>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-semibold">Available</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOOK APPOINTMENT TAB */}
        {activeTab === 'book' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Book Appointment</h2>
              <p className="text-gray-500 text-sm mb-6">Fill in the details to join the queue</p>

              <form onSubmit={handleJoinQueue} className="space-y-4">
              <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
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
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
  >
    <option value="">-- Select Doctor --</option>
    {doctors.map(doc => (
      <option key={doc._id} value={doc.name}>{doc.name} — {doc.specialization}</option>
    ))}
  </select>
</div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date</label>
                  <input
                    type="date"
                    value={joinForm.appointmentDate}
                    onChange={(e) => setJoinForm({ ...joinForm, appointmentDate: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={joinForm.priority}
                    onChange={(e) => setJoinForm({ ...joinForm, priority: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="normal">Normal</option>
                    <option value="emergency">Emergency 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms / Notes</label>
                  <textarea
                    value={joinForm.notes}
                    onChange={(e) => setJoinForm({ ...joinForm, notes: e.target.value })}
                    placeholder="Describe your symptoms..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>


{/* Payment Section */}
<div className="border-t border-gray-200 pt-4 mt-4">
  <h3 className="font-semibold text-gray-800 mb-3">💳 Advance Payment (50%)</h3>
  
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (Rs.)</label>
    <input
      type="number"
      value={joinForm.totalAmount}
      onChange={(e) => setJoinForm({ ...joinForm, totalAmount: e.target.value })}
      placeholder="1000"
      required
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
    />
  </div>

  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
    <select
      value={joinForm.paymentMethod}
      onChange={(e) => setJoinForm({ ...joinForm, paymentMethod: e.target.value })}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
    >
      <option value="cash">Cash at Clinic</option>
      <option value="easypaisa">Easypaisa</option>
      <option value="jazzcash">JazzCash</option>
      <option value="card">Credit/Debit Card</option>
    </select>
  </div>

  {joinForm.totalAmount && (
    <div className="bg-blue-50 rounded-xl p-4 mb-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Total Fee:</span>
        <span className="font-semibold">Rs. {joinForm.totalAmount}</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span className="text-gray-600">Pay Now (50%):</span>
        <span className="font-semibold text-green-600">Rs. {joinForm.totalAmount / 2}</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span className="text-gray-600">Pay at Clinic (50%):</span>
        <span className="font-semibold text-orange-500">Rs. {joinForm.totalAmount / 2}</span>
      </div>
    </div>
  )}
</div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-700 to-blue-500 text-white py-3 rounded-lg font-semibold text-lg hover:from-blue-800 hover:to-blue-600 transition disabled:opacity-50"
                >
                  {loading ? '⏳ Booking...' : 'Book Appointment →'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* QUEUE STATUS TAB */}
        {activeTab === 'status' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Queue Status</h2>
                <button
                  onClick={fetchQueueStatus}
                  className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-200 transition"
                >
                  🔄 Refresh
                </button>
              </div>

              {queueStatus ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <div className="text-4xl font-bold text-blue-600">{queueStatus.yourToken}</div>
                      <div className="text-sm text-gray-600 mt-1">Your Token</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <div className="text-4xl font-bold text-green-600">{queueStatus.currentServing}</div>
                      <div className="text-sm text-gray-600 mt-1">Now Serving</div>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-4 text-center">
                      <div className="text-4xl font-bold text-yellow-600">{queueStatus.peopleAhead}</div>
                      <div className="text-sm text-gray-600 mt-1">People Ahead</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <div className="text-4xl font-bold text-purple-600">{queueStatus.estimatedTime}</div>
                      <div className="text-sm text-gray-600 mt-1">Est. Minutes</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        queueStatus.status === 'serving'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {queueStatus.status === 'serving' ? '🟢 Your Turn!' : '⏳ Waiting'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-600 text-sm">Priority:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        queueStatus.priority === 'emergency'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {queueStatus.priority === 'emergency' ? '🚨 Emergency' : '✅ Normal'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCancelQueue}
                    className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition"
                  >
                    Cancel Queue
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-gray-500">You are not in any queue</p>
                  <button
                    onClick={() => handleTabChange('book')}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Book Appointment →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Visit History</h2>
            {history.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-500">No visit history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-800">{item.serviceName}</h4>
                        <p className="text-gray-500 text-sm mt-1">Token: #{item.tokenNumber}</p>
                        <p className="text-gray-500 text-sm">{new Date(item.createdAt).toLocaleDateString()}</p>
                        {item.notes && <p className="text-gray-500 text-sm mt-1">Notes: {item.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold">
                          ✅ Completed
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          item.priority === 'emergency'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.priority === 'emergency' ? '🚨 Emergency' : '✅ Normal'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEDICAL REPORTS TAB */}
        {activeTab === 'reports' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Medical Reports</h2>
            {reports.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="text-5xl mb-4">🏥</div>
                <p className="text-gray-500">No medical reports yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-gray-800 text-lg">{report.diagnosis}</h4>
        <p className="text-blue-600 text-sm">{report.doctor?.name}</p><p className="text-gray-500 text-xs mt-1">{new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                      {report.followUp && (
                        <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-semibold">
                          Follow Up Required
                        </span>
                      )}
                    </div>

                    {report.symptoms && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700">Symptoms:</p>
                        <p className="text-sm text-gray-600">{report.symptoms}</p>
                      </div>
                    )}

                    {report.prescription?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Prescription:</p>
                        <div className="space-y-1">
                          {report.prescription.map((med, i) => (
                            <div key={i} className="bg-blue-50 rounded-lg px-3 py-2 text-sm">
                              💊 <strong>{med.medicineName}</strong> — {med.dosage} — {med.frequency} — {med.duration}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.doctorNotes && (
                      <div className="bg-yellow-50 rounded-lg px-3 py-2 text-sm mt-2">
                        📝 <strong>Doctor Notes:</strong> {report.doctorNotes}
                      </div>
                    )}

                    {report.nextAppointment && (
                      <div className="mt-3 text-sm text-gray-600">
                        📅 Next Appointment: {new Date(report.nextAppointment).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        
      </div>
    </div>
  );
};

export default PatientDashboard;