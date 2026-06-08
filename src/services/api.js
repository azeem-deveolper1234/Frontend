import axios from 'axios';

/** Backend HTTP origin (no path), e.g. http://localhost:5000 — used by Socket.IO */
export function getBackendOrigin() {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (apiUrl) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  return 'http://localhost:5000';
}

const getBaseUrl = () => {
  const apiUrl = process.env.REACT_APP_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/$/, '');
  }
  return `${getBackendOrigin()}/api`;
};

const API = axios.create({
  baseURL: getBaseUrl()
});

// Har request mein token automatically add ho
API.interceptors.request.use((req) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// Expired / invalid token — logout UX (login/register excluded)
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const reqUrl = String(err.config?.url || '');
    const isAuthAttempt =
      reqUrl.includes('/auth/login') || reqUrl.includes('/auth/register');
    if (status === 401 && !isAuthAttempt && sessionStorage.getItem('token')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

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
export const callPatientByToken = (data) => API.post('/queue/call-token', data);
export const completeQueue = (data) => API.post('/queue/complete', data);
export const getAnalyticsToday = () => API.get('/analytics/today');
export const getAnalyticsOverall = () => API.get('/analytics/overall');
export const getAllPayments = () => API.get('/payments/all');
export const clearOldData = (data) => API.post('/queue/clear-old', data);
// ADMIN
export const createMedicalReport = (data) => API.post('/medical-reports/create', data);
export const getPatientReports = (patientId) => API.get(`/medical-reports/patient/${patientId}`);
export const getAllUsers = () => API.get('/auth/users');
export const getPatientQueue = (userId) => API.get(`/queue/patient/${userId}`);
/** Admin — patient ki appointments, checkup reports, payments */
export const getPatientClinicHistory = (userId) =>
  API.get(`/queue/patient/${userId}/clinic-history`);

export const completeFinalPayment = (paymentId, data) =>
  API.put(`/payments/${paymentId}/complete`, data);
export const getQueuePayment = (queueId) => API.get(`/payments/queue/${queueId}`);

export const addDoctor = (data) => API.post('/doctors/add', data);
export const updateDoctor = (id, data) => API.put(`/doctors/${id}/update`, data);
export const deleteDoctor = (id) => API.delete(`/doctors/${id}/delete`);

export default API;
