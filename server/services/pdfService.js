import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load company settings from DB, fall back to defaults if table not ready */
async function getCompanySettings() {
  try {
    const result = await pool.query('SELECT key, value FROM company_settings');
    const s = {};
    result.rows.forEach((r) => { s[r.key] = r.value || ''; });
    return {
      name:    s.company_name    || 'Vision Travel Hub',
      address: s.company_address || '1234 Street, City, State, Zip Code',
      phone:   s.company_phone   || '123-123-1234',
      email:   s.company_email   || 'yourcompany@email.com',
      gst:     s.company_gst     || '',
      bankName:   s.bank_name    || '',
      accountNumber: s.bank_account || '',
      ifsc:    s.bank_ifsc       || '',
      upi:     s.bank_upi        || '',
      bankBranch: s.bank_branch  || '',
    };
  } catch (_) {
    return {
      name: 'Vision Travel Hub', address: '1234 Street, City, State, Zip Code',
      phone: '123-123-1234', email: 'yourcompany@email.com', gst: '',
      bankName: '', accountNumber: '', ifsc: '', upi: '', bankBranch: '',
    };
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

  page.drawText('Total price (package + hotel + vehicle):', { x: left + 12, y: boxTop - 60, size: 9.5, font, color: textDark });
  page.drawText(price, { x: left + 12, y: boxTop - 76, size: 11, font: fontBold, color: textDark });

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
  if (Number.isNaN(num)) return 'Rs.0';
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs.${withCommas}${decPart ? '.' + decPart : ''}`;
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

  page.drawText('Name: ' + customerName, { x: left + 6, y: custTop - 39, size: 10, font: fontBold, color: textDark });
  page.drawText('Address: ' + (addressLines[0] || '-').trim(), { x: left + 6, y: custTop - 55, size: 10, font: fontBold, color: textDark });
  page.drawText('Email: ' + customerEmail, { x: left + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });
  page.drawText('Phone: ' + customerMobile, { x: left + (right - left) / 2 + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });

  // Item table: header + fixed rows like template
  const tableTop = custTop - custHeight - 14;
  const tableHeight = 214;
  const tableBottom = tableTop - tableHeight;
  page.drawRectangle({ x: left, y: tableBottom, width: right - left, height: tableHeight, borderColor: boxBorder, borderWidth: 1 });

  const colItem = left + 314;
  const colRate = left + 398;
  const colQty = left + 435;
  const headerH = 26;
  page.drawLine({ start: { x: left, y: tableTop - headerH }, end: { x: right, y: tableTop - headerH }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colItem, y: tableTop }, end: { x: colItem, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colRate, y: tableTop }, end: { x: colRate, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colQty, y: tableTop }, end: { x: colQty, y: tableBottom }, thickness: 1, color: boxBorder });

  page.drawText('Item Description', { x: left + 110, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Unit Price', { x: colItem + 16, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Qty', { x: colRate + 8, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Total', { x: colQty + 24, y: tableTop - 18, size: 11, font: fontBold, color: textDark });

  const rowCount = 7;
  const bodyTop = tableTop - headerH;
  const rowH = (tableHeight - headerH) / rowCount;
  for (let i = 1; i < rowCount; i++) {
    const yy = bodyTop - i * rowH;
    page.drawLine({ start: { x: left, y: yy }, end: { x: right, y: yy }, thickness: 1, color: boxBorder });
  }

  for (let i = 0; i < rowCount; i++) {
    const it = items[i];
    const yRow = bodyTop - i * rowH - 15;
    const rateRight = colRate - 6;
    const totalRight = right - 6;
    if (!it) {
      drawRight(pdfAmount(0), totalRight, yRow, 9.5, font);
      continue;
    }
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

/**
 * Invoice PDF – same structure/layout as quotation PDF
 */
export async function generateInvoiceDocPDF(invoice, customer = {}, items = [], payments = []) {
  invoice = invoice || {};
  customer = customer || {};
  items = Array.isArray(items) ? items : [];

  const COMPANY_PDF = await getCompanySettings();
  const BANK_PDF = COMPANY_PDF;

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

  // Logo (same as quotation)
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

  // Title + company block (aligned with quotation)
  page.drawText('INVOICE', { x: left, y, size: 28, font: fontBold, color: textDark });
  y -= 34;
  page.drawText(asciiOnly(COMPANY_PDF.name || 'YOUR COMPANY'), { x: left, y, size: 11, font: fontBold, color: textDark });
  y -= 16;
  page.drawText(asciiOnly(COMPANY_PDF.address), { x: left, y, size: 9.5, font, color: textDark });
  y -= 13;
  page.drawText(asciiOnly(COMPANY_PDF.phone), { x: left, y, size: 9.5, font, color: textDark });
  y -= 13;
  page.drawText(asciiOnly(COMPANY_PDF.email), { x: left, y, size: 9.5, font, color: textDark });

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

  // Info box – same geometry as quotation
  const infoTop = pageHeight - 230;
  const infoHeight = 38;
  page.drawRectangle({ x: left, y: infoTop - infoHeight, width: right - left, height: infoHeight, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: infoTop - 19 }, end: { x: right, y: infoTop - 19 }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: left + (right - left) / 2, y: infoTop }, end: { x: left + (right - left) / 2, y: infoTop - infoHeight }, thickness: 1, color: boxBorder });

  const invNo = asciiOnly(invoice.invoice_number || ('INV-' + String(Number(invoice.id || 0)).padStart(6, '0')));
  const invDate = toPdfText(invoice.invoice_date);
  const dueDate = invoice.due_date != null
    ? (invoice.due_date instanceof Date ? invoice.due_date.toISOString().slice(0, 10) : String(invoice.due_date).slice(0, 10))
    : '-';

  page.drawText('Invoice No.: ' + invNo, { x: left + 6, y: infoTop - 13, size: 10, font: fontBold, color: textDark });
  page.drawText('Invoice Date: ' + invDate, { x: left + (right - left) / 2 + 6, y: infoTop - 13, size: 10, font: fontBold, color: textDark });
  page.drawText('GST No.: ' + asciiOnly(invoice.company_gst || COMPANY_PDF.gst || '-'), { x: left + 6, y: infoTop - 32, size: 10, font: fontBold, color: textDark });
  page.drawText('Due Date: ' + dueDate, { x: left + (right - left) / 2 + 6, y: infoTop - 32, size: 10, font: fontBold, color: textDark });

  // Customer details – same block as quotation
  const custTop = infoTop - 54;
  const custHeight = 74;
  page.drawRectangle({ x: left, y: custTop - custHeight, width: right - left, height: custHeight, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: custTop - 25 }, end: { x: right, y: custTop - 25 }, thickness: 1, color: boxBorder });
  page.drawText('Customer Details', { x: left + (right - left) / 2 - 45, y: custTop - 17, size: 11, font: fontBold, color: textDark });

  const customerName = asciiOnly(customer.name || invoice.customer_name || '-');
  const customerEmail = asciiOnly(customer.email || '-');
  const customerMobile = asciiOnly(customer.mobile || '-');
  const addressText = asciiOnly(customer.address || invoice.billing_address || '-');
  const addressLines = addressText.match(/.{1,48}(\s|$)/g) || [addressText];

  page.drawText('Name: ' + customerName, { x: left + 6, y: custTop - 39, size: 10, font: fontBold, color: textDark });
  page.drawText('Address: ' + (addressLines[0] || '-').trim(), { x: left + 6, y: custTop - 55, size: 10, font: fontBold, color: textDark });
  page.drawText('Email: ' + customerEmail, { x: left + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });
  page.drawText('Phone: ' + customerMobile, { x: left + (right - left) / 2 + 6, y: custTop - 71, size: 10, font: fontBold, color: textDark });

  // Items table – same structure/lines as quotation
  const tableTop = custTop - custHeight - 14;
  const tableHeight = 214;
  const tableBottom = tableTop - tableHeight;
  page.drawRectangle({ x: left, y: tableBottom, width: right - left, height: tableHeight, borderColor: boxBorder, borderWidth: 1 });

  const colItem = left + 314;
  const colRate = left + 398;
  const colQty = left + 435;
  const headerH = 26;
  page.drawLine({ start: { x: left, y: tableTop - headerH }, end: { x: right, y: tableTop - headerH }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colItem, y: tableTop }, end: { x: colItem, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colRate, y: tableTop }, end: { x: colRate, y: tableBottom }, thickness: 1, color: boxBorder });
  page.drawLine({ start: { x: colQty, y: tableTop }, end: { x: colQty, y: tableBottom }, thickness: 1, color: boxBorder });

  page.drawText('Item Description', { x: left + 110, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Unit Price', { x: colItem + 16, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Qty', { x: colRate + 8, y: tableTop - 18, size: 11, font: fontBold, color: textDark });
  page.drawText('Total', { x: colQty + 24, y: tableTop - 18, size: 11, font: fontBold, color: textDark });

  const bodyTop = tableTop - headerH;
  const rateRight = colRate - 6;
  const totalRight = right - 6;
  const fixedRowH = 26;
  const realItems = items.filter((it) => it && (asciiOnly(it.description || '').replace(/-/g, '').trim() || Number(it.amount)));
  realItems.forEach((it, i) => {
    page.drawLine({ start: { x: left, y: bodyTop - (i + 1) * fixedRowH }, end: { x: right, y: bodyTop - (i + 1) * fixedRowH }, thickness: 1, color: boxBorder });
    const yRow = bodyTop - i * fixedRowH - 16;
    const qty = Number(it.quantity || 1);
    const rateVal = Number(it.rate || (qty ? Number(it.amount || 0) / qty : it.amount || 0));
    const amt = Number(it.amount || 0);
    const desc = asciiOnly(it.description || '').substring(0, 55);
    page.drawText(desc, { x: left + 6, y: yRow, size: 9.5, font, color: textDark });
    drawRight(pdfAmount(rateVal), rateRight, yRow, 9.5, font);
    page.drawText(String(qty), { x: colRate + 14, y: yRow, size: 9.5, font, color: textDark });
    drawRight(pdfAmount(amt), totalRight, yRow, 9.5, font);
  });

  // Terms + summary – same layout as quotation
  const termsTop = tableBottom - 16;
  const summaryW = 176;
  const summaryX = right - summaryW;

  page.drawText('Terms and Conditions:', { x: left + 2, y: termsTop, size: 11, font: fontBold, color: textDark });
  const manualTerms = String(invoice.terms_text || '')
    .split(/\r?\n/)
    .map((s) => asciiOnly(s).trim())
    .filter(Boolean);
  const termsArr = manualTerms.length ? manualTerms : (Array.isArray(TERMS_PDF) ? TERMS_PDF : [TERMS_PDF]);

  // Word-wrap each term line to fit within the left column (left of the summary box).
  const termsMaxW = (summaryX - left - 14);
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
  termsArr.slice(0, 8).forEach((line, idx) => {
    const prefix = `${idx + 1}. `;
    const prefixW = font.widthOfTextAtSize(prefix, termFontSize);
    const wrapped = wrapTermLine(asciiOnly(line));
    wrapped.forEach((wl, wi) => {
      if (ty < 80) return;
      const drawX = wi === 0 ? left + 2 : left + 2 + prefixW;
      const drawTxt = wi === 0 ? prefix + wl : wl;
      page.drawText(drawTxt, { x: drawX, y: ty, size: termFontSize, font, color: textDark });
      ty -= termLineH;
    });
    ty -= 2;
  });

  const subtotal = Number(invoice.subtotal) || 0;
  const discountVal = Number(invoice.discount || 0);
  const discountPct = subtotal > 0 ? Math.round((discountVal / subtotal) * 100) : 0;
  const taxPct = Number(invoice.tax_percent || 0);
  const total = Number(invoice.total || 0);
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

  // Bank Details box
  const bankTop = sumTop - sumH - 18;
  const bankH = 66;
  page.drawRectangle({ x: left, y: bankTop - bankH, width: right - left, height: bankH, borderColor: boxBorder, borderWidth: 1 });
  page.drawLine({ start: { x: left, y: bankTop - 20 }, end: { x: right, y: bankTop - 20 }, thickness: 1, color: boxBorder });
  page.drawText('Bank Details', { x: left + (right - left) / 2 - 30, y: bankTop - 13, size: 11, font: fontBold, color: textDark });
  page.drawText('Bank: ' + asciiOnly(BANK_PDF.bankName), { x: left + 6, y: bankTop - 34, size: 10, font, color: textDark });
  page.drawText('Account No.: ' + asciiOnly(BANK_PDF.accountNumber), { x: left + 6, y: bankTop - 50, size: 10, font, color: textDark });
  page.drawText('IFSC: ' + asciiOnly(BANK_PDF.ifsc), { x: left + (right - left) / 2 + 6, y: bankTop - 34, size: 10, font, color: textDark });
  page.drawText('UPI: ' + asciiOnly(BANK_PDF.upi), { x: left + (right - left) / 2 + 6, y: bankTop - 50, size: 10, font, color: textDark });


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
