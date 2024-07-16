import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: path.basename('uploads'),
    filename: function (req, file, cb) {
        const fileExt = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'PICCE-' + file.fieldname + '-' + uniqueSuffix + fileExt);
    },
});

const fileFilter = (req: any, file: any, cb: any) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('Only .jpeg and .png files are allowed!'), false);
    }
};

const uploader = multer({ storage: storage, fileFilter: fileFilter });

export default uploader;
