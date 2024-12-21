import express from 'express';
import { addComment, addCommentReels, deleteComment, deleteCommentReels, editComment, getCommentReels, getComments, replyComment, replyCommentReels } from '../controllers/comment.controller.js';
import isAuth from '../middlewares/isAuth.middleware.js';
import { isIdObj } from '../middlewares/isIdObj.js';
const router = express.Router();

//===========================comment cho post===========================
router.get('/:postId', isAuth, isIdObj('postId'), getComments); // lấy ra danh sách comment (lưu ý có truyền thêm queryparameter)
router.post('/:postId', isAuth, isIdObj('postId'), addComment); // viết bình luận
router.post('/reply/:postId/:commentId', isAuth, isIdObj('postId', 'commentId'), replyComment); // trả lời bình luận
router.delete('/:commentId', isAuth, isIdObj('commentId'), deleteComment);
router.patch('/:commentId', isAuth, isIdObj('commentId'), editComment);

//===========================comment cho reel===========================
router.get('/reel/:reelsId', isAuth, isIdObj('reelsId'), getCommentReels); // lấy ra danh sách comment (lưu ý có truyền thêm queryparameter)
router.post('/reel/:reelsId', isAuth, isIdObj('reelsId'), addCommentReels); // viết bình luận
router.post('/reel/reply/:reelsId/:commentId', isAuth, isIdObj('reelsId', 'commentId'), replyCommentReels); // trả lời bình luận
router.delete('/reel/:commentId', isAuth, isIdObj('commentId'), deleteCommentReels);
//edit và like comment reel thì dùng chung với comment bình thường nhé Lộc :D

export default router;