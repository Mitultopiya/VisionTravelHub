import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'vth_rate_calculator_preview';

export default function RateCalculatorPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const isStaffRoute = location.pathname.startsWith('/staff/');
  const calculatorBase = isStaffRoute ? '/staff/rate-calculator' : '/admin/rate-calculator';
  const handleEdit = () => navigate(`${calculatorBase}?edit=1`);

  const previewText = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }, []);

  const handleCopy = async () => {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadPdf = () => {
    if (!previewText) return;
    const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = previewText.split('\n');
    let inList = false;
    const rendered = lines.map((raw) => {
      const line = escapeHtml(raw);
      if (!line.trim()) {
        if (inList) {
          inList = false;
          return '</ul><div class="spacer"></div>';
        }
        return '<div class="spacer"></div>';
      }
      if (/^=+$/.test(line.trim())) return '';
      if (line.includes('PRICE SUMMARY:')) {
        if (inList) inList = false;
        return '<h2 class="section-title">Price Summary</h2><div class="summary-box">';
      }
      if (/^[^\-].*:$/.test(line.trim())) {
        if (inList) {
          inList = false;
          return `</ul><h2 class="section-title">${line.replace(/:$/, '')}</h2>`;
        }
        return `<h2 class="section-title">${line.replace(/:$/, '')}</h2>`;
      }
      if (line.trim().startsWith('- ')) {
        const content = line.trim().slice(2);
        const isGrandTotal = content.toUpperCase().includes('GRAND TOTAL');
        if (isGrandTotal) {
          if (inList) {
            inList = false;
            return `</ul><div class="grand-total-wrap"><div class="grand-total-line">${content}</div></div>`;
          }
          return `<div class="grand-total-wrap"><div class="grand-total-line">${content}</div></div>`;
        }
        if (!inList) {
          inList = true;
          return `<ul class="list"><li>${content}</li>`;
        }
        return `<li>${content}</li>`;
      }
      if (inList) {
        inList = false;
        return `</ul><p class="line">${line}</p>`;
      }
      const isMoneyLine = line.includes('Rs.');
      return `<p class="line${isMoneyLine ? ' money-line' : ''}">${line}</p>`;
    }).join('');
    let renderedHtml = inList ? `${rendered}</ul>` : rendered;
    renderedHtml = renderedHtml.replace('<div class="summary-box"></ul>', '<div class="summary-box">');
    if (renderedHtml.includes('<div class="summary-box">') && !renderedHtml.includes('</div>')) {
      renderedHtml += '</div>';
    } else {
      renderedHtml = renderedHtml.replace(/(<div class="summary-box">[\s\S]*?)$/, '$1</div>');
    }

    const html = `
      <html>
        <head>
          <title>Package Info</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              line-height: 1.5;
              color: #0f172a;
              margin: 0;
              background: #ffffff;
              display: flex;
              justify-content: center;
            }
            .sheet {
              border: 1px solid #dbe2ea;
              border-radius: 10px;
              width: 100%;
              max-width: 780px;
            }
            .header {
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              border-bottom: 2px solid #0f766e;
              padding: 14px 16px 12px;
              background: #f8fafc;
            }
            .title {
              font-size: 22px;
              font-weight: 700;
              margin: 0;
              color: #0f172a;
            }
            .subtitle {
              font-size: 12px;
              color: #334155;
              margin-top: 4px;
            }
            .meta {
              font-size: 11px;
              color: #64748b;
              text-align: right;
            }
            .content { padding: 14px 16px; background: #fff; }
            .section-title {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #0f766e;
              margin: 16px 0 8px;
              border-left: 3px solid #0f766e;
              padding: 2px 0 2px 8px;
              font-weight: 700;
            }
            .line { margin: 0 0 6px; font-size: 12px; color: #1e293b; }
            .money-line { font-weight: 600; }
            .list { margin: 0 0 10px 18px; padding: 0; }
            .list li { margin: 0 0 5px; font-size: 12px; }
            .spacer { height: 6px; }
            .summary-box {
              margin-top: 8px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 12px;
              background: #f8fafc;
              overflow: hidden;
              box-sizing: border-box;
            }
            .grand-total-wrap {
              margin-top: 10px;
              width: 100%;
              box-sizing: border-box;
            }
            .grand-total-line {
              width: 100%;
              background: linear-gradient(90deg, #0f766e, #0ea5a4);
              color: #ffffff;
              border-radius: 8px;
              padding: 10px 12px;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.01em;
              box-sizing: border-box;
              white-space: normal;
              overflow-wrap: anywhere;
              word-break: break-word;
              line-height: 1.35;
            }
            @media print {
              body { display: block; }
              .sheet {
                max-width: none;
                border-radius: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>
                <h1 class="title">Package Info</h1>
                <div class="subtitle">Vision Travel Hub</div>
              </div>
              <div class="meta">Generated: ${new Date().toLocaleString('en-IN')}</div>
            </div>
            <div class="content">
              ${renderedHtml}
            </div>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  };

  if (!previewText) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Package Info</h1>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">
          No preview data found. Please calculate trip cost first.
        </div>
        <button
          type="button"
          onClick={() => navigate(calculatorBase)}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          Back to Rate Calculator
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Package Info</h1>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <textarea
          value={previewText}
          readOnly
          rows={20}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={handleEdit}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Copy To Clipboard
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
