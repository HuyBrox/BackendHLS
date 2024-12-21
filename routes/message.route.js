import express from 'express';
import { getMessages, getPerson, sendMessage, searchUsers, readMessages } from '../controllers/message.controller.js';
import isAuth from '../middlewares/isAuth.middleware.js';
import { isIdObj } from '../middlewares/isIdObj.js';
const router = express.Router();

router.post('/send/:id', isAuth, isIdObj('id'), sendMessage);
router.get('/getMess/:id', isAuth, isIdObj('id'), getMessages);
router.get('/person', isAuth, getPerson);//đã cập nhật trả về số tin nhắn chưa đọc với người dùng đó
router.get('/Search', isAuth, searchUsers);
router.patch('/read/:id', isAuth, isIdObj('id'), readMessages);
export default router;
