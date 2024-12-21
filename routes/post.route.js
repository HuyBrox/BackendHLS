import express from 'express';
import upload from '../middlewares/multer.js';
import isAuth from '../middlewares/isAuth.middleware.js';
import { bookmarkPost, deletePost, getAllPosts, likePost, newPost, unlikePost, getUserPosts, getBookmarks, getPost } from '../controllers/post.controller.js';
import { isIdObj } from '../middlewares/isIdObj.js';
import { isAccessProfile, isAccessPost } from '../middlewares/isAccessProfile.js';


const router = express.Router();
router.post('/newPost', isAuth, upload.single('img'), newPost);
router.get('/getAllPosts', isAuth, getAllPosts);
router.post('/likePost/:postId', isAuth, isIdObj('postId'), isAccessPost, likePost);
router.post('/unLikePost/:postId', isAuth, isIdObj('postId'), isAccessPost, unlikePost);

router.delete('/deletePost/:postId', isAuth, isIdObj('postId'), deletePost);
router.post('/bookmarkPost/:postId', isAuth, isIdObj('postId'), bookmarkPost);
router.get('/getUserPost/:id', isAuth, isIdObj('id'), isAccessProfile, getUserPosts);
router.get('/getBookmarkedPost/:id', isAuth, isIdObj('id'), isAccessProfile, getBookmarks);
router.get('/getPost/:postId', isAuth, isIdObj('postId'), isAccessPost, getPost);
export default router;