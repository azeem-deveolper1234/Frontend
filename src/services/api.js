import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Har request mein token automatically add ho
API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// AUTH
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);

// QUEUE
export const joinQueue = (data) => API.post('/queue/join', data);
export const getQueueStatus = () => API.get('/queue/status');
export const cancelQueue = () => API.post('/queue/cancel');
export const getQueueHistory = () => API.get('/queue/history');

// DOCTORS
export const getAllDoctors = () => API.get('/doctors/all');
export const getDoctorSchedule = (id) => API.get(`/doctors/${id}/schedule`);

// PAYMENTS
export const createPayment = (data) => API.post('/payments/create', data);
export const getPaymentHistory = () => API.get('/payments/history');

// MEDICAL REPORTS
export const getMyReports = () => API.get('/medical-reports/my-reports');

// ADMIN
export const callNextPatient = (data) => API.post('/queue/call-next', data);
export const completeQueue = (data) => API.post('/queue/complete', data);
export const getAnalyticsToday = () => API.get('/analytics/today');
export const getAnalyticsOverall = () => API.get('/analytics/overall');
export const getAllPayments = () => API.get('/payments/all');
// ADMIN
export const createMedicalReport = (data) => API.post('/medical-reports/create', data);
export const getPatientReports = (patientId) => API.get(`/medical-reports/patient/${patientId}`);
export const getAllUsers = () => API.get('/auth/users');
export const getPatientQueue = (userId) => API.get(`/queue/patient/${userId}`);
export default API;