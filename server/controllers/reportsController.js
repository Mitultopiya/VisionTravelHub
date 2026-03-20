import pool from '../config/db.js';

function resolveBranchId(req) {
  // If UI explicitly requests all branches, DO NOT apply token branch scope.
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  if (req.query.branch_id != null && String(req.query.branch_id) !== '') {
    const parsed = parseInt(req.query.branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

export const dashboard = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const invAnd = branchId ? ' AND branch_id = $1' : '';
    const invWhere = branchId ? ' WHERE branch_id = $1' : '';
    const invAliasAnd = branchId ? ' AND i.branch_id = $1' : '';
    const qWhere = branchId ? ' WHERE branch_id = $1' : '';
    const bp = branchId ? [branchId] : [];

    const [
      totalBranches,
      customers,
      revenue,
      collected,
      totalBookings,
      upcomingTrips,
      invoiceStats,
      quotationStats,
      paymentModes,
      monthlySales,
      invoiceStatusBreakdown,
      paymentReminders,
      recentPaymentActivity,
      branchRevenue,
      branchMetrics,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM branches').then((r) => parseInt(r.rows[0].count, 10)),
      pool.query('SELECT COUNT(*) FROM customers' + (branchId ? ' WHERE branch_id = $1' : ''), bp).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT COALESCE(SUM(total),0) FROM invoices WHERE status NOT IN ('cancelled','draft')` + invAnd, bp).then((r) => Number(r.rows[0].coalesce)),
      pool.query('SELECT COALESCE(SUM(ip.amount),0) FROM invoice_payments ip JOIN invoices i ON ip.invoice_id = i.id' + (branchId ? ' WHERE i.branch_id = $1' : ''), bp).then((r) => Number(r.rows[0].coalesce)),
      pool.query('SELECT COUNT(*) FROM bookings' + (branchId ? ' WHERE branch_id = $1' : ''), bp).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled') AND (travel_start_date IS NULL OR travel_start_date >= CURRENT_DATE)` + (branchId ? ' AND branch_id = $1' : ''), bp).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='draft') as draft,
        COUNT(*) FILTER (WHERE status='issued') as issued,
        COUNT(*) FILTER (WHERE status='paid') as paid,
        COUNT(*) FILTER (WHERE status='overdue') as overdue,
        COUNT(*) FILTER (WHERE status='cancelled') as cancelled,
        COUNT(*) as total
       FROM invoices` + invWhere, bp).then((r) => r.rows[0]),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='draft') as draft,
        COUNT(*) FILTER (WHERE status='sent') as sent,
        COUNT(*) FILTER (WHERE status='approved') as approved,
        COUNT(*) as total
       FROM quotations` + qWhere, bp).then((r) => r.rows[0]),
      pool.query(`SELECT ip.mode, COUNT(*) as count, COALESCE(SUM(ip.amount),0) as total
       FROM invoice_payments ip JOIN invoices i ON ip.invoice_id = i.id` + (branchId ? ' WHERE i.branch_id = $1' : '') + ` GROUP BY ip.mode ORDER BY total DESC`, bp).then((r) => r.rows),
      pool.query(`SELECT
        TO_CHAR(DATE_TRUNC('month', i.invoice_date), 'Mon YYYY') as month,
        DATE_TRUNC('month', i.invoice_date) as month_date,
        COALESCE(SUM(i.total),0) as revenue,
        COUNT(*) as count
       FROM invoices i WHERE i.status NOT IN ('cancelled','draft') AND i.invoice_date >= NOW() - INTERVAL '12 months'` + invAliasAnd + `
       GROUP BY DATE_TRUNC('month', i.invoice_date)
       ORDER BY month_date ASC`, bp).then((r) => r.rows),
      pool.query(`SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total
       FROM invoices` + invWhere + ` GROUP BY status ORDER BY total DESC`, bp).then((r) => r.rows),
      pool.query(
        `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
                c.name as customer_name, c.mobile as customer_mobile, i.package_name,
                COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.status NOT IN ('paid','cancelled')` + invAliasAnd,
        bp
      ).then((r) => {
        return r.rows
          .map((row) => ({
            ...row,
            remaining: Math.max(0, Number(row.total || 0) - Number(row.paid || 0)),
          }))
          .filter((row) => row.remaining > 0)
          .map((row) => {
            const due = new Date(row.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            let status = 'Due Soon';
            if (row.status === 'overdue' || diffDays < 0) status = 'Overdue';
            else if (Number(row.paid || 0) >= Number(row.total || 0)) status = 'Paid';
            return { ...row, status };
          })
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      }),
      pool.query(
        `SELECT ip.id, ip.invoice_id, ip.amount as paid_amount, ip.paid_at,
                i.total as invoice_total, i.package_name,
                c.name as customer_name
         FROM invoice_payments ip
         JOIN invoices i ON ip.invoice_id = i.id
         LEFT JOIN customers c ON i.customer_id = c.id` +
        (branchId ? ' WHERE i.branch_id = $1' : '') +
        ` ORDER BY ip.paid_at DESC LIMIT 15`,
        bp
      ).then((r) => {
        const byInvoice = {};
        r.rows.forEach((row) => {
          if (!byInvoice[row.invoice_id]) byInvoice[row.invoice_id] = { paidSum: 0, rows: [] };
          byInvoice[row.invoice_id].paidSum += Number(row.paid_amount || 0);
          byInvoice[row.invoice_id].rows.push(row);
        });
        return r.rows.map((row) => {
          const inv = byInvoice[row.invoice_id];
          const totalPaid = inv.paidSum;
          const remaining = Math.max(0, Number(row.invoice_total || 0) - totalPaid);
          return {
            customer_name: row.customer_name,
            package_name: row.package_name,
            paid_amount: Number(row.paid_amount),
            remaining,
            paid_at: row.paid_at,
          };
        });
      }),
      pool.query(
        `SELECT b.id as branch_id, b.name as branch_name, COALESCE(SUM(i.total),0) as revenue
         FROM branches b
         LEFT JOIN invoices i ON i.branch_id = b.id AND i.status NOT IN ('cancelled','draft')
         GROUP BY b.id, b.name ORDER BY revenue DESC`
      ).then((r) => r.rows.map((row) => ({ branch_id: row.branch_id, branch_name: row.branch_name, revenue: Number(row.revenue) }))),
      pool.query(
        `SELECT
           b.id   AS branch_id,
           b.name AS branch_name,
           COUNT(DISTINCT c.id) AS customers,
           COUNT(DISTINCT bk.id) AS bookings,
           COUNT(DISTINCT i.id) AS invoices,
           COALESCE(SUM(i.total),0) AS revenue,
           COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END),0) AS collected,
           COALESCE(SUM(i.total),0) - COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END),0) AS pending
         FROM branches b
         LEFT JOIN customers c ON c.branch_id = b.id
         LEFT JOIN bookings bk ON bk.branch_id = b.id
         LEFT JOIN invoices i ON i.branch_id = b.id AND i.status NOT IN ('cancelled','draft')
         GROUP BY b.id, b.name
         ORDER BY revenue DESC`
      ).then((r) => r.rows.map((row) => ({
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        customers: Number(row.customers || 0),
        bookings: Number(row.bookings || 0),
        invoices: Number(row.invoices || 0),
        revenue: Number(row.revenue || 0),
        collected: Number(row.collected || 0),
        pending: Number(row.pending || 0),
      }))),
    ]);

    const due = revenue - collected;
    const pendingCount = paymentReminders.length;

    const paidInvoicesCount = Number(invoiceStats?.paid ?? 0) || 0;

    res.json({
      totalBranches,
      totalCustomers: customers,
      totalBookings,
      upcomingTrips,
      monthlyRevenue: revenue,
      totalCollected: collected,
      completedPayments: collected,
      pendingPayments: Math.max(0, due),
      pendingPaymentsCount: pendingCount,
      paidInvoicesCount,
      invoiceStats,
      quotationStats,
      paymentModes,
      monthlySales,
      invoiceStatusBreakdown,
      paymentReminders,
      recentPaymentActivity,
      branchRevenue,
      branchMetrics,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revenueReport = async (req, res) => {
  try {
    const { start, end, branch_id } = req.query;

    // Normalize branch
    let branchId = null;
    if (branch_id && String(branch_id) !== 'all') {
      const parsed = parseInt(branch_id, 10);
      if (Number.isFinite(parsed) && parsed > 0) branchId = parsed;
    } else if (req.branchId && Number.isFinite(req.branchId)) {
      branchId = req.branchId;
    }

    // Only accept ISO date (YYYY-MM-DD); ignore anything else
    const isValidDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const startDate = isValidDateStr(start) ? start : null;
    const endDate = isValidDateStr(end) ? end : null;

    let where = "WHERE i.status NOT IN ('cancelled','draft')";
    const params = [];

    if (branchId) {
      params.push(branchId);
      where += ` AND i.branch_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      where += ` AND i.invoice_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      where += ` AND i.invoice_date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT i.invoice_number,
              i.invoice_date,
              i.total,
              i.status,
              c.name as customer_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       ${where}
       ORDER BY i.invoice_date DESC`,
      params
    );

    res.json(result.rows || []);
  } catch (err) {
    console.error('Error in revenueReport:', err);
    res.status(500).json({ message: 'Failed to load revenue report.' });
  }
};

export const pendingPayments = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const params = [];
    const branchAnd = branchId && Number.isFinite(branchId) ? ` AND i.branch_id = $1` : '';
    if (branchAnd) params.push(branchId);
    const result = await pool.query(
      `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
              c.name as customer_name, c.mobile,
              COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.status NOT IN ('paid','cancelled')${branchAnd}`,
      params
    );
    const withDue = result.rows
      .map((r) => ({ ...r, due: Number(r.total || 0) - Number(r.paid || 0) }))
      .filter((r) => r.due > 0)
      .sort((a, b) => b.due - a.due);
    res.json(withDue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const staffPerformance = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const params = [];
    let where = `WHERE u.role IN ('manager','staff')`;
    if (branchId && Number.isFinite(branchId)) { params.push(branchId); where += ` AND u.branch_id = $${params.length}`; }
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.branch_id,
              COALESCE(br.name, NULLIF(u.branch, ''), '-') as branch_name,
              COUNT(bk.id) FILTER (WHERE bk.status IN ('confirmed','ongoing','completed')) as completed_count,
              COUNT(bk.id) FILTER (WHERE bk.status = 'cancelled') as cancelled_count
       FROM users u
       LEFT JOIN branches br ON u.branch_id = br.id
       LEFT JOIN bookings bk ON bk.assigned_staff_id = u.id
       ${where}
       GROUP BY u.id, u.name, u.email, u.branch_id, br.name
       ORDER BY completed_count DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
