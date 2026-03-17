import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCompanySettings, updateCompanySettings, uploadPaymentQr, getBranches, createBranch, updateBranch, deleteBranch, uploadBaseUrl } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/ui/Modal';
import {
  RiBuildingLine, RiBankLine, RiSaveLine, RiRefreshLine,
  RiPhoneLine, RiMailLine, RiMapPinLine, RiShieldLine,
  RiMapPin2Line, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiQrCodeLine, RiImageAddLine, } from 'react-icons/ri';

const SETTINGS_SECTIONS = [
  { id: 'company',  label: 'Company Information', icon: RiBuildingLine },
  { id: 'bank',     label: 'Bank Details',        icon: RiBankLine },
  { id: 'payment',  label: 'Payment Settings',    icon: RiQrCodeLine },
  { id: 'branches', label: 'Branch Management',   icon: RiMapPin2Line },
  { id: 'preview',  label: 'PDF Header Preview',  icon: RiBuildingLine },
];

const FIELDS = {
  company: [
    { key: 'company_name',    label: 'Company Name',    icon: RiBuildingLine, placeholder: 'Vision Travel Hub' },
    { key: 'company_address', label: 'Address',          icon: RiMapPinLine,   placeholder: '123 Street, City, State - 000000', textarea: true },
    { key: 'company_phone',   label: 'Phone',            icon: RiPhoneLine,    placeholder: '+91 98765 43210' },
    { key: 'company_email',   label: 'Email',            icon: RiMailLine,     placeholder: 'info@company.com', type: 'email' },
    { key: 'company_gst',     label: 'GST Number',       icon: RiShieldLine,   placeholder: '22AAAAA0000A1Z5' },
    { key: 'company_website', label: 'Website',          icon: RiBuildingLine, placeholder: 'https://yourcompany.com' },
  ],
  bank: [
    { key: 'bank_name',    label: 'Bank Name',       placeholder: 'State Bank of India' },
    { key: 'bank_account', label: 'Account Number',  placeholder: '000000000000' },
    { key: 'bank_ifsc',    label: 'IFSC Code',       placeholder: 'SBIN0000000' },
    { key: 'bank_upi',     label: 'UPI ID',          placeholder: 'company@upi' },
    { key: 'bank_branch',  label: 'Branch',          placeholder: 'Main Branch' },
  ],
  payment: [
    { key: 'upi_name',     label: 'UPI Name',        placeholder: 'Vision Travel Hub' },
    { key: 'bank_upi',     label: 'UPI ID',          placeholder: 'company@upi' },
    { key: 'bank_name',    label: 'Bank Name',       placeholder: 'State Bank of India' },
    { key: 'bank_account', label: 'Account Number',  placeholder: '000000000000' },
    { key: 'bank_ifsc',    label: 'IFSC Code',       placeholder: 'SBIN0000000' },
  ],
};

function Field({ field, value, onChange }) {
  const Icon = field.icon;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {Icon && <Icon className="inline mr-1.5 text-teal-600 text-sm" />}
        {field.label}
      </label>
      {field.textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none resize-none"
        />
      ) : (
        <input
          type={field.type || 'text'}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
        />
      )}
    </div>
  );
}

const BRANCH_FIELDS = [
  { key: 'name', label: 'Branch Name', required: true },
  { key: 'code', label: 'Branch Code', required: true },
  { key: 'address', label: 'Address', textarea: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'manager_name', label: 'Manager Name' },
  { key: 'gst_number', label: 'GST Number' },
];

