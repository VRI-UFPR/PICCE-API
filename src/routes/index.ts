import express from 'express';
import addressRoutes from './addressRoutes';
import authRoutes from './authRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';
import applicationRoutes from './applicationRoutes';
import protocolRoutes from './protocolRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/auth', authRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);
router.use('/application', applicationRoutes);
router.use('/protocol', protocolRoutes);

export default router;
