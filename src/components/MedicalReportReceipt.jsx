import React from 'react';
import { FileText, Printer, X, Activity, Pill, User, Calendar, Stethoscope } from 'lucide-react';

const MedicalReportReceipt = ({ report, onClose, patientName }) => {
  if (!report) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (raw) => {
    if (!raw) return '—';
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-PK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none print:overflow-visible">
        
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }} className="p-8 text-center text-white relative print:bg-indigo-950 print:text-indigo-950">
          <div className="text-4xl mb-2 print:hidden">🏥</div>
          <h2 className="text-2xl font-black tracking-tight print:text-black">City Medical Clinic</h2>
          <p className="text-xs opacity-80 mt-1 print:text-slate-600">Smart Health Center & Virtual Queue Management</p>
          <div className="mt-4 inline-block bg-white bg-opacity-20 rounded-full px-5 py-1 text-xs tracking-widest uppercase font-black print:border print:border-black print:text-black">
            Official Diagnostic & Prescription Report
          </div>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 print:bg-white print:border-none print:p-0 print:grid-cols-2">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Report ID</span>
              <span className="font-mono text-sm font-bold text-slate-700">MR-{report._id?.slice(-8).toUpperCase()}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Date of Issue</span>
              <span className="text-sm font-bold text-slate-700">{formatDate(report.createdAt)}</span>
            </div>
          </div>

          {/* Doctor & Patient Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100 print:grid-cols-2 print:pb-4">
            <div className="space-y-3">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5 border-indigo-50">
                <User className="w-4 h-4" /> Patient Details
              </h3>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Full Name</span>
                <span className="text-sm font-bold text-slate-800">{report.patient?.name || patientName || 'Walk-in Patient'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Patient Email</span>
                <span className="text-xs font-semibold text-slate-600">{report.patient?.email || 'N/A'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5 border-indigo-50">
                <Stethoscope className="w-4 h-4" /> Attending Consultant
              </h3>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Doctor Name</span>
                <span className="text-sm font-bold text-slate-850">Dr. {report.doctor?.name || 'Specialist'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Specialization</span>
                <span className="text-xs font-semibold text-indigo-600">{report.doctor?.specialization || 'Consultant'}</span>
              </div>
            </div>
          </div>

          {/* Vitals Mapping */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4.5 h-4.5" /> Patient Vitals
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-50 py-3.5 px-2 rounded-2xl border border-slate-100/80 print:bg-white print:border">
                <span className="text-[9px] font-black text-slate-400 uppercase block">Blood Pressure</span>
                <span className="text-sm font-black text-slate-800">{report.bloodPressure || '—'}</span>
              </div>
              <div className="bg-slate-50 py-3.5 px-2 rounded-2xl border border-slate-100/80 print:bg-white print:border">
                <span className="text-[9px] font-black text-slate-400 uppercase block">Temperature</span>
                <span className="text-sm font-black text-slate-800">{report.temperature || '—'}</span>
              </div>
              <div className="bg-slate-50 py-3.5 px-2 rounded-2xl border border-slate-100/80 print:bg-white print:border">
                <span className="text-[9px] font-black text-slate-400 uppercase block">Weight</span>
                <span className="text-sm font-black text-slate-800">{report.weight || '—'}</span>
              </div>
            </div>
          </div>

          {/* Clinical Findings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            {report.symptoms && (
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 print:bg-white print:border print:p-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Symptoms / Complaints</span>
                <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">{report.symptoms}</p>
              </div>
            )}
            
            <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-50 print:bg-white print:border print:p-4">
              <span className="text-[10px] font-black text-indigo-900/60 uppercase tracking-wider block mb-1">Clinical Diagnosis</span>
              <p className="text-sm text-indigo-900 font-black leading-relaxed whitespace-pre-wrap">{report.diagnosis}</p>
            </div>
          </div>

          {/* Prescription Medicines */}
          {report.prescription && report.prescription.length > 0 && (
            <div className="space-y-3.5">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <Pill className="w-4.5 h-4.5" /> Rx (Prescription Medicines)
              </h3>
              <div className="border border-slate-100 rounded-2xl overflow-hidden print:border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider print:bg-white print:border-b">
                      <th className="px-5 py-3">Medicine Name</th>
                      <th className="px-5 py-3">Dosage</th>
                      <th className="px-5 py-3">Frequency</th>
                      <th className="px-5 py-3 text-center">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-semibold print:divide-y">
                    {report.prescription.map((med, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-bold text-slate-850">{med.medicineName}</td>
                        <td className="px-5 py-3.5">{med.dosage || '—'}</td>
                        <td className="px-5 py-3.5">{med.frequency || '—'}</td>
                        <td className="px-5 py-3.5 text-center">{med.duration ? `${med.duration}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Doctor Directives & Advice */}
          {report.doctorNotes && (
            <div className="p-5 rounded-2xl bg-amber-50/30 border border-amber-100/50 print:bg-white print:border print:p-4">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">Advice & Directives</span>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-wrap">{report.doctorNotes}</p>
            </div>
          )}

          {/* Follow Up Checkup */}
          {report.followUp && (
            <div className="flex items-center gap-3 bg-indigo-50/40 p-4.5 rounded-2xl border border-indigo-100/30 print:bg-white print:border print:p-3">
              <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] font-black text-indigo-900/60 uppercase tracking-wider block leading-none mb-1">Follow-up checkup requested</span>
                <p className="text-xs font-black text-slate-700 leading-none">Schedule next appointment on or around: <span className="text-indigo-600 font-bold ml-1">{formatDate(report.nextAppointment)}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: '#1e1b4b' }} className="px-8 py-5 text-center text-white print:bg-white print:text-slate-600 print:border-t print:mt-8">
          <div className="text-[10px] opacity-70 print:text-[8px]">
            This document is electronically generated and verified by City Medical Smart Queue System.
          </div>
          <div className="text-xs font-bold mt-1 print:text-black">City Medical Clinic • Lahore, Pakistan</div>
        </div>

        {/* Action Panel */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-indigo-900 hover:bg-indigo-950 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-indigo-900/10 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 hover:bg-slate-350 text-slate-700 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Close Report
          </button>
        </div>

      </div>
    </div>
  );
};

export default MedicalReportReceipt;