export default function Settings() {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchModal, setBranchModal] = useState({ open: false, data: null });
  const [branchForm, setBranchForm] = useState({});
  const [branchSaving, setBranchSaving] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem('vth_selected_branch_id') || 'all';
  });
  const [settingsSection, setSettingsSection] = useState('company');

  const navigate = useNavigate();
  const { section: sectionParam } = useParams();

  const load = () => {
    setLoading(true);
    const params = selectedBranchId && selectedBranchId !== 'all'
      ? { branch_id: Number(selectedBranchId) }
      : {};
    getCompanySettings(params)
      .then((r) => { setForm(r.data || {}); setOriginal(r.data || {}); })
      .catch(() => toast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  };

  const loadBranches = () => {
    setBranchLoading(true);
    getBranches()
      .then((r) => setBranches(r.data || []))
      .catch(() => toast('Failed to load branches', 'error'))
      .finally(() => setBranchLoading(false));
  };

  useEffect(() => { loadBranches(); }, []);
  useEffect(() => { load(); }, [selectedBranchId]);

  // Sync section from URL path (/admin/settings/:section)
  useEffect(() => {
    const sec = sectionParam || 'company';
    if (SETTINGS_SECTIONS.some((s) => s.id === sec)) {
      setSettingsSection(sec);
    } else {
      setSettingsSection('company');
    }
  }, [sectionParam]);

  const handleChange = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = () => {
    setSaving(true);
    const payload = selectedBranchId && selectedBranchId !== 'all'
      ? { ...form, branch_id: parseInt(selectedBranchId, 10) }
      : form;
    updateCompanySettings(payload)
      .then((r) => { setForm(r.data || form); setOriginal(r.data || form); toast('Settings saved successfully'); })
      .catch(() => toast('Failed to save settings', 'error'))
      .finally(() => setSaving(false));
  };

  const handleReset = () => { setForm({ ...original }); };
  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  const openBranchModal = (branch = null) => {
    setBranchModal({ open: true, data: branch });
    setBranchForm(branch ? { ...branch } : BRANCH_FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {}));
  };
  const closeBranchModal = () => { setBranchModal({ open: false, data: null }); setBranchForm({}); };

  const handleBranchChange = (key, value) => setBranchForm((f) => ({ ...f, [key]: value }));

  const handleBranchSubmit = (e) => {
    e.preventDefault();
    if (!branchForm.name?.trim() || !branchForm.code?.trim()) {
      toast('Branch name and code are required', 'error');
      return;
    }
    setBranchSaving(true);
    const payload = { name: branchForm.name.trim(), code: branchForm.code.trim(), address: branchForm.address || null, city: branchForm.city || null, state: branchForm.state || null, phone: branchForm.phone || null, email: branchForm.email || null, manager_name: branchForm.manager_name || null, gst_number: branchForm.gst_number || null };
    (branchModal.data ? updateBranch(branchModal.data.id, payload) : createBranch(payload))
      .then(() => { toast(branchModal.data ? 'Branch updated' : 'Branch created'); closeBranchModal(); loadBranches(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'))
      .finally(() => setBranchSaving(false));
  };

  const handleQrUpload = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) {
      toast('Please upload an image (JPG, PNG, GIF or WebP)', 'error');
      return;
    }
    setQrUploading(true);
    const branchId = selectedBranchId && selectedBranchId !== 'all'
      ? parseInt(selectedBranchId, 10)
      : null;
    uploadPaymentQr(file, branchId)
      .then((r) => {
        const pathVal = r.data?.path;
        const settings = r.data?.settings;
        if (pathVal) setForm((f) => ({ ...f, upi_qr_path: pathVal }));
        if (settings) setForm((f) => ({ ...f, ...settings }));
        toast('QR code uploaded');
      })
      .catch(() => toast('Failed to upload QR code', 'error'))
      .finally(() => { setQrUploading(false); e.target.value = ''; });
  };

  const handleDeleteBranch = (branch) => {
    if (!window.confirm(`Delete branch "${branch.name}"? This may fail if the branch is in use.`)) return;
    deleteBranch(branch.id)
      .then(() => { toast('Branch deleted'); loadBranches(); })
      .catch((err) => toast(err.response?.data?.message || 'Failed', 'error'));
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Settings</h1>

      {/* Dropdowns: Branch + Section (like Preferred Items) */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Branch:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedBranchId(val);
              if (typeof window !== 'undefined') {
                localStorage.setItem('vth_selected_branch_id', val);
              }
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white min-w-[160px] focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Section:</label>
          <select
            value={settingsSection}
            onChange={(e) => {
              const val = e.target.value;
              setSettingsSection(val);
              navigate(`/admin/settings/${val}`, { replace: true });
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 bg-white min-w-[180px] focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
          >
            {SETTINGS_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Save bar (when form section and dirty) */}
      {(settingsSection === 'company' || settingsSection === 'bank' || settingsSection === 'payment') && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
          {isDirty && (
            <span className="text-sm text-amber-700 font-medium">Unsaved changes</span>
          )}
          <div className="flex gap-2 ml-auto">
            {isDirty && (
              <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition">
                <RiRefreshLine /> Reset
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50"
            >
              <RiSaveLine /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {isDirty && (settingsSection === 'company' || settingsSection === 'bank' || settingsSection === 'payment') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          You have unsaved changes. Click "Save Changes" to apply them.
        </div>
      )}

      {/* Company Info */}
      {settingsSection === 'company' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-600">
          <RiBuildingLine className="text-white text-lg" />
          <h2 className="text-sm font-bold text-white">Company Information</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.company.map((f) => (
            <div key={f.key} className={f.textarea || f.key === 'company_name' ? 'sm:col-span-2' : ''}>
              <Field field={f} value={form[f.key] || ''} onChange={handleChange} />
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Bank Details */}
      {settingsSection === 'bank' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
          <RiBankLine className="text-white text-lg" />
          <h2 className="text-sm font-bold text-white">Bank Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.bank.map((f) => (
            <Field key={f.key} field={f} value={form[f.key] || ''} onChange={handleChange} />
          ))}
        </div>
      </div>
      )}

      {/* Payment Settings (UPI + QR) */}
      {settingsSection === 'payment' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600">
          <RiQrCodeLine className="text-white text-lg" />
          <h2 className="text-sm font-bold text-white">Payment Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600">Configure UPI and bank details shown on invoices, quotations, and payment slips. Upload a QR code for quick UPI payments.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.payment.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                <input
                  type="text"
                  value={form[f.key] || ''}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">UPI QR Code</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm font-medium text-slate-700 transition disabled:opacity-50">
                  <RiImageAddLine className="text-teal-600" />
                  {qrUploading ? 'Uploading...' : 'Upload or replace QR code'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={qrUploading} />
                </label>
              </div>
              {form.upi_qr_path && (
                <div className="rounded-xl border border-slate-200 p-3 bg-white">
                  <p className="text-xs text-slate-500 mb-2">Preview</p>
                  <img
                    src={`${uploadBaseUrl}${form.upi_qr_path}`}
                    alt="UPI QR Code"
                    className="h-28 w-28 object-contain rounded-lg border border-slate-100"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Branch Management */}
      {settingsSection === 'branches' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-purple-600">
          <div className="flex items-center gap-3">
            <RiMapPin2Line className="text-white text-lg" />
            <h2 className="text-sm font-bold text-white">Branch Management</h2>
          </div>
          <button
            type="button"
            onClick={() => openBranchModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 bg-white rounded-lg hover:bg-slate-50 transition"
          >
            <RiAddLine /> Add Branch
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          {branchLoading ? (
            <p className="text-sm text-slate-500 py-4">Loading branches...</p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No branches yet. Add one to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-3 px-3 font-semibold text-slate-700">Name</th>
                  <th className="py-3 px-3 font-semibold text-slate-700">Code</th>
                  <th className="py-3 px-3 font-semibold text-slate-700 hidden sm:table-cell">City</th>
                  <th className="py-3 px-3 font-semibold text-slate-700 hidden md:table-cell">Phone</th>
                  <th className="py-3 px-3 font-semibold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-3 text-slate-800 font-medium">{b.name}</td>
                    <td className="py-3 px-3 text-slate-600">{b.code}</td>
                    <td className="py-3 px-3 text-slate-600 hidden sm:table-cell">{b.city || '—'}</td>
                    <td className="py-3 px-3 text-slate-600 hidden md:table-cell">{b.phone || '—'}</td>
                    <td className="py-3 px-3 text-right">
                      <button type="button" onClick={() => openBranchModal(b)} className="p-2 text-slate-600 hover:text-teal-600 rounded-lg hover:bg-slate-100" title="Edit"><RiEditLine className="inline" /></button>
                      <button type="button" onClick={() => handleDeleteBranch(b)} className="p-2 text-slate-600 hover:text-red-600 rounded-lg hover:bg-slate-100" title="Delete"><RiDeleteBinLine className="inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {/* Branch Add/Edit Modal */}
      <Modal open={branchModal.open} onClose={closeBranchModal} title={branchModal.data ? 'Edit Branch' : 'Add Branch'} size="lg">
        <form onSubmit={handleBranchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BRANCH_FIELDS.map((f) => (
              <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}{f.required ? ' *' : ''}</label>
                {f.textarea ? (
                  <textarea value={branchForm[f.key] || ''} onChange={(e) => handleBranchChange(f.key, e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none resize-none" placeholder={f.label} />
                ) : (
                  <input type={f.type || 'text'} value={branchForm[f.key] || ''} onChange={(e) => handleBranchChange(f.key, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none" placeholder={f.label} required={f.required} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeBranchModal} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={branchSaving} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">{branchSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      {/* Live Preview */}
      {settingsSection === 'preview' && (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">PDF Header Preview</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <div className="p-6">
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-slate-800 text-base">{form.company_name || 'Company Name'}</p>
              <p className="text-xs text-slate-500 mt-1">{form.company_address || 'Company Address'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{form.company_phone || 'Phone'} &nbsp;|&nbsp; {form.company_email || 'Email'}</p>
              {form.company_gst && <p className="text-xs text-slate-500 mt-0.5">GST No.: {form.company_gst}</p>}
            </div>
            <div className="flex-shrink-0">
              <img
                src="/Vision_JPG_Logo.png"
                alt="logo"
                className="h-12 w-auto object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          </div>
          {(form.bank_name || form.bank_account) && (
            <div className="mt-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                {form.bank_name    && <p><span className="text-slate-400">Bank:</span> {form.bank_name}</p>}
                {form.bank_account && <p><span className="text-slate-400">A/C No:</span> {form.bank_account}</p>}
                {form.bank_ifsc    && <p><span className="text-slate-400">IFSC:</span> {form.bank_ifsc}</p>}
                {form.bank_upi     && <p><span className="text-slate-400">UPI:</span> {form.bank_upi}</p>}
                {form.bank_branch  && <p><span className="text-slate-400">Branch:</span> {form.bank_branch}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Save footer when a form section is active */}
      {(settingsSection === 'company' || settingsSection === 'bank' || settingsSection === 'payment') && (
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition disabled:opacity-50 shadow-sm"
          >
            <RiSaveLine className="text-base" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
