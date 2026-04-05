import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { callNextPatient, completeQueue, getAnalyticsToday, getAnalyticsOverall, getAllPayments, createMedicalReport, getAllUsers, getAllDoctors,getPatientQueue } from '../services/api';const AdminDashboard = () => {
  
    const { user, logoutUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [todayStats, setTodayStats] = useState(null);
  const [overallStats, setOverallStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage('');
    setError('');
    if (tab === 'payments') fetchPayments();
if (tab === 'reports') {
  fetchUsers();
  fetchDoctors();
}  };

 

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
              { id: 'reports', label: '🏥 Medical Reports' },
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Patients', value: todayStats?.totalPatients || 0, color: 'blue', icon: '👥' },
                { label: 'Completed', value: todayStats?.completedPatients || 0, color: 'green', icon: '✅' },
                { label: 'Waiting', value: todayStats?.waitingPatients || 0, color: 'yellow', icon: '⏳' },
                { label: 'Emergency', value: todayStats?.emergencyPatients || 0, color: 'red', icon: '🚨' },
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-4xl font-bold text-${stat.color}-600`}>{stat.value}</div>
                  <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
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