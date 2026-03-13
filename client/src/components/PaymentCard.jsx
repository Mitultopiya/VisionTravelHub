import { uploadBaseUrl } from '../services/api';
import { RiQrCodeLine } from 'react-icons/ri';

/**
 * Displays UPI payment details: UPI Name, UPI ID, QR code image, and instruction text.
 * @param {Object} settings - Company/payment settings: upi_name, bank_upi (UPI ID), upi_qr_path
 * @param {string} [className] - Optional extra CSS classes for the card container
 */
export default function PaymentCard({ settings = {}, className = '' }) {
  const upiName = settings.upi_name || settings.company_name || 'Pay via UPI';
  const upiId = settings.bank_upi || '';
  const qrPath = settings.upi_qr_path || '';
  const showCard = upiId || qrPath;

  if (!showCard) return null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <RiQrCodeLine className="text-teal-600 text-lg" />
        <h3 className="text-sm font-bold text-slate-800">Pay via UPI</h3>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {qrPath && (
          <div className="flex-shrink-0">
            <img
              src={`${uploadBaseUrl}${qrPath}`}
              alt="UPI QR Code"
              className="h-28 w-28 sm:h-32 sm:w-32 object-contain rounded-lg border border-slate-200 bg-white p-1"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {upiName && (
            <p className="text-sm font-semibold text-slate-800">{upiName}</p>
          )}
          {upiId && (
            <p className="text-sm text-teal-700 font-medium mt-0.5 break-all">{upiId}</p>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Scan this QR code using any UPI app to make payment.
          </p>
        </div>
      </div>
    </div>
  );
}
