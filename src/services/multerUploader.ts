import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.basename("uploads"));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix);
    },
});

const uploader = multer({ storage: storage });

export default uploader;
