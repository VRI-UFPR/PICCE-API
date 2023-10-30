import express from 'express';
import addressRoutes from './addressRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';
import protocolRoutes from './protocolRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);
router.use('/protocol', protocolRoutes);

export default router;
