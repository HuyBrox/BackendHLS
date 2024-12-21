import express from 'express';
import upload from '../middlewares/multer.js';
import isAuth from '../middlewares/isAuth.middleware.js';
import { deleteReels, getMyReels, getReels, likeReels, newReels, unlikeReels, viewReels } from '../controllers/reels.controller.js';
import { isIdObj } from '../middlewares/isIdObj.js';
const router = express.Router();

router.post('/newReel', isAuth, upload.single('video'), newReels);
router.delete('/deleteReel/:idReel', isAuth, isIdObj('idReel'), deleteReels);
router.get('/getReels', isAuth, getReels);
router.post('/likeReel/:idReel', isAuth, isIdObj('idReel'), likeReels);
router.patch('/unlikeReel/:idReel', isAuth, isIdObj('idReel'), unlikeReels);
router.patch('/:idReel/view', isAuth, isIdObj('idReel'), viewReels);
router.get('/my-reels', isAuth, getMyReels);
export default router;