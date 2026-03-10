import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPackages, deletePackage, uploadBaseUrl, downloadItinerary } from '../../services/api';
import Loading from '../../components/Loading';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/DataTable';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

export default function Packages() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewModal, setViewModal] = useState({ open: false, data: null });
  const [downloadingId, setDownloadingId] = useState(null);

  const load = () => {
    setLoading(true);
    getPackages().then((r) => setList(r.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleDelete = (row) => {
    if (!window.confirm(`Delete package "${row.name || row.title}"?`)) return;
    deletePackage(row.id)
      .then(() => { toast('Package deleted'); load(); })
      .catch((err) => toast(err.response?.data?.message || 'Delete failed', 'error'));
  };

  const handleView = (row) => {
    setViewModal({ open: true, data: row });
  };

  const handleDownloadPdf = (row) => {
    setDownloadingId(row.id);
    downloadItinerary(row.id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `itinerary-${row.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast('Itinerary PDF downloaded');
      })
      .catch(() => toast('Download failed', 'error'))
      .finally(() => setDownloadingId(null));
  };

  const handlePrintPdf = (row) => {
    setDownloadingId(row.id);
    downloadItinerary(row.id)
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
          toast('Allow pop-ups to print itinerary', 'error');
          window.URL.revokeObjectURL(url);
          return;
        }
        const tryPrint = () => {
          try {
            win.focus();
            win.print();
          } catch (e) {
            // ignore
          }
        };
        setTimeout(tryPrint, 800);
      })
      .catch(() => toast('Print failed', 'error'))
      .finally(() => setDownloadingId(null));
  };

  const columns = [
    {
      key: 'image_urls',
      label: 'Image',
      render: (r) => {
        const urls = r.image_urls || [];
        const first = urls[0];
        if (!first) return <span className="text-slate-400 text-sm">—</span>;
        const src = first.startsWith('http') ? first : `${uploadBaseUrl}${first}`;
        return (
          <img src={src} alt="" className="w-12 h-12 rounded object-cover border border-slate-200" onError={(e) => { e.target.style.display = 'none'; }} />
        );
      },
    },
    { key: 'name', label: 'Package' },
    {
      key: 'price',
      label: 'Price',
      render: (r) => {
        const base = Number(r.price || 0);
        const hotel = Number(r.default_hotel_price || 0);
        const vehicle = Number(r.default_vehicle_price || 0);
        const total = base + hotel + vehicle;
        return `₹${total.toLocaleString('en-IN')}`;
      },
    },
    { key: 'duration_days', label: 'Days' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Packages</h1>
        <Button onClick={() => navigate('/admin/package-builder')} className="w-full sm:w-auto">+ Add Package</Button>
      </div>
      <Card>
        {loading ? <Loading /> : (
          <DataTable
            columns={columns}
            data={list}
            emptyMessage="No packages. Create your first package."
            actions={(row) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => handleView(row)}>
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownloadPdf(row)}
                  disabled={downloadingId === row.id}
                >
                  {downloadingId === row.id ? 'Downloading…' : 'PDF'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePrintPdf(row)}
                  disabled={downloadingId === row.id}
                >
                  Print
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/package-builder/${row.id}`)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
                  Delete
                </Button>
              </div>
            )}
          />
        )}
      </Card>
      {viewModal.open && viewModal.data && (
        <Modal
          open={viewModal.open}
          onClose={() => setViewModal({ open: false, data: null })}
          title="View Package"
          size="xl"
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {viewModal.data.name || viewModal.data.title || 'Package'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {viewModal.data.duration_days || viewModal.data.days || 0} days
                  {viewModal.data.price != null && (
                    <>
                      {' '}•{' '}
                      <span className="font-semibold text-teal-700">
                        ₹{Number(viewModal.data.price || 0).toLocaleString('en-IN')}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {Array.isArray(viewModal.data.image_urls) && viewModal.data.image_urls[0] && (
                <div className="flex gap-2">
                  {viewModal.data.image_urls.slice(0, 3).map((url, idx) => {
                    const src = url.startsWith('http') ? url : `${uploadBaseUrl}${url}`;
                    return (
                      <img
                        key={idx}
                        src={src}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            {viewModal.data.description && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700">
                {viewModal.data.description}
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-400 uppercase mb-1">Duration</p>
                <p className="font-semibold text-slate-800">
                  {viewModal.data.duration_days || viewModal.data.days || 0} days
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-400 uppercase mb-1">Cities (count)</p>
                <p className="font-semibold text-slate-800">
                  {Array.isArray(viewModal.data.city_ids) ? viewModal.data.city_ids.length : 0}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-400 uppercase mb-1">Base Price</p>
                <p className="font-semibold text-teal-700">
                  ₹{Number(viewModal.data.price || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setViewModal({ open: false, data: null })}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => handleDownloadPdf(viewModal.data)}
                disabled={downloadingId === viewModal.data.id}
              >
                {downloadingId === viewModal.data.id ? 'Downloading…' : 'Download Itinerary PDF'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
