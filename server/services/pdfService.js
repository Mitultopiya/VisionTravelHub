import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load company settings; if branchId set, branch_settings override company_settings */
async function getCompanySettings(branchId = null) {
  try {
    const global = await pool.query('SELECT key, value FROM company_settings');
    const s = {};
    global.rows.forEach((r) => { s[r.key] = r.value || ''; });

    const bid = branchId != null ? parseInt(branchId, 10) : null;
    if (bid) {
      const branch = await pool.query('SELECT key, value FROM branch_settings WHERE branch_id = $1', [bid]);
      branch.rows.forEach((r) => { s[r.key] = r.value || ''; });
    }
    return {
      name:    s.company_name    || 'Vision Travel Hub',
      address: s.company_address || '502, Sector 16, Rohini, New Delhi, Delhi, 110085',
      phone:   s.company_phone   || '8976589345',
      email:   s.company_email   || 'visiontravel@email.com',
      gst:     s.company_gst     || '',
      bankName:   s.bank_name    || '',
      accountNumber: s.bank_account || '',
      ifsc:    s.bank_ifsc       || '',
      upi:     s.bank_upi        || '',
      upiName: s.upi_name        || '',
      upiQrPath: s.upi_qr_path   || '',
      bankBranch: s.bank_branch  || '',
    };
  } catch (_) {
    return {
      name: 'Vision Travel Hub', address: '502, Sector 16, Rohini, New Delhi, Delhi, 110085',
      phone: '8976589345', email: 'visiontravel@email.com', gst: '',
      bankName: '', accountNumber: '', ifsc: '', upi: '', upiName: '', upiQrPath: '', bankBranch: '',
    };
  }
}

/** Load UPI QR image from uploads/payment/ if upiQrPath is set; returns embedded image or null */
async function loadUpiQrImage(doc, upiQrPath) {
  if (!upiQrPath || typeof upiQrPath !== 'string') return null;
  const filename = path.basename(upiQrPath.replace(/^\/+/, '').replace(/^uploads\/payment\/?/, ''));
  if (!filename) return null;
  const baseDir = path.join(__dirname, '..');
  const filePath = path.join(baseDir, 'uploads', 'payment', filename);
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const ext = (path.extname(filename) || '').toLowerCase();
    if (ext === '.png') return await doc.embedPng(buf);
    return await doc.embedJpg(buf);
  } catch (_) {
    return null;
  }
}

/**
 * Generate itinerary PDF for a package – professional layout with logo + image
 */
