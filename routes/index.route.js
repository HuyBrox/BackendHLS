import express from 'express';

import UserRoute from './user.route.js';
import MessageRoute from './message.route.js';
import PostRoute from './post.route.js';
import CommentRoute from './comment.route.js';
import NotificationRoute from './notification.route.js';
import StoryRoute from './story.route.js';
import SoundRoute from '../routes/sound.route.js';
import HomeRouter from './home.route.js';
import ReelsRouter from './reels.router.js'
const router = express.Router();
router.use('/home', HomeRouter);
router.use('/user', UserRoute);
router.use('/message', MessageRoute);
router.use('/post', PostRoute);
router.use('/comment', CommentRoute);
router.use('/notification', NotificationRoute);
router.use('/story', StoryRoute);
router.use('/sound', SoundRoute);
router.use('/reels', ReelsRouter);

export default router;