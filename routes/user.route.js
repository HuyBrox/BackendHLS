import express from 'express';
import {
    getProfile,
    setProfile,
    login,
    logout,
    register,
    suggestedUser,
    followOrUnfollow,
    sendOtpToEmail,
    home,
    deleteAvatar,
    postFeaturedNote,
    deleteFeaturedNote,
    deleteFollower,
    getFollowers,
    getFollowing,
    changePassword,
    sendOtpToEmailRegister,
    sendFollow,
    cancelFollow,
    acceptFollowRequest,
    rejectFollow,
    verifyOtpForRegistration
} from '../controllers/user.controller.js';

import isAuth from '../middlewares/isAuth.middleware.js';
import upload from '../middlewares/multer.js';
import { isIdObj } from '../middlewares/isIdObj.js';
import { isAccessProfile } from '../middlewares/isAccessProfile.js';
import { verifiedaccess } from 'googleapis/build/src/apis/verifiedaccess/index.js';
import { deleteAllMongo } from '../controllers/admin.controller.js';

const router = express.Router();

// Đăng ký và Đăng nhập
router.route('/register').post(register);
router.route('/login').post(login);
router.route('/logout').get(logout);

// Trang chủ (Home)
router.route('/').post(isAuth, home);

// Hồ sơ người dùng
router.route('/:id/profile')
    .get(isAuth, isIdObj('id'), isAccessProfile, getProfile);
router.post('/profile/edit', isAuth, upload.single('profilePicture'), setProfile);

// Đề xuất người dùng
router.get('/suggested', isAuth, suggestedUser);

// Theo dõi và Bỏ theo dõi
router.post('/followorunfollow/:id', isAuth, isIdObj('id'), followOrUnfollow);

// Quản lý avatar
router.delete('/deleteAvatar', isAuth, deleteAvatar);

// Ghi chú nổi bật (Featured Notes)
router.post('/featuredNote', isAuth, postFeaturedNote);
router.delete('/featuredNote', isAuth, deleteFeaturedNote);

// Lấy và Xóa người theo dõi
router.get('/followers/:id', isAuth, isIdObj('id'), getFollowers);
router.get('/following/:id', isAuth, isIdObj('id'), getFollowing);
router.delete('/follower/:id', isAuth, isIdObj('id'), deleteFollower);

// OTP cho email
router.post('/sendOtp', isAuth, sendOtpToEmail);
router.post('/sendOtpRegister', sendOtpToEmailRegister);
router.post('/verifyOTP', verifyOtpForRegistration);

// Đổi mật khẩu
router.patch('/changePassword', isAuth, changePassword);


// Gửi yêu cầu follow
router.post('/follow/:id', isAuth, isIdObj('id'), sendFollow);

// Hủy yêu cầu follow
router.delete('/cancelFollow/:id', isAuth, isIdObj('id'), cancelFollow);

// Chấp nhận yêu cầu follow
router.post('/acceptFollow/:id', isAuth, isIdObj('id'), acceptFollowRequest);

// Từ chối yêu cầu follow
router.delete('/rejectFollow/:id', isAuth, isIdObj('id'), rejectFollow);

//router cho admin xóa hết date trên db
router.delete('/deleteAllOfMongo', deleteAllMongo);

export default router;
