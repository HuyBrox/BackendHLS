// backend/routes/storyRoute.js
import express from 'express';
import upload from '../middlewares/multer.js';
import { deleteStory, getAllStories, getArchive, getMyStories, getStory, getStoryViewers, likeStory, newStory, viewStory } from '../controllers/story.controller.js';
import isAuth from '../middlewares/isAuth.middleware.js';

const router = express.Router();

// Route để upload Story (có thể upload hình ảnh/video/âm thanh)
router.post('/newStory', isAuth, upload.single('media'), newStory);
router.get('/getAllStory', isAuth, getAllStories);
router.delete('/deleteStory/:storyId', isAuth, deleteStory);
router.get('/getStory/:storyId', isAuth, getStory);
router.post('/likeStory/:storyId', isAuth, likeStory);
router.patch('/:storyId/view', isAuth, viewStory);
router.get('/:storyId/view', isAuth, getStoryViewers);
router.get('/archive-stories', isAuth, getArchive);
router.get('/my-stories', isAuth, getMyStories);
export default router;
