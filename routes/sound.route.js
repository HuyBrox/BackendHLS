import express from 'express';
import { uploadSound, deleteSound, getSounds, searchSounds } from '../controllers/sound.controller.js';
import isAuth from '../middlewares/isAuth.middleware.js';
const router = express.Router();

//multer upload mp3
import multer from 'multer';
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // Giới hạn 200MB
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['audio/mpeg', 'audio/mp3']; // Các MIME type hợp lệ
        const extname = file.originalname.toLowerCase().endsWith('.mp3'); // Kiểm tra phần mở rộng

        console.log("File mimetype:", file.mimetype);
        console.log("File originalname:", file.originalname);
        console.log("Extension valid:", extname);

        if (allowedMimeTypes.includes(file.mimetype) && extname) {
            return cb(null, true); // Chấp nhận file
        } else {
            return cb(new Error('Chỉ chấp nhận file âm thanh mp3'), false); // Từ chối file
        }
    }
});



//ROUTER CHO ADMIN KHÔNG CẦN CODE
// [POST] /uploadSound - Tải lên âm thanh cho người dùng chọn để đăng story
router.post('/uploadSound', upload.single('audioFile'), uploadSound);
router.delete('/deleteSound/:soundId', deleteSound);
//ROUTER CHO CLIENT
router.get('/getSound', isAuth, getSounds);
router.get("/searchSound", isAuth, searchSounds);


export default router;
