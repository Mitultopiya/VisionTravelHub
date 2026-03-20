import express from 'express';
import * as c from '../controllers/pdfController.js';
import { verifyToken, adminOrManager, anyAuth, branchScope } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);
router.use(branchScope);

router.get('/invoice-doc/:id', anyAuth, c.invoiceDocPdf);
router.get('/payment-slip/:id', anyAuth, c.paymentSlipPdf);

router.use(adminOrManager);
router.get('/itinerary/:id', c.itinerary);
router.get('/invoice/:id', c.invoice);
router.get('/quotation/:id', c.quotationPdf);

export default router;
