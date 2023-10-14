import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: path.basename("uploads"),
    filename: function (req, file, cb) {
        const fileExt = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "PICCE-" + file.fieldname + "-" + uniqueSuffix + fileExt);
    },
});

const uploader = multer({ storage: storage });

export default uploader;