export async function generateItineraryPDF(packageData, days) {
  packageData = packageData || {};
  days = Array.isArray(days) ? days : [];

  const COMPANY_PDF = await getCompanySettings();

  const doc = await PDFDocument.create();
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const page = doc.addPage([pageWidth, pageHeight]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = margin;
  const right = pageWidth - margin;
  const textDark = rgb(0.12, 0.12, 0.12);
  const boxBorder = rgb(0.8, 0.8, 0.8);

  // Try to load company logo (same as quotations/invoices)
  let logoImage = null;
  try {
    const baseDir = path.join(__dirname, '..', '..');
    const pngPath = path.join(baseDir, 'client', 'public', 'Vision_JPG_Logo.png');
    const jpgPath = path.join(baseDir, 'client', 'public', 'Vision JPG Logo.JPG');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      try {
        logoImage = await doc.embedPng(buf);
      } catch {
        logoImage = await doc.embedJpg(buf);
      }
    } else if (fs.existsSync(jpgPath)) {
      const buf = fs.readFileSync(jpgPath);
      logoImage = await doc.embedJpg(buf);
    }
  } catch {
    logoImage = null;
  }

  // Optional package hero image (first uploaded image)
  let pkgImage = null;
  try {
    const urls = Array.isArray(packageData.image_urls) ? packageData.image_urls : [];
    const firstUrl = urls[0] || packageData.image_url;
    if (firstUrl) {
      const baseDir = path.join(__dirname, '..', '..');
      // Strip absolute origin (http://domain) if present and leading slashes
      let rel = String(firstUrl).replace(/^https?:\/\/[^/]+/, '');
      rel = rel.replace(/^\/+/, '');
      const imgPath = path.join(baseDir, rel);
      if (fs.existsSync(imgPath)) {
        const buf = fs.readFileSync(imgPath);
        try {
          pkgImage = await doc.embedPng(buf);
        } catch {
          pkgImage = await doc.embedJpg(buf);
        }
      }
    }
  } catch {
    pkgImage = null;
  }

  let y = pageHeight - 80;

  // Title + company block
  page.drawText('TRAVEL ITINERARY', { x: left, y, size: 24, font: fontBold, color: textDark });
  y -= 30;
  page.drawText(asciiOnly(COMPANY_PDF.name || 'YOUR COMPANY'), { x: left, y, size: 11, font: fontBold, color: textDark });
  y -= 14;
  page.drawText(asciiOnly(COMPANY_PDF.address), { x: left, y, size: 9.5, font, color: textDark });
  y -= 12;
  page.drawText(asciiOnly(COMPANY_PDF.phone) + ' | ' + asciiOnly(COMPANY_PDF.email), { x: left, y, size: 9.5, font, color: textDark });

  // Logo on right
  const logoCenterX = right - 40;
  const logoCenterY = pageHeight - 110;
  if (logoImage) {
    const maxSide = 70;
    const fitScale = Math.min(maxSide / logoImage.width, maxSide / logoImage.height);
    const imgW = logoImage.width * fitScale;
    const imgH = logoImage.height * fitScale;
    page.drawImage(logoImage, {
      x: logoCenterX - imgW / 2,
      y: logoCenterY - imgH / 2,
      width: imgW,
      height: imgH,
    });
  }

  // Package info box
  const boxTop = pageHeight - 190;
  const boxH = 95;
  page.drawRectangle({
    x: left,
    y: boxTop - boxH,
    width: right - left,
    height: boxH,
    borderColor: boxBorder,
    borderWidth: 1,
  });

  const pkgName = asciiOnly(packageData.name || packageData.title || 'Package');
  const duration = Number(packageData.duration_days || packageData.days || 0);

  // Compute merged price: base package + default hotel + default vehicle
  const basePrice = Number(packageData.price || 0);
  let hotelPrice = 0;
  let vehiclePrice = 0;
  try {
    if (packageData.default_hotel_id) {
      const h = await pool.query('SELECT price FROM hotels WHERE id = $1', [packageData.default_hotel_id]);
      hotelPrice = Number(h.rows[0]?.price || 0);
    }
    if (packageData.default_vehicle_id) {
      const v = await pool.query('SELECT price FROM vehicles WHERE id = $1', [packageData.default_vehicle_id]);
      vehiclePrice = Number(v.rows[0]?.price || 0);
    }
  } catch {
    hotelPrice = vehiclePrice = 0;
  }
  const totalPrice = basePrice + hotelPrice + vehiclePrice;
  const price = pdfAmount(totalPrice);

  page.drawText('Package:', { x: left + 12, y: boxTop - 20, size: 10, font, color: textDark });
  page.drawText(pkgName, { x: left + 80, y: boxTop - 20, size: 11, font: fontBold, color: textDark });

  page.drawText('Duration:', { x: left + 12, y: boxTop - 40, size: 10, font, color: textDark });
  page.drawText(String(duration) + ' days', { x: left + 80, y: boxTop - 40, size: 10, font: fontBold, color: textDark });

  page.drawText('Total price :', { x: left + 12, y: boxTop - 70, size: 11, font, color: textDark });
  page.drawText(price, { x: left + 80, y: boxTop - 70, size: 11, font: fontBold, color: textDark });


  // Package hero image on the right half of info box if available
  if (pkgImage) {
    const imgMaxW = (right - left) / 2 - 20;
    const imgMaxH = boxH - 24;
    const fitScale = Math.min(imgMaxW / pkgImage.width, imgMaxH / pkgImage.height);
    const imgW = pkgImage.width * fitScale;
    const imgH = pkgImage.height * fitScale;
    const imgX = right - imgW - 16;
    const imgY = boxTop - 14 - imgH;
    page.drawImage(pkgImage, {
      x: imgX,
      y: imgY,
      width: imgW,
      height: imgH,
    });
  }

  // Optional package description block (multi-line)
  let contentY = boxTop - boxH - 18;
  const desc = asciiOnly(packageData.description || '');
  if (desc) {
    page.drawText('Description', { x: left, y: contentY, size: 11, font: fontBold, color: textDark });
    contentY -= 12;
    const descFontSize = 9.5;
    const descLineH = 13;
    const maxDescW = right - left;
    const descWords = desc.split(' ');
    let cur = '';
    for (const w of descWords) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, descFontSize) <= maxDescW - 4) cur = t;
      else {
        page.drawText(cur, { x: left + 2, y: contentY, size: descFontSize, font, color: textDark });
        contentY -= descLineH;
        cur = w;
      }
    }
    if (cur) {
      page.drawText(cur, { x: left + 2, y: contentY, size: descFontSize, font, color: textDark });
      contentY -= descLineH;
    }
    contentY -= 8;
  }

  // Day-wise itinerary title
  page.drawText('Day-wise Itinerary', { x: left, y: contentY, size: 13, font: fontBold, color: textDark });
  contentY -= 12;
  page.drawLine({ start: { x: left, y: contentY }, end: { x: right, y: contentY }, thickness: 0.8, color: boxBorder });
  contentY -= 12;

  // Draw each day with word-wrapped bullet lines
  const maxWidth = right - left;
  const dayFontSize = 10;
  const dayLineH = 13;
  const wrap = (text) => {
    const words = asciiOnly(text || '').split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, dayFontSize) <= maxWidth - 20) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const sortedDays = [...days].sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
  for (const d of sortedDays) {
    if (contentY < 80) break; // simple guard; most itineraries will fit one page
    const title = `Day ${d.day_number || ''}`.trim();
    page.drawText(title, { x: left, y: contentY, size: 11, font: fontBold, color: textDark });
    contentY -= dayLineH;

    const lines = [];
    if (d.activities) lines.push(`Activities: ${d.activities}`);
    if (d.hotel_id) lines.push(`Hotel: ${d.hotel_id}`);
    if (d.meals) lines.push(`Meals: ${d.meals}`);
    if (d.transport) lines.push(`Transport: ${d.transport}`);

    // Bulleted detail lines (Activities/Hotel/Meals/Transport)
    for (const ln of lines) {
      const wrapped = wrap(ln);
      wrapped.forEach((wl) => {
        if (contentY < 80) return;
        page.drawText(`• ${wl}`, { x: left + 10, y: contentY, size: dayFontSize, font, color: textDark });
        contentY -= dayLineH;
      });
    }

    // Notes: paragraph style (no bullet, no \"Notes:\" label)
    if (d.notes) {
      const wrappedNotes = wrap(d.notes);
      wrappedNotes.forEach((wl) => {
        if (contentY < 80) return;
        page.drawText(wl, { x: left + 10, y: contentY, size: dayFontSize, font, color: textDark });
        contentY -= dayLineH;
      });
    }
    contentY -= 6;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate invoice PDF for a booking
 */
export async function generateInvoicePDF(booking, customer, payments = [], totalAmount = 0) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 750;
  const lineHeight = 18;
  const margin = 50;

  const drawText = (text, size = 12, bold = false) => {
    const f = bold ? fontBold : font;
    doc.getPages()[0].drawText(text, { x: margin, y, size, font: f, color: rgb(0, 0, 0) });
    y -= lineHeight;
  };

  doc.getPages()[0].drawText('INVOICE', { x: margin, y, size: 22, font: fontBold, color: rgb(0.1, 0.2, 0.5) });
  y -= 28;
  drawText(`Booking #${booking.id}`, 14, true);
  drawText(`Customer: ${customer?.name || 'N/A'} | ${customer?.email || ''} | ${customer?.mobile || ''}`);
  drawText(`Travel: ${booking.travel_start_date || 'TBD'} to ${booking.travel_end_date || 'TBD'}`);
  drawText(`Status: ${booking.status}`);
  y -= 10;
  drawText(`Total Amount: ₹${Number(totalAmount || booking.total_amount || 0).toLocaleString()}`, 14, true);
  drawText('Payments:', 12, true);
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  payments.forEach((p) => drawText(`  ${p.mode}: ₹${Number(p.amount).toLocaleString()} (${p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-'})`));
  drawText(`Paid: ₹${paid.toLocaleString()} | Due: ₹${(Number(totalAmount || 0) - paid).toLocaleString()}`);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

const TERMS_PDF = [
  'Payment is due upon receipt unless otherwise stated.',
  'Prices are valid for the validity period stated on this quotation.',
  'Any changes to the scope of work may affect the quoted price and timeline.',
  'Our liability is limited to the total amount paid.',
  'Advance payment may be required to confirm the booking.',
  'Cancellation policy applies as per company terms.',
];

// Use ASCII "Rs." in PDF (StandardFonts do not support Unicode rupee symbol). Avoid locale to prevent 500 in some envs.
function pdfAmount(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 'Rs.0.00';
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `Rs.${withCommas}.${decPart || '00'}`;
  return neg ? `-${body}` : body;
}

// Strip to ASCII so pdf-lib StandardFonts don't throw (WinAnsi encoding only)
function asciiOnly(s) {
  if (s == null || typeof s !== 'string') return '-';
  return s.replace(/[^\x20-\x7E]/g, ' ').trim().substring(0, 500) || '-';
}

// pdf-lib drawText requires string only (no Date/number). Coerce anything to string.
function toPdfText(v) {
  if (v == null || v === '') return '-';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/**
 * Generate quotation PDF – template style matching provided quotation image
 */
export async function generateQuotationPDF(quotation, customer, items = [], packageName = '') {
  quotation = quotation || {};
  customer = customer || {};
  items = Array.isArray(items) ? items : [];

  const COMPANY_PDF = await getCompanySettings();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const left = margin;
  const right = pageWidth - margin;
  const boxBorder = rgb(0.68, 0.68, 0.68);
  const textDark = rgb(0.12, 0.12, 0.12);
  const textW = (t, s, f = font) => f.widthOfTextAtSize(asciiOnly(t), s);
  const drawRight = (t, x, yPos, s = 10, f = fontBold) => {
    const safe = asciiOnly(t);
    page.drawText(safe, { x: x - textW(safe, s, f), y: yPos, size: s, font: f, color: textDark });
  };

  // Logo top-right (optional): same position as template
  const logoSize = 78;
  let logoImage;
  try {
    const baseDir = path.join(__dirname, '..', '..');
    const pngPath = path.join(baseDir, 'client', 'public', 'Vision_JPG_Logo.png');
    const jpgPath = path.join(baseDir, 'client', 'public', 'Vision JPG Logo.JPG');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      try {
        logoImage = await doc.embedPng(buf);
      } catch (_) {
        logoImage = await doc.embedJpg(buf);
      }
    } else if (fs.existsSync(jpgPath)) {
      logoImage = await doc.embedJpg(fs.readFileSync(jpgPath));
    }
  } catch (_) {
    logoImage = null;
  }

  let y = pageHeight - 86;

  // Main title and company block
  page.drawText('QUOTATION', { x: left, y, size: 28, font: fontBold, color: textDark });
  y -= 34;
  page.drawText(asciiOnly(COMPANY_PDF.name || 'YOUR COMPANY'), { x: left, y, size: 11, font: fontBold, color: textDark });
  y -= 16;
  page.drawText(asciiOnly(COMPANY_PDF.address), { x: left, y, size: 9.5, font: font, color: textDark });
  y -= 13;
  page.drawText(asciiOnly(COMPANY_PDF.phone), { x: left, y, size: 9.5, font: font, color: textDark });
  y -= 13;
  page.drawText(asciiOnly(COMPANY_PDF.email), { x: left, y, size: 9.5, font: font, color: textDark });

  // Logo area (no rounded border)
  const logoCenterX = right - 55;
  const logoCenterY = pageHeight - 130;
  if (logoImage) {
    const maxSide = 76;
    const fitScale = Math.min(maxSide / logoImage.width, maxSide / logoImage.height);
    const imgW = logoImage.width * fitScale;
    const imgH = logoImage.height * fitScale;
    page.drawImage(logoImage, {
      x: logoCenterX - imgW / 2,
      y: logoCenterY - imgH / 2,
      width: imgW,
      height: imgH,
    });
  } else {
    page.drawText('YOUR', { x: logoCenterX - 20, y: logoCenterY + 20, size: 8.5, font: fontBold, color: textDark });
    page.drawText('LOGO', { x: logoCenterX - 22, y: logoCenterY + 5, size: 8.5, font: fontBold, color: textDark });
    page.drawText('HERE', { x: logoCenterX - 20, y: logoCenterY - 10, size: 8.5, font: fontBold, color: textDark });
  }

  // Quote info box (2 rows, 2 columns)
  const infoTop = pageHeight - 230;
  const infoHeight = 38;
  page.drawRectangle({ x: left, y: infoTop - infoHeight, width: right - left, height: infoHeight, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: infoTop - 19 }, end: { x: right, y: infoTop - 19 }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: left + (right - left) / 2, y: infoTop }, end: { x: left + (right - left) / 2, y: infoTop - infoHeight }, thickness: 1, color: boxBorder });

  const quoteNo = 'PRO-' + String(Number(quotation.id || 0)).padStart(6, '0');
  const quoteDate = toPdfText(quotation.created_at);
  const dueDate = quotation.valid_until != null
    ? (quotation.valid_until instanceof Date ? quotation.valid_until.toISOString().slice(0, 10) : String(quotation.valid_until).slice(0, 10))
    : '-';

  page.drawText('Quote No.: ' + asciiOnly(quoteNo), { x: left + 6, y: infoTop - 13, size: 10, font: fontBold, color: textDark });
  page.drawText('Quote Date: ' + quoteDate, { x: left + (right - left) / 2 + 6, y: infoTop - 13, size: 10, font: fontBold, color: textDark });
  const prepLabel = quotation.prepared_by ? 'Prepared by: ' + asciiOnly(quotation.prepared_by) : 'Prepared by: -';
  page.drawText(prepLabel, { x: left + 6, y: infoTop - 32, size: 10, font: fontBold, color: textDark });
  page.drawText('Due Date: ' + dueDate, { x: left + (right - left) / 2 + 6, y: infoTop - 32, size: 10, font: fontBold, color: textDark });

  // Customer details box
  const custTop = infoTop - 54;
  const custHeight = 74;
  page.drawRectangle({ x: left, y: custTop - custHeight, width: right - left, height: custHeight, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: custTop - 25 }, end: { x: right, y: custTop - 25 }, thickness: 1, color: boxBorder });
  page.drawText('Customer Details', { x: left + (right - left) / 2 - 45, y: custTop - 17, size: 11, font: fontBold, color: textDark });

  const customerName = asciiOnly(customer.name || '-');
  const customerEmail = asciiOnly(customer.email || '-');
  const customerMobile = asciiOnly(customer.mobile || '-');
  const addressText = asciiOnly(customer.address || '-');
  const addressLines = addressText.match(/.{1,48}(\s|$)/g) || [addressText];
  const familyCount = Number(quotation.family_count ?? customer.family_count ?? 1) || 1;

  page.drawText('Name: ' + customerName, { x: left + 6, y: custTop - 39, size: 10, font: fontBold, color: textDark });
  page.drawText('Address: ' + (addressLines[0] || '-').trim(), { x: left + 6, y: custTop - 55, size: 10, font: fontBold, color: textDark });
  page.drawText('Email: ' + customerEmail, { x: left + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });
  page.drawText('Phone: ' + customerMobile, { x: left + (right - left) / 2 + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });
  page.drawText('No. of Persons: ' + String(familyCount), { x: left + (right - left) / 2 + 6, y: custTop - 55, size: 10, font: fontBold, color: textDark });

  // Item table: only show rows with non-zero amount (exclude Rs.0.00 rows)
  const displayItems = items.filter((it) => Number(it?.amount || 0) !== 0);
  const rowCount = Math.max(1, displayItems.length);
  const headerH = 26;
  const rowH = 28;
  const tableHeight = headerH + rowCount * rowH;
  const tableTop = custTop - custHeight - 14;
  const tableBottom = tableTop - tableHeight;
  page.drawRectangle({ x: left, y: tableBottom, width: right - left, height: tableHeight, borderColor: boxBorder, borderWidth: 1 });

  const colItem = left + 314;
  const colRate = left + 398;
  const colQty = left + 435;
  page.drawLine({ start: { x: left, y: tableTop - headerH }, end: { x: right, y: tableTop - headerH }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colItem, y: tableTop }, end: { x: colItem, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colRate, y: tableTop }, end: { x: colRate, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colQty, y: tableTop }, end: { x: colQty, y: tableBottom }, thickness: 1, color: boxBorder });

  page.drawText('Item Description', { x: left + 110, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Unit Price', { x: colItem + 16, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Qty', { x: colRate + 8, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Total', { x: colQty + 24, y: tableTop - 18, size: 11, font: fontBold, color: textDark });

  const bodyTop = tableTop - headerH;
  for (let i = 1; i < rowCount; i++) {
    const yy = bodyTop - i * rowH;
    page.drawLine({ start: { x: left, y: yy }, end: { x: right, y: yy }, thickness: 1, color: boxBorder });
  }

  for (let i = 0; i < rowCount; i++) {
    const it = displayItems[i];
    const yRow = bodyTop - i * rowH - 15;
    const rateRight = colRate - 6;
    const totalRight = right - 6;
    if (!it) continue;
    const amt = Number(it.amount || 0);
    const desc = asciiOnly(it.description || '-').substring(0, 55);
    page.drawText(desc, { x: left + 6, y: yRow, size: 9.5, font: font, color: textDark });
    const amountTxt = pdfAmount(amt);
    drawRight(amountTxt, rateRight, yRow, 9.5, font);
    page.drawText('1', { x: colRate + 14, y: yRow, size: 9.5, font: font, color: textDark });
    drawRight(amountTxt, totalRight, yRow, 9.5, font);
  }

  // Terms (left) + summary (right)
  const termsTop = tableBottom - 16;
  const summaryW = 176;
  const summaryX = right - summaryW;

  page.drawText('Terms and Conditions:', { x: left + 2, y: termsTop, size: 11, font: fontBold, color: textDark });

  // Use all lines the user typed, with word-wrapping and numbering (same behaviour as invoice terms)
  const manualTerms = String(quotation.terms_text || '')
    .split(/\r?\n/)
    .map((s) => asciiOnly(s).trim())
    .filter(Boolean);
  const termsArr = manualTerms.length ? manualTerms : (Array.isArray(TERMS_PDF) ? TERMS_PDF : [TERMS_PDF]);

  const termsMaxW = summaryX - left - 14; // keep inside left column
  const termFontSize = 9;
  const termLineH = 13;
  const wrapTermLine = (text) => {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, termFontSize) <= termsMaxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  let ty = termsTop - 16;
  termsArr.forEach((line, idx) => {
    const prefix = `${idx + 1}. `;
    const prefixW = font.widthOfTextAtSize(prefix, termFontSize);
    const wrapped = wrapTermLine(asciiOnly(line));
    wrapped.forEach((wl, wi) => {
      if (ty < 80) return; // stop near bottom margin
      const drawX = wi === 0 ? left + 2 : left + 2 + prefixW;
      const drawTxt = wi === 0 ? prefix + wl : wl;
      page.drawText(drawTxt, { x: drawX, y: ty, size: termFontSize, font, color: textDark });
      ty -= termLineH;
    });
    ty -= 2;
  });

  const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const discountVal = Number(quotation.discount || 0);
  const discountPct = subtotal > 0 ? Math.round((discountVal / subtotal) * 100) : 0;
  const taxPct = Number(quotation.tax_percent || 0);
  const total = Number(quotation.total || 0);
  const taxAmt = Math.max(0, total - (subtotal - discountVal));

  const summaryRows = [
    ['Subtotal:', pdfAmount(subtotal)],
    ['Discount (' + discountPct + '%):', pdfAmount(discountVal)],
    ['Tax (' + taxPct + '%):', pdfAmount(taxAmt)],
    ['Grand Total:', pdfAmount(total)],
  ];

  const sumTop = termsTop + 4;
  const sumH = 108;
  const rowH2 = sumH / 4;
  page.drawRectangle({ x: summaryX, y: sumTop - sumH, width: summaryW, height: sumH, borderColor: boxBorder, borderWidth: 1 });
  for (let i = 1; i < 4; i++) {
    const yy = sumTop - i * rowH2;
    page.drawLine({ start: { x: summaryX, y: yy }, end: { x: right, y: yy }, thickness: 1, color: boxBorder });
  }
  for (let i = 0; i < summaryRows.length; i++) {
    const yy = sumTop - i * rowH2 - 20;
    const [label, val] = summaryRows[i];
    page.drawText(label, { x: summaryX + 10, y: yy, size: 11, font: fontBold, color: textDark });
    drawRight(val, right - 8, yy, 11, fontBold);
  }

  // Bank Details + UPI/QR on quotation PDF
  const bankTop = sumTop - sumH - 18;
  const bankH = 66;
  page.drawRectangle({ x: left, y: bankTop - bankH, width: right - left, height: bankH, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: bankTop - 20 }, end: { x: right, y: bankTop - 20 }, thickness: 1, color: boxBorder });
  page.drawText('Bank Details', { x: left + (right - left) / 2 - 30, y: bankTop - 13, size: 11, font: fontBold, color: textDark });
  page.drawText('Bank: ' + asciiOnly(COMPANY_PDF.bankName), { x: left + 6, y: bankTop - 34, size: 10, font, color: textDark });
  page.drawText('Account No.: ' + asciiOnly(COMPANY_PDF.accountNumber), { x: left + 6, y: bankTop - 50, size: 10, font, color: textDark });
  page.drawText('IFSC: ' + asciiOnly(COMPANY_PDF.ifsc), { x: left + (right - left) / 2 + 6, y: bankTop - 34, size: 10, font, color: textDark });
  page.drawText('UPI: ' + asciiOnly(COMPANY_PDF.upi), { x: left + (right - left) / 2 + 6, y: bankTop - 50, size: 10, font, color: textDark });

  const upiQrImage = await loadUpiQrImage(doc, COMPANY_PDF.upiQrPath);
  const upiSectionH = 72;
  const upiTop = bankTop - bankH - 14;
  if (COMPANY_PDF.upi || COMPANY_PDF.upiName || upiQrImage) {
    page.drawRectangle({ x: left, y: upiTop - upiSectionH, width: right - left, height: upiSectionH, borderColor: boxBorder, borderWidth: 1 });
    page.drawText('UPI Payment', { x: left + (right - left) / 2 - 32, y: upiTop - 12, size: 11, font: fontBold, color: textDark });
    const qrSize = 56;
    const qrX = right - qrSize - 10;
    const qrY = upiTop - upiSectionH + 8;
    if (upiQrImage) {
      const scale = Math.min(qrSize / upiQrImage.width, qrSize / upiQrImage.height);
      page.drawImage(upiQrImage, { x: qrX, y: qrY, width: upiQrImage.width * scale, height: upiQrImage.height * scale });
    }
    const upiName = asciiOnly(COMPANY_PDF.upiName || COMPANY_PDF.name || '');
    const upiId = asciiOnly(COMPANY_PDF.upi || '');
    if (upiName) page.drawText(upiName, { x: left + 6, y: upiTop - 32, size: 10, font: fontBold, color: textDark });
    if (upiId) page.drawText('UPI ID: ' + upiId, { x: left + 6, y: upiTop - 48, size: 9.5, font, color: textDark });
    page.drawText('Scan this QR code using any UPI app to make payment.', { x: left + 6, y: upiTop - 62, size: 8, font, color: textDark });
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}



function amountInWords(n) {
  const num = Math.floor(Number(n) || 0);
  if (num === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  function toWords(x) {
    if (x === 0) return '';
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + toWords(x % 100) : '');
    if (x < 100000) return toWords(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + toWords(x % 1000) : '');
    if (x < 10000000) return toWords(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + toWords(x % 100000) : '');
    return toWords(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + toWords(x % 10000000) : '');
  }
  return 'Rupees ' + toWords(num) + ' Only';
}

function formatInvoicePdfDate(v) {
  if (v == null || v === '') return '-';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    const s = String(v).slice(0, 10);
    return s;
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function invoicePaymentModeLabel(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'bank') return 'Bank Transfer';
  if (m === 'upi') return 'UPI';
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  return asciiOnly(String(mode || '-'));
}

function htmlEscape(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlRupeeAmount(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return '₹0.00';
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `₹${withCommas}.${decPart || '00'}`;
  return neg ? `-${body}` : body;
}

function guessImageMime(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  if (e === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function buildLogoImgHtml() {
  try {
    const baseDir = path.join(__dirname, '..', '..');
    const candidates = [
      path.join(baseDir, 'client', 'public', 'logo.png'),
      path.join(baseDir, 'client', 'public', 'logo.jpg'),
      path.join(baseDir, 'client', 'public', 'logo.jpeg'),
      path.join(baseDir, 'client', 'public', 'Vision_JPG_Logo.png'),
      path.join(baseDir, 'client', 'public', 'Vision JPG Logo.JPG'),
    ];

    const logoPath = candidates.find((p) => p && fs.existsSync(p));
    const alt = 'Logo';

    if (logoPath) {
      const buf = fs.readFileSync(logoPath);
      const ext = path.extname(logoPath);
      const mime = guessImageMime(ext);
      const b64 = buf.toString('base64');
      return `<img class="logo" src="data:${mime};base64,${b64}" alt="${alt}">`;
    }

    // Always show a clean placeholder logo if none is configured
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">` +
      `<rect x="6" y="6" width="148" height="148" rx="18" fill="#2E5BFF"/>` +
      `<text x="80" y="92" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#ffffff">LOGO</text>` +
      `</svg>`;
    const b64 = Buffer.from(svg, 'utf8').toString('base64');
    return `<img class="logo" src="data:image/svg+xml;base64,${b64}" alt="${alt}">`;
  } catch (_) {
    return '';
  }
}

function htmlNumberFormatted(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return '0.00';
  const fixed = Math.abs(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${withCommas}.${decPart || '00'}`;
}

function splitInvoiceItemDescription(desc) {
  const d = String(desc || '').trim();
  if (!d) return { title: '-', detail: '' };
  const n = d.indexOf('\n');
  if (n === -1) return { title: d, detail: '' };
  return { title: d.slice(0, n).trim() || '-', detail: d.slice(n + 1).trim() };
}

function twoLineAddressHtmlFromParts(parts) {
  const clean = (Array.isArray(parts) ? parts : []).map((p) => String(p || '').trim()).filter(Boolean);
  if (!clean.length) return '-';
  if (clean.length <= 2) return clean.map(htmlEscape).join('<br>');
  const mid = Math.ceil(clean.length / 2);
  const l1 = clean.slice(0, mid).join(', ');
  const l2 = clean.slice(mid).join(', ');
  return [l1, l2].filter(Boolean).map(htmlEscape).join('<br>');
}

function buildInvoiceDocHtml(template, ctx) {
  const repl = {
    INV_REF: htmlEscape(ctx.invRef),
    STATUS: htmlEscape(ctx.statusLine),
    LOGO_IMG_HTML: ctx.logoImgHtml || '',
    COMPANY_NAME: htmlEscape(ctx.companyName),
    COMPANY_ADDRESS_HTML: ctx.companyAddressHtml,
    COMPANY_PHONE: htmlEscape(ctx.companyPhone),
    COMPANY_EMAIL_LINE: ctx.companyEmailLine || '',
    COMPANY_GST_LINE: ctx.companyGstLine || '',
    BILL_TO: htmlEscape(ctx.billTo),
    INVOICE_DATE: htmlEscape(ctx.invDateStr),
    DUE_DATE: htmlEscape(ctx.dueDateStr),
    SALE_AGENT: htmlEscape(ctx.agentStr),
    ITEM_ROWS: ctx.itemRowsHtml,
    SUB_TOTAL: htmlRupeeAmount(ctx.subtotal),
    DISCOUNT_LINE: ctx.discountLineHtml,
    ADJUSTMENT: htmlRupeeAmount(ctx.adjustment),
    TOTAL: htmlRupeeAmount(ctx.total),
    TOTAL_PAID: htmlRupeeAmount(-Math.abs(ctx.paid)),
    AMOUNT_DUE: htmlRupeeAmount(ctx.due),
    TRANSACTION_ROWS: ctx.transactionRowsHtml,
    OFFLINE_PAYMENT_HTML: ctx.offlinePaymentHtml,
    BANK_DETAILS_HTML: ctx.bankDetailsHtml || '',
    TERMS_HTML: ctx.termsHtml || '',
  };
  let out = template;
  for (const [k, v] of Object.entries(repl)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function resolveChromeExecutablePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'win32') {
    const pf = process.env.PROGRAMFILES || 'C:\\\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA;
    candidates.push(
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      local ? path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe') : ''
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    );
  }

  for (const p of candidates.filter(Boolean)) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

// Reuse a single Puppeteer browser for faster PDF generation (avoids 2-3s launch per click)
let _sharedBrowserPromise = null;
async function getSharedPuppeteerBrowser(puppeteer, executablePath) {
  try {
    if (_sharedBrowserPromise) {
      const b = await _sharedBrowserPromise;
      if (b && b.isConnected && b.isConnected()) return b;
      _sharedBrowserPromise = null;
    }

    _sharedBrowserPromise = puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new',
      ...(executablePath ? { executablePath } : {}),
    });

    const browser = await _sharedBrowserPromise;

    // Best-effort cleanup on process exit (do not block shutdown)
    if (!globalThis.__vthPuppeteerCleanupBound) {
      globalThis.__vthPuppeteerCleanupBound = true;
      const cleanup = async () => {
        try {
          const b = await _sharedBrowserPromise;
          await b?.close?.();
        } catch (_) {}
        _sharedBrowserPromise = null;
      };
      process.on('exit', cleanup);
      process.on('SIGINT', () => { cleanup().finally(() => process.exit(0)); });
      process.on('SIGTERM', () => { cleanup().finally(() => process.exit(0)); });
    }

    return browser;
  } catch (_) {
    _sharedBrowserPromise = null;
    return null;
  }
}

// Pre-warm the browser once so the first PDF download is fast too
setTimeout(async () => {
  try {
    const { default: puppeteer } = await import('puppeteer');
    const executablePath = resolveChromeExecutablePath();
    await getSharedPuppeteerBrowser(puppeteer, executablePath);
  } catch (_) {
    // ignore (Puppeteer/Chrome not available)
  }
}, 0);

/**
 * Invoice PDF – HTML layout (download) matches structured invoice; falls back to pdf-lib if Puppeteer unavailable.
 */
export async function generateInvoiceDocPDF(invoice, customer = {}, items = [], payments = [], saleAgentName = '') {
  invoice = invoice || {};
  customer = customer || {};
  items = Array.isArray(items) ? items : [];
  payments = Array.isArray(payments) ? payments : [];

  const COMPANY_PDF = await getCompanySettings(invoice.branch_id || null);
  const BANK_PDF = COMPANY_PDF;

  const subtotal = Number(invoice.subtotal) || 0;
  const discountVal = Number(invoice.discount || 0);
  const taxPct = Number(invoice.tax_percent || 0);
  const total = Number(invoice.total || 0);
  const serviceCharges = Number(invoice.service_charges || 0);
  const roundOff = Number(invoice.round_off || 0);
  const adjustment = serviceCharges + roundOff;
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const due = Math.max(0, total - paid);

  let discountPctLabel = '0';
  if (invoice.discount_type === 'percent' && discountVal > 0) {
    discountPctLabel = String(discountVal);
  } else if (subtotal > 0 && discountVal > 0) {
    discountPctLabel = ((discountVal / subtotal) * 100).toFixed(2);
  }

  const invRef = String(invoice.invoice_number || `INV-${String(Number(invoice.id || 0)).padStart(6, '0')}`).trim() || '-';
  const statusLine = String(invoice.status || 'draft')
    .replace(/_/g, ' ')
    .toUpperCase();
  const billTo = customer.name || invoice.customer_name || '-';
  const invDateStr = formatInvoicePdfDate(invoice.invoice_date);
  const dueDateStr = formatInvoicePdfDate(invoice.due_date);
  const agentStr = saleAgentName || '-';

  const realItems = items.filter((it) => {
    if (!it) return false;
    const desc = String(it.description || '').trim();
    if (!desc && !Number(it.amount)) return false;
    // Keep markup in totals, but do not show as a separate row in PDF table.
    if (desc.toLowerCase() === 'markup') return false;
    return true;
  });

  const stripPlaceholderAddressParts = (parts) => {
    const bad = new Set(['city', 'state', 'zip', 'zipcode', 'zip code', 'pin', 'pincode', 'pin code']);
    return (Array.isArray(parts) ? parts : [])
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .filter((p) => !bad.has(p.toLowerCase()));
  };

  const addrPartsRawHtml = String(COMPANY_PDF.address || '').split(/[\n,]+/);
  const addrPartsCleanHtml = stripPlaceholderAddressParts(addrPartsRawHtml);
  const companyAddressHtml = twoLineAddressHtmlFromParts(addrPartsCleanHtml);

  const companyEmail = (COMPANY_PDF.email || '').trim();
  const companyEmailLine = companyEmail ? ` &nbsp;|&nbsp; ${htmlEscape(companyEmail)}` : '';
  const companyGst = (COMPANY_PDF.gst || '').trim();
  const companyGstLine = companyGst ? `<div class="muted">GST No.: ${htmlEscape(companyGst)}</div>` : '';

  let itemRowsHtml = '';
  if (!realItems.length) {
    itemRowsHtml =
      '<tr><td colspan="6" style="text-align:center;padding:20px;color:#666;">No line items</td></tr>';
  } else {
    itemRowsHtml = realItems
      .map((it, i) => {
        const qty = Number(it.quantity || 1);
        const rateVal = Number(it.rate || (qty ? Number(it.amount || 0) / qty : it.amount || 0));
        const amt = Number(it.amount || 0);
        const { title, detail } = splitInvoiceItemDescription(it.description);
        const detailHtml = detail
          ? `<span class="item-desc">${htmlEscape(detail).split(/\n/).join('<br>')}</span>`
          : '';
        return `<tr>
        <td class="idx">${i + 1}</td>
        <td><span class="item-title">${htmlEscape(title)}</span>${detailHtml ? `<br>${detailHtml}` : ''}</td>
        <td class="qty">${htmlEscape(String(qty))}</td>
        <td class="rate">${htmlNumberFormatted(rateVal)}</td>
        <td class="tax">${htmlEscape(String(taxPct))}%</td>
        <td class="amt">${htmlRupeeAmount(amt)}</td>
      </tr>`;
      })
      .join('');
  }

  const discountLineHtml = `Discount (${discountPctLabel}%) ${htmlRupeeAmount(-Math.abs(discountVal))}`;

  let transactionRowsHtml = '';
  if (!payments.length) {
    transactionRowsHtml =
      '<tr><td colspan="4" style="text-align:center;padding:14px;color:#666;">No payments recorded</td></tr>';
  } else {
    transactionRowsHtml = payments
      .map((p, idx) => {
        const pid = p.id != null ? String(p.id) : String(idx + 1);
        return `<tr>
        <td>${htmlEscape(pid)}</td>
        <td>${htmlEscape(invoicePaymentModeLabel(p.mode))}</td>
        <td>${htmlEscape(formatInvoicePdfDate(p.paid_at))}</td>
        <td class="amt">${htmlRupeeAmount(p.amount)}</td>
      </tr>`;
      })
      .join('');
  }

  const offlinePaymentHtml = [
    htmlEscape(BANK_PDF.bankName || 'Bank Transfer'),
    'Account Type: Current',
    `Account Number: ${htmlEscape(BANK_PDF.accountNumber || '-')}`,
    `Account Holder Name: ${htmlEscape(COMPANY_PDF.name || '-')}`,
    `IFSC Code: ${htmlEscape(BANK_PDF.ifsc || '-')}`,
  ].join('<br>');

  const bankRows = [
    ['Bank Name', BANK_PDF.bankName || '-'],
    ['Branch', BANK_PDF.bankBranch || '-'],
    ['Account Number', BANK_PDF.accountNumber || '-'],
    ['IFSC', BANK_PDF.ifsc || '-'],
    ['UPI Name', BANK_PDF.upiName || '-'],
    ['UPI ID', BANK_PDF.upi || '-'],
  ];
  const bankDetailsHtml =
    `<table class="bank-table">` +
    bankRows
      .filter(([, v]) => String(v || '').trim() && String(v).trim() !== '-')
      .map(([k, v]) => `<tr><td class="lbl">${htmlEscape(k)}</td><td>${htmlEscape(v)}</td></tr>`)
      .join('') +
    `</table>`;

  const termsSource =
    invoice?.terms_text ??
    invoice?.terms ??
    invoice?.terms_and_conditions ??
    invoice?.termsConditions ??
    '';
  const manualTerms = String(termsSource || '')
    .split(/\r?\n/)
    .map((s) => htmlEscape(String(s || '').trim()))
    .filter(Boolean);
  const termsArr = manualTerms.length ? manualTerms : (Array.isArray(TERMS_PDF) ? TERMS_PDF.map(htmlEscape) : [htmlEscape(String(TERMS_PDF || ''))]);
  const termsHtml =
    `<ol class="terms-list">` +
    termsArr.map((t) => `<li>${t}</li>`).join('') +
    `</ol>`;

  // Terms for pdf-lib fallback (keep as plain text, not HTML-escaped)
  const manualTermsPdf = String(termsSource || '')
    .split(/\r?\n/)
    .map((s) => asciiOnly(String(s || '').trim()))
    .filter(Boolean);
  const termsArrPdf = manualTermsPdf.length
    ? manualTermsPdf
    : (Array.isArray(TERMS_PDF) ? TERMS_PDF.map((s) => asciiOnly(String(s))) : [asciiOnly(String(TERMS_PDF || ''))]);

  const logoImgHtml = buildLogoImgHtml();

  const invoiceTemplatePath = path.join(__dirname, '..', 'templates', 'invoice_doc.html');
  let htmlOut = '';
  if (fs.existsSync(invoiceTemplatePath)) {
    const tpl = fs.readFileSync(invoiceTemplatePath, 'utf8');
    htmlOut = buildInvoiceDocHtml(tpl, {
      invRef,
      statusLine,
      logoImgHtml,
      companyName: COMPANY_PDF.name || 'Company',
      companyAddressHtml,
      companyPhone: COMPANY_PDF.phone || '-',
      companyEmailLine,
      companyGstLine,
      billTo,
      invDateStr,
      dueDateStr,
      agentStr,
      itemRowsHtml,
      subtotal,
      discountLineHtml,
      adjustment,
      total,
      paid,
      due,
      transactionRowsHtml,
      offlinePaymentHtml,
      bankDetailsHtml,
      termsHtml,
    });
  }

  try {
    if (htmlOut) {
      const { default: puppeteer } = await import('puppeteer');
      const executablePath = resolveChromeExecutablePath();
      const browser = await getSharedPuppeteerBrowser(puppeteer, executablePath);
      if (!browser) throw new Error('Puppeteer browser unavailable');
      try {
        const page = await browser.newPage();
        await page.setContent(htmlOut, { waitUntil: 'load', timeout: 60000 });
        await page.emulateMediaType('screen');
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10px', right: '14px', bottom: '38px', left: '14px' },
          displayHeaderFooter: true,
          footerTemplate:
            '<div style="width:100%;font-size:11px;color:#777;font-family:Arial,sans-serif;text-align:center;padding-bottom:10px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        });
        await page.close();
        return Buffer.from(pdfBuffer);
      } catch (e) {
        // If the shared browser crashed, reset so next request relaunches
        _sharedBrowserPromise = null;
        if (process.env.NODE_ENV !== 'production') {
          console.error('Invoice HTML PDF page error:', e?.message || e);
        }
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Invoice HTML PDF failed:', e?.message || e);
      if (e?.stack) console.error(e.stack);
    }
  }

  const invNo = asciiOnly(invRef);
  const billName = asciiOnly(billTo);
  const agentStrPdf = asciiOnly(agentStr);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const left = margin;
  const right = pageWidth - margin;
  const boxBorder = rgb(0.72, 0.72, 0.72);
  const textDark = rgb(0.1, 0.1, 0.1);
  const footerY = 34;
  const minY = 72;

  const colNum = left + 8;
  const colItemL = left + 28;
  const colItemR = left + 268;
  const colQty = left + 278;
  const colRateR = left + 330;
  const colTaxR = left + 382;
  const colAmtR = right - 8;
  const itemColW = colItemR - colItemL;

  const wrapItemDesc = (text, size = 9) => {
    const words = asciiOnly(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= itemColW) cur = test;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : ['-'];
  };

  const drawRightOn = (pg, t, x, yPos, s = 10, f = font) => {
    const safe = asciiOnly(t);
    const w = f.widthOfTextAtSize(safe, s);
    pg.drawText(safe, { x: x - w, y: yPos, size: s, font: f, color: textDark });
  };

  const drawTableHeader = (pg, yTop) => {
    const h = 22;
    pg.drawRectangle({ x: left, y: yTop - h, width: right - left, height: h, borderColor: boxBorder, borderWidth: 1 });
    pg.drawLine({ start: { x: colItemL - 20, y: yTop }, end: { x: colItemL - 20, y: yTop - h }, thickness: 1, color: boxBorder });
    pg.drawLine({ start: { x: colQty - 6, y: yTop }, end: { x: colQty - 6, y: yTop - h }, thickness: 1, color: boxBorder });
    pg.drawLine({ start: { x: colRateR + 8, y: yTop }, end: { x: colRateR + 8, y: yTop - h }, thickness: 1, color: boxBorder });
    pg.drawLine({ start: { x: colTaxR + 8, y: yTop }, end: { x: colTaxR + 8, y: yTop - h }, thickness: 1, color: boxBorder });
    pg.drawText('#', { x: colNum, y: yTop - 15, size: 9, font: fontBold, color: textDark });
    pg.drawText('Item', { x: colItemL, y: yTop - 15, size: 9, font: fontBold, color: textDark });
    pg.drawText('Qty', { x: colQty, y: yTop - 15, size: 9, font: fontBold, color: textDark });
    drawRightOn(pg, 'Rate', colRateR, yTop - 15, 9, fontBold);
    drawRightOn(pg, 'Tax', colTaxR, yTop - 15, 9, fontBold);
    drawRightOn(pg, 'Amount', colAmtR, yTop - 15, 9, fontBold);
    return yTop - h;
  };

  const totalsBlockH = 88;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 56;

  page.drawText('INVOICE', { x: left, y, size: 26, font: fontBold, color: textDark });
  y -= 28;
  page.drawText('# ' + invNo, { x: left, y, size: 11, font: fontBold, color: textDark });
  y -= 16;
  page.drawText(statusLine, { x: left, y, size: 10, font: fontBold, color: textDark });
  y -= 20;

  page.drawText(asciiOnly(COMPANY_PDF.name || 'Company'), { x: left, y, size: 10, font: fontBold, color: textDark });
  y -= 14;
  const addrParts = asciiOnly(COMPANY_PDF.address || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !['city', 'state', 'zip', 'zipcode', 'zip code', 'pin', 'pincode', 'pin code'].includes(String(p).toLowerCase()));
  const addrLine = addrParts.length ? addrParts.join(', ') : '-';
  const addrFontSize = 9;
  const addrMaxW = right - left;
  const addrWords = asciiOnly(addrLine).split(/\s+/).filter(Boolean);
  const addrLines = [];
  let cur = '';
  for (const w of addrWords) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, addrFontSize) <= addrMaxW) cur = test;
    else {
      if (cur) addrLines.push(cur);
      cur = w;
      if (addrLines.length >= 2) break;
    }
  }
  if (cur && addrLines.length < 2) addrLines.push(cur);
  const addrToDraw = addrLines.length ? addrLines.slice(0, 2) : ['-'];
  addrToDraw.forEach((ln) => {
    page.drawText(ln, { x: left, y, size: addrFontSize, font, color: textDark });
    y -= 12;
  });
  page.drawText(asciiOnly(COMPANY_PDF.phone || '-'), { x: left, y, size: 9, font, color: textDark });
  y -= 12;
  if (COMPANY_PDF.email) {
    page.drawText(asciiOnly(COMPANY_PDF.email), { x: left, y, size: 9, font, color: textDark });
    y -= 12;
  }
  if (COMPANY_PDF.gst) {
    page.drawText('GST No.: ' + asciiOnly(COMPANY_PDF.gst), { x: left, y, size: 9, font, color: textDark });
    y -= 12;
  }
  y -= 22;

  const mid = left + (right - left) * 0.48;
  page.drawText('Bill To:', { x: left, y, size: 9, font: fontBold, color: textDark });
  page.drawText(billName, { x: left, y: y - 14, size: 10, font: fontBold, color: textDark });
  page.drawText('Invoice Date: ' + invDateStr, { x: mid, y, size: 9, font, color: textDark });
  page.drawText('Due Date: ' + dueDateStr, { x: mid, y: y - 14, size: 9, font, color: textDark });
  page.drawText('Sale Agent: ' + agentStrPdf, { x: mid, y: y - 28, size: 9, font, color: textDark });
  y -= 48;

  y -= 8;
  y = drawTableHeader(page, y);
  const lineGap = 11;
  const padRow = 6;

  const drawRowLine = (pg, yLine) => {
    pg.drawLine({ start: { x: left, y: yLine }, end: { x: right, y: yLine }, thickness: 1, color: boxBorder });
  };

  for (let i = 0; i < realItems.length; i++) {
    const it = realItems[i];
    const qty = Number(it.quantity || 1);
    const rateVal = Number(it.rate || (qty ? Number(it.amount || 0) / qty : it.amount || 0));
    const amt = Number(it.amount || 0);
    const descLines = wrapItemDesc(it.description || '');
    const rowH = Math.max(22, descLines.length * lineGap + padRow * 2);

    if (y - rowH < minY + totalsBlockH) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
      y = drawTableHeader(page, y);
    }

    const yRowTop = y;
    y -= padRow;
    page.drawText(String(i + 1), { x: colNum, y: y - lineGap + 4, size: 9, font, color: textDark });
    descLines.forEach((ln, li) => {
      page.drawText(ln.substring(0, 120), { x: colItemL, y: y - li * lineGap, size: 9, font, color: textDark });
    });
    page.drawText(String(qty), { x: colQty, y: y - lineGap + 4, size: 9, font, color: textDark });
    drawRightOn(page, pdfAmount(rateVal), colRateR, y - lineGap + 4, 9, font);
    drawRightOn(page, `${taxPct}%`, colTaxR, y - lineGap + 4, 9, font);
    drawRightOn(page, pdfAmount(amt), colAmtR, y - lineGap + 4, 9, font);
    y = yRowTop - rowH;
    drawRowLine(page, y);
  }

  if (y < minY + totalsBlockH + 20) {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 100;
  }

  y -= 12;
  drawRightOn(page, 'Sub Total ' + pdfAmount(subtotal), colAmtR, y, 10, fontBold);
  y -= 16;
  drawRightOn(
    page,
    `Discount (${discountPctLabel}%) ` + pdfAmount(-Math.abs(discountVal)),
    colAmtR,
    y,
    10,
    fontBold
  );
  y -= 16;
  drawRightOn(page, 'Adjustment ' + pdfAmount(adjustment), colAmtR, y, 10, fontBold);
  y -= 18;
  drawRightOn(page, 'Total ' + pdfAmount(total), colAmtR, y, 11, fontBold);

  page = doc.addPage([pageWidth, pageHeight]);
  y = pageHeight - 72;
  drawRightOn(page, 'Total Paid ' + pdfAmount(-Math.abs(paid)), colAmtR, y, 11, fontBold);
  y -= 20;
  drawRightOn(page, 'Amount Due ' + pdfAmount(due), colAmtR, y, 11, fontBold);
  y -= 28;
  page.drawText('Transactions:', { x: left, y, size: 10, font: fontBold, color: textDark });
  y -= 18;

  const th = 20;
  page.drawRectangle({ x: left, y: y - th, width: right - left, height: th, borderColor: boxBorder, borderWidth: 1 });
  const c1 = left + 8;
  const c2 = left + 88;
  const c3 = left + 220;
  const c4 = right - 8;
  page.drawLine({ start: { x: c2 - 6, y }, end: { x: c2 - 6, y: y - th }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: c3 - 6, y }, end: { x: c3 - 6, y: y - th }, thickness: 1, color: boxBorder });
  page.drawText('Payment #', { x: c1, y: y - 14, size: 9, font: fontBold, color: textDark });
  page.drawText('Payment Mode', { x: c2, y: y - 14, size: 9, font: fontBold, color: textDark });
  page.drawText('Date', { x: c3, y: y - 14, size: 9, font: fontBold, color: textDark });
  drawRightOn(page, 'Amount', c4, y - 14, 9, fontBold);
  y -= th;

  payments.forEach((p, idx) => {
    if (y < minY + 120) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 72;
    }
    const rh = 18;
    page.drawLine({ start: { x: left, y: y }, end: { x: right, y: y }, thickness: 1, color: boxBorder });
    page.drawText(String(p.id || idx + 1), { x: c1, y: y - 13, size: 9, font, color: textDark });
    page.drawText(invoicePaymentModeLabel(p.mode), { x: c2, y: y - 13, size: 9, font, color: textDark });
    page.drawText(formatInvoicePdfDate(p.paid_at), { x: c3, y: y - 13, size: 9, font, color: textDark });
    drawRightOn(page, pdfAmount(p.amount), c4, y - 13, 9, font);
    y -= rh;
  });
  page.drawLine({ start: { x: left, y: y }, end: { x: right, y: y }, thickness: 1, color: boxBorder });

  y -= 24;
  page.drawText('Offline Payment:', { x: left, y, size: 10, font: fontBold, color: textDark });
  y -= 16;
  page.drawText(asciiOnly(BANK_PDF.bankName || 'Bank Transfer'), { x: left, y, size: 9, font, color: textDark });
  y -= 14;
  page.drawText('Account Type: Current', { x: left, y, size: 9, font, color: textDark });
  y -= 14;
  page.drawText('Account Number: ' + asciiOnly(BANK_PDF.accountNumber || '-'), { x: left, y, size: 9, font, color: textDark });
  y -= 14;
  page.drawText('Account Holder Name: ' + asciiOnly(COMPANY_PDF.name || '-'), { x: left, y, size: 9, font, color: textDark });
  y -= 14;
  page.drawText('IFSC Code: ' + asciiOnly(BANK_PDF.ifsc || '-'), { x: left, y, size: 9, font, color: textDark });
  y -= 14;
  if (BANK_PDF.bankBranch) {
    page.drawText('Branch: ' + asciiOnly(BANK_PDF.bankBranch), { x: left, y, size: 9, font, color: textDark });
    y -= 14;
  }
  if (BANK_PDF.upiName) {
    page.drawText('UPI Name: ' + asciiOnly(BANK_PDF.upiName), { x: left, y, size: 9, font, color: textDark });
    y -= 14;
  }
  if (BANK_PDF.upi) {
    page.drawText('UPI ID: ' + asciiOnly(BANK_PDF.upi), { x: left, y, size: 9, font, color: textDark });
    y -= 14;
  }

  y -= 10;
  page.drawText('Terms & Conditions:', { x: left, y, size: 10, font: fontBold, color: textDark });
  y -= 14;

  const termsFontSize = 8.8;
  const termsLineH = 12;
  const termsMaxW = right - left - 10;
  const wrapTerms = (text) => {
    const words = asciiOnly(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, termsFontSize) <= termsMaxW) cur = test;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : ['-'];
  };

  for (let i = 0; i < (termsArrPdf || []).length; i++) {
    if (y < minY + 40) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 72;
    }
    const prefix = `${i + 1}. `;
    const wrapped = wrapTerms(termsArrPdf[i]);
    for (let wi = 0; wi < wrapped.length; wi++) {
      if (y < minY + 40) break;
      const line = (wi === 0 ? prefix : '   ') + wrapped[wi];
      page.drawText(line, { x: left + 4, y, size: termsFontSize, font, color: textDark });
      y -= termsLineH;
    }
    y -= 2;
  }

  y -= 18;
  page.drawText('Authorized Signature', { x: left, y, size: 10, font: fontBold, color: textDark });
  page.drawLine({ start: { x: left, y: y - 4 }, end: { x: left + 160, y: y - 4 }, thickness: 0.5, color: textDark });

  const allPages = doc.getPages();
  const totalP = allPages.length;
  allPages.forEach((pg, idx) => {
    const foot = `-- ${idx + 1} of ${totalP} --`;
    const fw = font.widthOfTextAtSize(foot, 9);
    pg.drawText(foot, { x: (pageWidth - fw) / 2, y: footerY, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate Payment Slip PDF – clean receipt style matching project PDF theme
 */
export async function generatePaymentSlipPDF(payment) {
  payment = payment || {};

  const COMPANY_PDF = await getCompanySettings();

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const left = margin;
  const right = pageWidth - margin;
  const contentW = right - left;
  const teal = rgb(0.05, 0.59, 0.53);
  const tealDark = rgb(0.02, 0.44, 0.39);
  const textDark = rgb(0.12, 0.12, 0.12);
  const textGrey = rgb(0.45, 0.45, 0.45);
  const white = rgb(1, 1, 1);
  const lineGrey = rgb(0.82, 0.82, 0.82);

  // Helper: right-align text ending at x
  const drawRight = (t, x, yPos, s = 10, f = fontBold) => {
    const safe = asciiOnly(t);
    const w = f.widthOfTextAtSize(safe, s);
    page.drawText(safe, { x: x - w, y: yPos, size: s, font: f, color: textDark });
  };

  // ── Logo (top-right) ──────────────────────────────────────────
  let logoImage = null;
  try {
    const baseDir = path.join(__dirname, '..', '..');
    const pngPath = path.join(baseDir, 'client', 'public', 'Vision_JPG_Logo.png');
    const jpgPath = path.join(baseDir, 'client', 'public', 'Vision JPG Logo.JPG');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      try { logoImage = await doc.embedPng(buf); } catch (_) { logoImage = await doc.embedJpg(buf); }
    } else if (fs.existsSync(jpgPath)) {
      logoImage = await doc.embedJpg(fs.readFileSync(jpgPath));
    }
  } catch (_) { logoImage = null; }

  const logoSize = 76;
  const logoCX = right - 40;
  const logoCY = pageHeight - 78;
  if (logoImage) {
    const fitScale = Math.min(logoSize / logoImage.width, logoSize / logoImage.height);
    const imgW = logoImage.width * fitScale;
    const imgH = logoImage.height * fitScale;
    page.drawImage(logoImage, { x: logoCX - imgW / 2, y: logoCY - imgH / 2, width: imgW, height: imgH });
  }

  // ── Company block (top-left) ──────────────────────────────────
  let y = pageHeight - 56;
  page.drawText('PAYMENT RECEIPT', { x: left, y, size: 22, font: fontBold, color: textDark });
  y -= 26;
  page.drawText(asciiOnly(COMPANY_PDF.name), { x: left, y, size: 11, font: fontBold, color: textDark });
  y -= 15;
  page.drawText(asciiOnly(COMPANY_PDF.address), { x: left, y, size: 9.5, font, color: textGrey });
  y -= 13;
  page.drawText(asciiOnly(COMPANY_PDF.phone) + '   |   ' + asciiOnly(COMPANY_PDF.email), { x: left, y, size: 9.5, font, color: textGrey });
  y -= 13;
  if (COMPANY_PDF.gst) {
    page.drawText('GST No.: ' + asciiOnly(COMPANY_PDF.gst), { x: left, y, size: 9.5, font, color: textGrey });
    y -= 10;
  }

  // ── Divider ───────────────────────────────────────────────────
  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.2, color: teal });
  y -= 22;

  // ── Receipt details box ───────────────────────────────────────
  const detailBoxH = 96;
  page.drawRectangle({ x: left, y: y - detailBoxH, width: contentW, height: detailBoxH, color: rgb(0.97, 0.99, 0.99), borderColor: lineGrey, borderWidth: 0.8 });

  const col1x = left + 14;
  const col2x = left + contentW / 2 + 10;
  const labelSize = 8.5;
  const valSize = 10;
  const rowGap = 24;

  const paidDate = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const receiptNo = String(payment.id || '-');

  // Row 1
  let dy = y - 18;
  page.drawText('Receipt No.', { x: col1x, y: dy, size: labelSize, font, color: textGrey });
  page.drawText(asciiOnly(receiptNo), { x: col1x, y: dy - 12, size: valSize, font: fontBold, color: textDark });

  page.drawText('Invoice No.', { x: col2x, y: dy, size: labelSize, font, color: textGrey });
  page.drawText(asciiOnly(payment.invoice_number || '-'), { x: col2x, y: dy - 12, size: valSize, font: fontBold, color: tealDark });

  // Row 2
  dy -= rowGap + 14;
  page.drawText('Payment Date', { x: col1x, y: dy, size: labelSize, font, color: textGrey });
  page.drawText(asciiOnly(paidDate), { x: col1x, y: dy - 12, size: valSize, font: fontBold, color: textDark });

  page.drawText('Payment Mode', { x: col2x, y: dy, size: labelSize, font, color: textGrey });
  page.drawText(asciiOnly((payment.mode || '-').toUpperCase()), { x: col2x, y: dy - 12, size: valSize, font: fontBold, color: textDark });

  y -= detailBoxH + 18;

  // ── Customer block ────────────────────────────────────────────
  page.drawText('Received From', { x: left, y, size: 8.5, font, color: textGrey });
  y -= 14;
  page.drawText(asciiOnly(payment.customer_name || '-'), { x: left, y, size: 12, font: fontBold, color: textDark });
  y -= 14;
  if (payment.customer_mobile) {
    page.drawText('Mobile: ' + asciiOnly(payment.customer_mobile), { x: left, y, size: 9.5, font, color: textGrey });
    y -= 13;
  }
  if (payment.customer_gst) {
    page.drawText('GST No.: ' + asciiOnly(payment.customer_gst), { x: left, y, size: 9.5, font, color: textGrey });
    y -= 13;
  }

  y -= 14;

  // ── Amount box ────────────────────────────────────────────────
  const amtBoxH = 72;
  page.drawRectangle({ x: left, y: y - amtBoxH, width: contentW, height: amtBoxH, color: teal });

  const amtLabel = 'AMOUNT RECEIVED';
  const amtLabelW = font.widthOfTextAtSize(amtLabel, 9);
  page.drawText(amtLabel, { x: left + contentW / 2 - amtLabelW / 2, y: y - 16, size: 9, font, color: rgb(0.85, 1, 0.98) });

  const amtStr = pdfAmount(payment.amount);
  const amtStrW = fontBold.widthOfTextAtSize(amtStr, 28);
  page.drawText(amtStr, { x: left + contentW / 2 - amtStrW / 2, y: y - 48, size: 28, font: fontBold, color: white });

  y -= amtBoxH + 24;

  // ── GST / Tax Details ─────────────────────────────────────────
  page.drawText('GST & Tax Details', { x: left, y, size: 10, font: fontBold, color: tealDark });
  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: lineGrey });
  y -= 14;

  const gstRows = [
    ['Company GST No.', payment.company_gst || COMPANY_PDF.gst || '-'],
    ['Customer GST No.', payment.customer_gst || '-'],
    ['Place of Supply', payment.place_of_supply || '-'],
  ];
  for (const [label, val] of gstRows) {
    page.drawText(asciiOnly(label), { x: left, y, size: 9.5, font, color: textGrey });
    page.drawText(asciiOnly(val), { x: left + 160, y, size: 9.5, font: fontBold, color: textDark });
    y -= 16;
  }

  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: lineGrey });
  y -= 22;

  // ── Invoice summary line ──────────────────────────────────────
  const summaryRows = [
    ['Invoice Total', pdfAmount(payment.invoice_total)],
    ['Amount Paid (this receipt)', pdfAmount(payment.amount)],
  ];
  for (const [label, val] of summaryRows) {
    page.drawText(asciiOnly(label), { x: left, y, size: 9.5, font, color: textGrey });
    drawRight(val, right, y, 9.5, fontBold);
    y -= 16;
  }

  y -= 14;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: lineGrey });
  y -= 20;

  // ── UPI Payment / QR (if configured) ──────────────────────────
  const upiQrImage = await loadUpiQrImage(doc, COMPANY_PDF.upiQrPath);
  if (COMPANY_PDF.upi || COMPANY_PDF.upiName || upiQrImage) {
    const upiBoxH = 68;
    y -= 12;
    page.drawRectangle({ x: left, y: y - upiBoxH, width: contentW, height: upiBoxH, borderColor: lineGrey, borderWidth: 0.5 });
    page.drawText('UPI Payment', { x: left, y: y - 12, size: 10, font: fontBold, color: tealDark });
    const qrSize = 52;
    const qrX = left + contentW - qrSize - 10;
    const qrY = y - upiBoxH + 8;
    if (upiQrImage) {
      const scale = Math.min(qrSize / upiQrImage.width, qrSize / upiQrImage.height);
      page.drawImage(upiQrImage, { x: qrX, y: qrY, width: upiQrImage.width * scale, height: upiQrImage.height * scale });
    }
    const textRight = upiQrImage ? qrX - 8 : right;
    const upiName = asciiOnly(COMPANY_PDF.upiName || COMPANY_PDF.name || '');
    const upiId = asciiOnly(COMPANY_PDF.upi || '');
    if (upiName) page.drawText(upiName, { x: left + 6, y: y - 30, size: 9.5, font: fontBold, color: textDark });
    if (upiId) page.drawText('UPI ID: ' + upiId, { x: left + 6, y: y - 46, size: 9, font, color: textDark });
    page.drawText('Scan this QR code using any UPI app to make payment.', { x: left + 6, y: y - 58, size: 8, font, color: textGrey });
    y -= upiBoxH + 12;
  }

  // ── Footer ────────────────────────────────────────────────────
  const footer = 'Thank you for your payment. This is a computer-generated receipt and does not require a signature.';
  // Simple word-wrap for footer
  const footerWords = footer.split(' ');
  const footerLines = [];
  let footerCur = '';
  for (const w of footerWords) {
    const test = footerCur ? footerCur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, 9) > contentW) { footerLines.push(footerCur); footerCur = w; }
    else { footerCur = test; }
  }
  if (footerCur) footerLines.push(footerCur);
  for (const line of footerLines) {
    const lw = font.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: left + contentW / 2 - lw / 2, y, size: 9, font, color: textGrey });
    y -= 13;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
