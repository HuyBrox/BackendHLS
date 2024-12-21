import sharp from 'sharp';
import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import cloudinary from '../utils/cloudinary.js';
import { getReciverSocketIds, io } from "../socket/socket.js";
import Notification from '../models/notification.model.js';
//tạo bài viết
export const newPost = async (req, res) => {
    try {
        const { caption } = req.body; // Đặt giá trị mặc định
        const img = req.file;
        const authorId = req.id;

        // Validate input
        if (!img) {
            return res.status(400).json({
                success: false,
                message: "Không có hình ảnh nào được tải lên"
            });
        }

        // Optimize image
        const optimizedImgBuffer = await sharp(img.buffer)
            .resize({ width: 500, height: 500, fit: 'inside' })
            .toFormat("jpeg", { quality: 80 })
            .toBuffer();

        // Upload to cloudinary
        const fileUri = `data:image/jpeg;base64,${optimizedImgBuffer.toString("base64")}`;
        const cloudinaryResponse = await cloudinary.uploader.upload(fileUri);

        // Create post and update user in parallel
        const [post, user] = await Promise.all([
            Post.create({
                caption,
                img: cloudinaryResponse.secure_url,
                author: authorId
            }),
            User.findById(authorId)
        ]);

        // Update user's posts array
        if (user) {
            user.posts.push(post._id);
            await user.save();
        } else {
            throw new Error("Không tìm thấy người dùng");
        }

        // Populate author info
        await post.populate({
            path: 'author',
            select: '-password'
        });

        return res.status(201).json({
            success: true,
            message: "Đăng bài thành công",
            post,
        });

    } catch (error) {
        console.error('Error in newPost:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi tạo bài viết"
        });
    }
};
//lấy tất cả bài viết
export const getAllPosts = async (req, res) => {
    try {

        const posts = await Post.find().sort({ createdAt: -1 })
            //lấy thông tin của người đăng bài
            .populate({ path: 'author', select: 'username, profilePicture' })
            //lấy thông tin của người comment và comment của bài viết
            .populate({
                path: 'comments',
                sort: { createdAt: -1 },
                populate: {
                    'path': 'author',
                    'select': 'username, profilePicture'
                }
            });
        return res.status(200).json({
            success: true,
            posts
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export const likePost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const userLikeId = req.id;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }

        // Cập nhật likes nếu user chưa like trước đó
        const updatedPost = await post.updateOne({ $addToSet: { likes: userLikeId } });
        const likesCount = post.likes.length + (updatedPost.nModified ? 1 : 0);
        //gửi thông báo socket
        // Lấy thông tin của người like bài viết
        const user = await User.findById(userLikeId).select('username profilePicture fullname');
        const postOwnerId = post.author.toString();
        if (postOwnerId !== userLikeId) {
            // Tạo thông báo gửi tới người đăng bài
            const link = `/post/${postId}`;
            const notification = {
                sender: userLikeId,
                receiver: postOwnerId,
                type: 'like',
                content: `${user.username} đã thích bài viết của bạn.`,
                link,
            }
            //hàm getReciverSocketIds lấy ra socketId của người nhận thông báo
            const postOwnerSocketIds = getReciverSocketIds(postOwnerId);
            if (postOwnerSocketIds.length > 0) {
                postOwnerSocketIds.forEach(socketId => {
                    io.to(socketId).emit('notification', notification); // Gửi thông báo đến từng socket
                });
            }



            //lưu thông báo vào db
            await Notification.create(notification);

        }



        return res.status(200).json({
            message: "Like bài viết thành công",
            success: true,
            likesCount,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Đã có lỗi xảy ra",
            success: false,
        });
    }
};


export const unlikePost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const userLikeId = req.id;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }

        // Cập nhật likes nếu user đã like trước đó
        const updatedPost = await post.updateOne({ $pull: { likes: userLikeId } });
        const likesCount = post.likes.length - (updatedPost.nModified ? 1 : 0);

        return res.status(200).json({
            message: "Unlike bài viết thành công",
            success: true,
            likesCount,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Đã có lỗi xảy ra",
            success: false,
        });
    }
};



//xóa bài viết
export const deletePost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const authorId = req.id;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }
        if (post.author.toString() !== authorId) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa bài viết này",
                success: false,
            });
        }
        await Post.findByIdAndDelete(postId);
        //xóa bài viết trong mảng posts của user
        const user = await User.findById(authorId);
        user.posts.pull(postId);
        await user.save();
        //xóa comment khi bài viết bị xóa
        await Comment.deleteMany({
            post: postId,
        });

        return res.status(200).json({
            message: "Xóa bài viết thành công",
            success: true,
        });
    } catch (error) {
        console.log(error);
    }
}
//[GET] /api/post/getPost/:id
//lấy bài viết theo id
// ``
export const getPost = async (req, res) => {
    try {
        const postId = req.params.postId;

        // Populate fields directly in the query
        const post = await Post.findById(postId)
            .populate({ path: 'author', select: 'username profilePicture fullname _id' })
            .populate({ path: 'likes', select: 'username _id' })

        const totalComments = await Comment.countDocuments({ post: postId });
        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
                totalComments: totalComments,
            });
        }
        const isLiked = post.likes.some(like => like._id.toString() === req.id);

        return res.status(200).json({
            message: "Lấy bài viết thành công",
            success: true,
            post,
            isLiked: isLiked,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: error.message,
            success: false
        });
    }
};

//đánh dấu hoặc bỏ đánh dấu bài viết
//[GET] /api/posts/getUserPosts/:id
export const getUserPosts = async (req, res) => {
    try {
        const userId = req.params.id;
        const posts = await Post.find({ author: userId }).sort({ createdAt: -1 })
            .populate({ path: 'author', select: 'username, profilePicture' })
            .populate({ path: 'likes', select: 'username fullname profilePicture' });
        posts.map(post => {
            post.isLiked = post.likes.some(like => like._id.toString() === req.id);
            return post;
        });

        return res.status(200).json({
            success: true,
            posts
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
//[POST] /api/post/bookmark/:postId
export const bookmarkPost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.id;
        const user = await User.findById(userId);
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy người dùng",
                success: false,
            });
        }
        //kiểm tra bài viết đã được đánh dấu chưa
        if (user.bookmarks.includes(postId)) {
            user.bookmarks.pull(postId);
            await user.save();
            return res.status(200).json({
                message: "Bỏ đánh dấu bài viết thành công",
                success: true,
            });
        } else {
            user.bookmarks.push(postId);
            await user.save();
            return res.status(200).json({
                message: "Đánh dấu bài viết thành công",
                success: true,
            });
        }
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            message: error.message,
            success: false
        });
    }
}
//[GET] /api/post/getBookmarks/:id
//lấy bài viết đã đánh dấu của người dùng trên url
export const getBookmarks = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy người dùng",
                success: false,
            });
        }
        const bookmarks = user.bookmarks || [];
        const posts = await Post.find({ _id: { $in: bookmarks } }).sort({ createdAt: -1 })
            .populate({ path: 'author', select: 'username, profilePicture' })
            .populate({ path: 'likes', select: 'username' })
            .populate({ path: 'comments', select: 'author content' });
        return res.status(200).json({
            success: true,
            posts
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Đã có lỗi xảy ra",
            success: false
        });
    }
}

