import express from 'express';
import addressRoutes from './addressRoutes';
import protocolRoutes from './protocolRoutes';
import applicationAnswerRoutes from './applicationAnswerRoutes';

const router = express.Router();

router.use('/address', addressRoutes);
router.use('/protocol', protocolRoutes);
router.use('/applicationAnswer', applicationAnswerRoutes);

export default router;
