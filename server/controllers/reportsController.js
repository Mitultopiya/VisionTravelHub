import pool from '../config/db.js';

export const dashboard = async (req, res) => {
  try {
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : (req.branchId ?? null);
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revenueReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    let where = "WHERE status NOT IN ('cancelled','draft')";
    const params = [];
    if (start) { params.push(start); where += ` AND invoice_date >= $${params.length}`; }
    if (end) { params.push(end); where += ` AND invoice_date <= $${params.length}`; }
    const result = await pool.query(
      `SELECT i.invoice_number, i.invoice_date, i.total, i.status,
              c.name as customer_name
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       ${where} ORDER BY i.invoice_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const pendingPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
              c.name as customer_name, c.mobile,
              COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.status NOT IN ('paid','cancelled')`
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
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.branch,
              COUNT(b.id) FILTER (WHERE b.status IN ('confirmed','ongoing','completed')) as completed_count,
              COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_count
       FROM users u
       LEFT JOIN bookings b ON b.assigned_staff_id = u.id
       WHERE u.role IN ('manager','staff')
       GROUP BY u.id ORDER BY completed_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
