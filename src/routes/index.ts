import express from 'express';
import addressRoutes from './addressRoutes';
import authRoutes from './authRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/auth', authRoutes);

export default router;
