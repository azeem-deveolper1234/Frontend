import React from 'react';

const AppointmentReceipt = ({ data, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-screen overflow-y-auto">

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1B4F72, #2E86C1)' }} className="p-7 text-center text-white">
          <div className="text-4xl mb-2">🏥</div>
          <div className="text-xl font-bold tracking-wide">City Medical Clinic</div>
          <div className="text-xs opacity-80 mt-1">Virtual Queue Management System</div>
          <div className="mt-4 inline-block bg-white bg-opacity-20 rounded-full px-5 py-1 text-xs tracking-widest uppercase">
            Appointment Receipt
          </div>
        </div>

        {/* Token */}
        <div className="bg-blue-50 border-b-2 border-dashed border-blue-200 py-5 text-center">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Your Token Number</div>
          <div className="text-6xl font-bold text-blue-800">{String(data.tokenNumber).padStart(2, '0')}</div>
          <div className="mt-2 inline-block bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full">
            ✓ Confirmed
          </div>
        </div>

        {/* Patient Info */}
        <div className="px-6 py-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-blue-50">Patient Information</div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Patient Name</span>
            <span className="text-sm font-bold text-blue-800">{data.patientName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-semibold text-gray-700">{data.email}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">Phone</span>
            <span className="text-sm font-semibold text-gray-700">{data.phone || 'N/A'}</span>
          </div>
        </div>

        <hr className="border-dashed border-gray-200 mx-6" />

        {/* Appointment Details */}
        <div className="px-6 py-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-blue-50">Appointment Details</div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Doctor</span>
            <span className="text-sm font-bold text-blue-800">{data.doctorName}</span>
          </div>
<div className="flex justify-between py-2 border-b border-gray-50">
  <span className="text-sm text-gray-500">Appointment Date</span>
  <span className="text-sm font-semibold text-gray-700">
    {new Date(data.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}
  </span>
</div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Time Slot</span>
            <span className="text-sm font-semibold text-gray-700">09:00 AM — 05:00 PM</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Priority</span>
            <span className={`text-sm font-semibold ${data.priority === 'emergency' ? 'text-red-600' : 'text-green-600'}`}>
              {data.priority === 'emergency' ? '🚨 Emergency' : '✅ Normal'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Reason</span>
            <span className="text-sm font-semibold text-gray-700">{data.notes || 'General Checkup'}</span>
          </div>
          <div className="flex justify-between py-2">
  <span className="text-sm text-gray-500">Booked On</span>
  <span className="text-sm font-semibold text-gray-700">
    {data.bookingTime}
  </span>
</div>
        </div>

        {/* Payment Summary */}
        {/* Payment Summary */}
{data.totalAmount && (
  <div className="mx-6 mb-4 bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
    <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">Payment Summary</div>
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">Consultation Fee</span>
      <span className="text-sm font-semibold">Rs. {data.totalAmount}</span>
    </div>
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">Advance Paid (50%)</span>
      <span className="text-sm font-semibold text-green-600">Rs. {Math.floor(data.totalAmount / 2)} ✓</span>
    </div>
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">Remaining (Pay at Clinic)</span>
      <span className="text-sm font-semibold text-orange-500">Rs. {Math.ceil(data.totalAmount / 2)}</span>
    </div>
    <div className="flex justify-between py-2 mt-2 border-t border-dashed border-green-200">
      <span className="text-sm font-bold text-gray-700">Total Amount</span>
      <span className="text-sm font-bold text-green-700">Rs. {data.totalAmount}</span>
    </div>
  </div>
)}

        {/* Note */}
        <div className="mx-6 mb-4 bg-yellow-50 rounded-xl p-4 border-l-4 border-yellow-400">
          <p className="text-xs text-yellow-700 leading-relaxed">
            ⚠️ <strong>Important:</strong> Please arrive 10 minutes before your appointment. Cancellation will result in advance payment forfeiture. Remaining amount to be paid at the clinic.
          </p>
        </div>

        {/* Footer */}
        <div style={{ background: '#1B4F72' }} className="px-6 py-4 text-center text-white">
          <div className="text-xs opacity-60 mb-1">Receipt ID: VQ-{new Date().getFullYear()}-{String(data.tokenNumber).padStart(4, '0')}</div>
          <div className="text-sm font-bold">Thank you for choosing City Medical Clinic!</div>
          <div className="text-xs opacity-60 mt-1">www.citymedicalclinic.com | 042-1234567</div>
        </div>

        {/* Buttons */}
        <div className="p-4 flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition"
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition"
          >
            ✕ Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default AppointmentReceipt;