import pool from '../config/db.js';
import { generateItineraryPDF, generateInvoicePDF, generateQuotationPDF, generateInvoiceDocPDF, generatePaymentSlipPDF } from '../services/pdfService.js';

export const itinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await pool.query('SELECT * FROM packages WHERE id = $1', [id]);
    if (pkg.rows.length === 0) return res.status(404).json({ message: 'Package not found.' });
    const days = await pool.query('SELECT * FROM package_days WHERE package_id = $1 ORDER BY day_number', [id]);
    const buf = await generateItineraryPDF(pkg.rows[0], days.rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=itinerary-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const invoice = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [booking.rows[0].customer_id]);
    const payments = await pool.query('SELECT * FROM payments WHERE booking_id = $1', [id]);
    const total = Number(booking.rows[0].total_amount || 0);
    const buf = await generateInvoicePDF(booking.rows[0], customer.rows[0], payments.rows, total);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const invoiceDocPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (req.branchId && inv.rows[0].branch_id && Number(inv.rows[0].branch_id) !== Number(req.branchId)) {
      return res.status(403).json({ message: 'Access denied for this invoice.' });
    }
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [inv.rows[0].customer_id]);
    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
    const payments = await pool.query('SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_at', [id]);
    let saleAgent = '';
    if (inv.rows[0].created_by) {
      const ur = await pool.query('SELECT name FROM users WHERE id = $1', [inv.rows[0].created_by]);
      saleAgent = ur.rows[0]?.name || '';
    }
    const buf = await generateInvoiceDocPDF(inv.rows[0], customer.rows[0] || {}, items.rows, payments.rows, saleAgent);
    res.setHeader('Content-Type', 'application/pdf');
    const fileName = (inv.rows[0].invoice_number || `INV-${id}`).replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error('Invoice doc PDF error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? (err?.message || String(err)) : undefined });
  }
};

export const paymentSlipPdf = async (req, res) => {
  try {
    const { id } = req.params; // invoice_payment id
    const result = await pool.query(
      `SELECT ip.*, i.invoice_number, i.total as invoice_total, i.company_gst, i.branch_id,
              i.customer_gst, i.place_of_supply,
              c.name as customer_name, c.mobile as customer_mobile, c.email as customer_email
       FROM invoice_payments ip
       JOIN invoices i ON ip.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id
       WHERE ip.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Payment not found.' });
    if (req.branchId && result.rows[0].branch_id && Number(result.rows[0].branch_id) !== Number(req.branchId)) {
      return res.status(403).json({ message: 'Access denied for this payment slip.' });
    }
    const buf = await generatePaymentSlipPDF(result.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payment-receipt-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error('Payment slip PDF error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? (err?.message || String(err)) : undefined });
  }
};

export const quotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ message: 'Quotation not found.' });
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [q.rows[0].customer_id]);
    const items = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [id]);
    const pkg = q.rows[0].package_id ? await pool.query('SELECT name FROM packages WHERE id = $1', [q.rows[0].package_id]) : { rows: [] };
    const customerRow = customer.rows[0] || {};
    const buf = await generateQuotationPDF(q.rows[0], customerRow, items.rows, pkg.rows[0]?.name);
    res.setHeader('Content-Type', 'application/pdf');
    const fileNo = String(Number(q.rows[0]?.id || 0)).padStart(6, '0');
    res.setHeader('Content-Disposition', `attachment; filename=PRO-${fileNo}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error('Quotation PDF error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? (err?.message || String(err)) : undefined });
  }
};
