import Reels from "../models/reels.model.js";
import User from "../models/user.model.js";
import { uploadAudio, deleteMediaById, uploadVideo } from "../helper/uploadMedia.js";
export const newReels = async (req, res) => {
    try {
        const { caption } = req.body;
        const userId = req.id;
        const video = req.file;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Người dùng không tồn tại"
            });
        }
        if (!video) {
            return res.status(400).json({
                success: false,
                message: "Không có video"
            });
        }
        if (video.mimetype.split('/')[0] !== 'video') {
            return res.status(400).json({
                success: false,
                message: "File không phải video"
            });
        }
        const urlVideo = await uploadVideo(video);
        const newReels = new Reels({
            caption,
            urlVideo,
            author: userId
        });
        await newReels.save();

        user.reels.push(newReels._id);
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Tạo reels thành công",
            reels: newReels
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi tạo reels"
        });
    }
}
//[DELETE] /reels/:id
export const deleteReels = async (req, res) => {
    try {
        const userId = req.id;
        const { idReel } = req.params;
        const reels = await Reels.findById(idReel);
        if (!reels) {
            return res.status(404).json({
                success: false,
                message: "Reels không tồn tại"
            });
        }
        if (reels.author.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Không có quyền xóa reels"
            });
        }
        await deleteMediaById(reels.urlVideo, 'video');
        await reels.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Xóa reels thành công"
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi xóa reels"
        });
    }
}
//[GET] /reels?limit=10&page=1
export const getReels = async (req, res) => {
    try {
        const { limit, page } = req.query;
        let reels = await Reels.find()
            .populate('author', '_id username fullname profilePicture')
            .populate('likes', '_id username fullname profilePicture')
            .populate({ path: 'comments', populate: { path: 'author', select: '_id username fullname profilePicture' } })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));


        reels = reels.map(reel => {
            const totalLikes = Array.isArray(reel.likes) ? reel.likes.length : 0;
            const totalComments = Array.isArray(reel.comments) ? reel.comments.length : 0;
            const totalViews = Array.isArray(reel.views) ? reel.views.length : 0;

            return {
                ...reel.toObject(),
                totalLikes,
                totalComments,
                totalViews
            };
        });

        return res.status(200).json({
            success: true,
            message: "Lấy reels thành công",
            reels
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy reels"
        });
    }
}
//[POST] /reels/:idReel/like
export const likeReels = async (req, res) => {
    try {
        const userId = req.id;
        const { idReel } = req.params;
        const reels = await Reels.findById(idReel);
        if (!reels) {
            return res.status(404).json({
                success: false,
                message: "Reels không tồn tại"
            });
        }
        if (reels.likes.includes(userId)) {
            reels.likes = reels.likes.filter(like => like.toString() !== userId);
        } else {
            reels.likes.push(userId);
        }
        await reels.save();
        return res.status(200).json({
            success: true,
            message: "Like reels thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi like reels"
        });
    }
}
//unlike reels
export const unlikeReels = async (req, res) => {
    try {
        const userId = req.id;
        const { idReel } = req.params;
        const reels = await Reels.findById(idReel);
        if (!reels) {
            return res.status(404).json({
                success: false,
                message: "Reels không tồn tại"
            });
        }
        if (!reels.likes.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "Chưa like reels"
            });
        }
        reels.likes = reels.likes.filter(like => like.toString() !== userId);
        await reels.save();
        return res.status(200).json({
            success: true,
            message: "Unlike reels thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi unlike reels"
        });
    }
}
//xem reels
//[PATCH] /reels/:idReel/view
export const viewReels = async (req, res) => {
    try {
        const userId = req.id;
        const { idReel } = req.params;
        const reels = await Reels.findById(idReel);
        if (!reels) {
            return res.status(404).json({
                success: false,
                message: "Reels không tồn tại"
            });
        }
        if (reels.views.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: "Đã xem reels trước đó rồi"
            });
        }
        reels.views.push(userId);
        await reels.save();
        return res.status(200).json({
            success: true,
            message: "Xem reels thành công"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi xem reels"
        });
    }
}

//get my reels
//[GET] /reels/my-reels
export const getMyReels = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Người dùng không tồn tại"
            });
        }
        user.populate('reels');
        return res.status(200).json({
            success: true,
            message: "Lấy reels thành công",
            reels: user.reels
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy reels"
        });
    }
}