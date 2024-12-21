import express from 'express';
import { getContacts, getPostHome, getSuggestedUsers, smartSearch } from '../controllers/home.controller.js';
import isAuth from '../middlewares/isAuth.middleware.js';
const router = express.Router();

router.get('/getPostHome', isAuth, getPostHome);
router.get('/smart-search', isAuth, smartSearch);
router.get('/contacts', isAuth, getContacts);
router.get('/suggested-users', isAuth, getSuggestedUsers)
export default router;