import express from 'express';
import uploader from '../services/multerUploader';
import { createProtocol, updateProtocol, getAllProtocols, getProtocol, deleteProtocol } from '../controllers/protocolController';

const router = express.Router();

router.post('/createProtocol', uploader.any(), createProtocol);
router.put('/updateProtocol/:protocolId', uploader.any(), updateProtocol);
router.get('/getAllProtocols', uploader.none(), getAllProtocols);
router.get('/getProtocol/:protocolId', uploader.none(), getProtocol);
router.delete('/deleteProtocol/:protocolId', uploader.none(), deleteProtocol);

export default router;
