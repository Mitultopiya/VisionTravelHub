import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Use relative /uploads when API is relative (proxy); else use same origin as API (e.g. http://localhost:5000)
export const uploadBaseUrl = baseURL.startsWith('http') ? baseURL.replace(/\/api\/?$/, '') || 'http://localhost:5000' : '';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });

// Users (admin only)
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const toggleBlockUser = (id, is_blocked) => api.patch(`/users/${id}/block`, { is_blocked });

// Customers
export const getCustomers = (params) => api.get('/customers', { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post('/customers', data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
export const addCustomerFamily = (id, data) => api.post(`/customers/${id}/family`, data);
export const removeCustomerFamily = (id, fid) => api.delete(`/customers/${id}/family/${fid}`);
export const setCustomerFamily = (id, members) => api.put(`/customers/${id}/family`, { members });

// Masters
export const getCities = () => api.get('/masters/cities');
export const createCity = (data) => api.post('/masters/cities', data);
export const updateCity = (id, data) => api.put(`/masters/cities/${id}`, data);
export const deleteCity = (id) => api.delete(`/masters/cities/${id}`);
export const getHotels = () => api.get('/masters/hotels');
export const createHotel = (data) => api.post('/masters/hotels', data);
export const updateHotel = (id, data) => api.put(`/masters/hotels/${id}`, data);
export const deleteHotel = (id) => api.delete(`/masters/hotels/${id}`);
export const getVehicles = () => api.get('/masters/vehicles');
export const createVehicle = (data) => api.post('/masters/vehicles', data);
export const updateVehicle = (id, data) => api.put(`/masters/vehicles/${id}`, data);
export const deleteVehicle = (id) => api.delete(`/masters/vehicles/${id}`);
export const getActivities = () => api.get('/masters/activities');
export const createActivity = (data) => api.post('/masters/activities', data);
export const updateActivity = (id, data) => api.put(`/masters/activities/${id}`, data);
export const deleteActivity = (id) => api.delete(`/masters/activities/${id}`);
export const uploadMastersFile = (folder, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/masters/upload?folder=${encodeURIComponent(folder)}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
};
// Packages
export const getPackages = () => api.get('/packages');
export const getPackage = (id) => api.get(`/packages/${id}`);
export const createPackage = (data) => api.post('/packages', data);
export const updatePackage = (id, data) => api.put(`/packages/${id}`, data);
export const deletePackage = (id) => api.delete(`/packages/${id}`);
export const savePackageDays = (id, days) => api.post(`/packages/${id}/days`, { days });
export const uploadPackageFile = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/packages/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Bookings
export const getBookings = (params) => api.get('/bookings', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
export const createBooking = (data) => api.post('/bookings', data);
export const updateBooking = (id, data) => api.put(`/bookings/${id}`, data);
export const addBookingNote = (id, note) => api.post(`/bookings/${id}/notes`, { note });

// Quotations
export const getQuotations = () => api.get('/quotations');
export const getQuotation = (id) => api.get(`/quotations/${id}`);
export const createQuotation = (data) => api.post('/quotations', data);
export const updateQuotation = (id, data) => api.put(`/quotations/${id}`, data);
export const deleteQuotation = (id) => api.delete(`/quotations/${id}`);
export const convertQuotationToBooking = (id) => api.post(`/quotations/${id}/convert-booking`);

// Invoices (standalone invoice module)
export const getInvoices = () => api.get('/invoices');
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const getNextInvoiceNumber = () => api.get('/invoices/next-number');
export const createInvoice = (data) => api.post('/invoices', data);
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);
export const addInvoicePayment = (id, data) => api.post(`/invoices/${id}/payments`, data);
export const getAllInvoicePayments = () => api.get('/invoices/all-payments');
export const deleteInvoicePayment = (invoiceId, paymentId) => api.delete(`/invoices/${invoiceId}/payments/${paymentId}`);

// Payments
export const getPaymentsByBooking = (bookingId) => api.get(`/payments/booking/${bookingId}`);
export const addPayment = (data) => api.post('/payments', data);
export const deletePayment = (id) => api.delete(`/payments/${id}`);

// Documents
export const getDocuments = (entity_type, entity_id) => api.get('/documents', { params: { entity_type, entity_id } });
export const addDocument = (formData) => api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteDocument = (id) => api.delete(`/documents/${id}`);

// Staff
export const getStaff = () => api.get('/staff');
export const createStaff = (data) => api.post('/staff', data);
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data);
export const toggleBlockStaff = (id, is_blocked) => api.patch(`/staff/${id}/block`, { is_blocked });
export const resetStaffPassword = (id, new_password) => api.patch(`/staff/${id}/reset-password`, { new_password });
export const deleteStaff = (id) => api.delete(`/staff/${id}`);
export const getStaffPerformance = (id) => api.get(`/staff/${id}/performance`);

// Reports
export const getDashboard = () => api.get('/reports/dashboard');
export const getRevenueReport = (params) => api.get('/reports/revenue', { params });
export const getRevenueReportFiltered = (start, end) => api.get('/reports/revenue', { params: { start, end } });
export const getPendingPayments = () => api.get('/reports/pending-payments');
export const getStaffPerformanceReport = () => api.get('/reports/staff-performance');

// PDF
export const downloadItinerary = (id) => api.get(`/pdf/itinerary/${id}`, { responseType: 'blob' });
export const downloadInvoice = (id) => api.get(`/pdf/invoice/${id}`, { responseType: 'blob' });
export const downloadInvoicePdf = (id) => api.get(`/pdf/invoice-doc/${id}`, { responseType: 'blob' });
export const downloadQuotationPdf = (id) => api.get(`/pdf/quotation/${id}`, { responseType: 'blob' });
export const downloadPaymentSlipPdf = (id) => api.get(`/pdf/payment-slip/${id}`, { responseType: 'blob' });

// Company Settings
export const getCompanySettings = () => api.get('/settings');
export const updateCompanySettings = (data) => api.put('/settings', data);

export default api;
