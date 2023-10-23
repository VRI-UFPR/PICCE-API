import express from 'express';
import addressRoutes from './addressRoutes';
import authRoutes from './authRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/auth', authRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);

export default router;
