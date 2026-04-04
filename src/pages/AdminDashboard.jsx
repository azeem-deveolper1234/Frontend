import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { callNextPatient, completeQueue, getAnalyticsToday, getAnalyticsOverall, getAllPayments } from '../services/api';

const AdminDashboard = () => {
  const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [todayStats, setTodayStats] = useState(null);
  const [overallStats, setOverallStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [serviceName, setServiceName] = useState('General Doctor');
  const [tokenNumber, setTokenNumber] = useState('');

  useEffect(() => {
    fetchTodayStats();
    fetchOverallStats();
  }, []);

  const fetchTodayStats = async () => {
    try {
      const res = await getAnalyticsToday();
      setTodayStats(res.data);
    } catch (err) {}
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
    } catch (err) {}
  };

  const handleCallNext = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await callNextPatient({ serviceName });
      setMessage(`✅ Token ${res.data.tokenNumber} called! Priority: ${res.data.priority}`);
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage('');
    setError('');
    if (tab === 'payments') fetchPayments();
  };

  return (
    <div className="min-h-screen bg-gray-50">

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
              { id: 'payments', label: '💰 Payments' },
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

        {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">⚠️ {error}</div>}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Today's Overview</h2>
              <button onClick={fetchTodayStats} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-200 transition">
                🔄 Refresh
              </button>
            </div>

            {/* Today Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Patients', value: todayStats?.totalPatients || 0, color: 'blue', icon: '👥' },
                { label: 'Completed', value: todayStats?.completedPatients || 0, color: 'green', icon: '✅' },
                { label: 'Waiting', value: todayStats?.waitingPatients || 0, color: 'yellow', icon: '⏳' },
                { label: 'Emergency', value: todayStats?.emergencyPatients || 0, color: 'red', icon: '🚨' },
              ].map((stat, i) => (
                <div key={i} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center`}>
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-4xl font-bold text-${stat.color}-600`}>{stat.value}</div>
                  <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Overall Stats */}
            <h3 className="text-xl font-bold text-gray-800 mb-4">Overall Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl p-6 text-white">
                <div className="text-4xl font-bold">{overallStats?.totalPatients || 0}</div>
                <div className="text-blue-100 mt-1">Total Patients Ever</div>
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

            {/* Service Name */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Call Next */}
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

            {/* Complete Queue */}
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
                        <h4 className="font-bold text-gray-800">{payment.user?.name}</h4>
                        <p className="text-gray-500 text-sm">{payment.user?.email}</p>
                        <p className="text-gray-500 text-sm mt-1">Doctor: {payment.doctor?.name}</p>
                        <p className="text-gray-500 text-xs mt-1">{new Date(payment.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">Rs. {payment.totalAmount}</p>
                        <p className="text-green-600 text-sm">Advance: Rs. {payment.advanceAmount}</p>
                        <p className="text-orange-500 text-sm">Remaining: Rs. {payment.remainingAmount}</p>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold mt-2 inline-block ${
                          payment.advanceStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          payment.advanceStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.advanceStatus}
                        </span>
                      </div>
                    </div>
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

export default AdminDashboard;