import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Reels from "../models/reels.model.js";
import Notification from "../models/notification.model.js";
import { getReciverSocketIds, io } from "../socket/socket.js";

//[GET] /comment/:postId/:commentId/replies

// Hàm tính điểm cho comment
const calculateCommentScore = (comment, childScores = 0) => {
    const WEIGHT = {
        LIKES: 5,           // Trọng số cho lượt thích
        REPLIES: 3,         // Trọng số cho số lượng phản hồi
        RECENCY: 2,         // Trọng số cho độ mới của comment
        AUTHOR_REPUTATION: 1 // Trọng số cho uy tín của tác giả
    };

    // Tính điểm likes
    const likesScore = comment.likes ? comment.likes.length * WEIGHT.LIKES : 0;

    // Tính điểm số lượng phản hồi
    const repliesScore = comment.replies ? comment.replies.length * WEIGHT.REPLIES : 0;

    // Tính điểm độ mới - comment mới hơn sẽ có điểm cao hơn
    const currentTime = new Date();
    const commentAge = comment.createdAt ? (currentTime - comment.createdAt) / (1000 * 60 * 60) : 0; // Tính theo giờ
    const recencyScore = Math.max(0, WEIGHT.RECENCY * (24 - Math.min(commentAge, 24)));

    // Tính điểm uy tín tác giả (giả sử có trường reputation ở user)
    const authorReputationScore = (comment.author && comment.author.reputation)
        ? comment.author.reputation * WEIGHT.AUTHOR_REPUTATION
        : 0;

    // Tổng điểm (bao gồm điểm của con)
    const totalScore = likesScore + repliesScore + recencyScore + authorReputationScore + childScores;

    return totalScore;
};
const countComments = (comments) => {
    let total = 0;

    const countReplies = (comment) => {
        total += 1; // Đếm chính comment hiện tại
        if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach((reply) => countReplies(reply)); // Đệ quy đếm replies
        }
    };

    comments.forEach((comment) => countReplies(comment)); // Duyệt từng bình luận gốc
    return total;
};

// Hàm xây dựng hệ thống comment phân cấp và xếp hạng
const buildAdvancedCommentHierarchy = (comments, parentId = null) => {
    const filteredComments = [];

    for (const comment of comments) {
        if ((comment.parentId && comment.parentId.toString() === (parentId ? parentId.toString() : null)) || (!comment.parentId && parentId === null)) {
            // Xây dựng phân cấp cho các replies
            const childComments = buildAdvancedCommentHierarchy(comments, comment._id);

            // Tổng điểm của tất cả các replies
            const childScores = childComments.reduce((acc, child) => acc + child.score, 0);

            // Tính điểm tổng cho comment hiện tại
            const commentObject = {
                ...comment.toObject(),
                replies: childComments,
                score: calculateCommentScore(comment, childScores), // Bao gồm điểm con
            };

            filteredComments.push(commentObject);
        }
    }

    // Sắp xếp theo điểm
    return filteredComments.sort((a, b) => b.score - a.score);
};


// Controller nâng cao cho việc lấy comments
export const getComments = async (req, res) => {
    try {
        const postId = req.params.postId;
        const sortType = req.query.sortType || 'intelligent'; // Các kiểu sắp xếp

        // Truy vấn comments với populate đầy đủ
        const comments = await Comment.find({ post: postId })
            .populate([
                {
                    path: 'author',
                    select: '_id fullname username profilePicture reputation'
                },
                {
                    path: 'likes',
                    select: '_id username fullname profilePicture'
                }
            ])
            .sort({ createdAt: -1 })
            .select('_id text author likes post parentId replies createdAt updatedAt');

        let processedComments;

        // Các phương thức sắp xếp khác nhau
        switch (sortType) {
            case 'intelligent':
                processedComments = buildAdvancedCommentHierarchy(comments);
                break;
            case 'newest':
                processedComments = buildAdvancedCommentHierarchy(comments)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'mostLiked':
                processedComments = buildAdvancedCommentHierarchy(comments)
                    .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
                break;
            default:
                processedComments = buildAdvancedCommentHierarchy(comments);
        }

        // Tính tổng số bình luận bao gồm replies
        const totalComments = countComments(processedComments);

        res.status(200).json({
            comments: processedComments,
            totalComments,
            sortType
        });
    } catch (error) {
        console.error('Lỗi khi lấy comments:', error);
        res.status(500).json({
            message: "Lỗi server: Không thể tải bình luận",
            success: false,
            error: error.message
        });
    }
};

//comment bài viết
//[POST] /comment/:CommentId
export const addComment = async (req, res) => {
    try {
        const postId = req.params.postId;
        const userCommentId = req.id;
        const { text } = req.body;

        const post = await Post.findById(postId);
        if (!text) {
            return res.status(400).json({
                message: "Nội dung comment không được để trống",
                success: false,
            });
        }
        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }

        // Tạo comment trước mà không gọi populate
        const comment = await Comment.create({
            text,
            author: userCommentId,
            post: postId,
        });

        // Sau khi tạo, truy xuất lại comment và áp dụng populate
        const populatedComment = await Comment.findById(comment._id).populate({
            path: 'author',
            select: 'username profilePicture'
        });

        post.comments.push(comment._id);
        await post.save();
        // socket io để thông báo có comment mới
        const user = await User.findById(userCommentId).select('username profilePicture  fullname');
        const postOwnerId = post.author.toString();
        if (postOwnerId !== userCommentId) {
            // Tạo thông báo gửi tới người đăng bài
            const notification = new Notification({
                sender: userCommentId,
                receiver: postOwnerId,
                type: 'comment',
                content: `${user.fullname} đã bình luận bài viết của bạn`,
                source: postId,
            });
            // await notification.save();
            // const receiverSockets = getReciverSocketIds(postOwnerId);
            // io.to(postOwnerId).emit('newNotification', notification);
        }
        res.status(201).json({
            message: "Bình luận thành công",
            comment: populatedComment,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Lỗi server",
            success: false,
        });
    }
};
//relies comment
//[POST] reply/:postId/:commentId
export const replyComment = async (req, res) => {
    try {
        const postId = req.params.postId;
        const commentId = req.params.commentId;
        const userCommentId = req.id; // Lấy userId từ request
        const { text } = req.body;

        // Kiểm tra sự tồn tại của bài viết
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                message: "Không tìm thấy bài viết",
                success: false,
            });
        }

        // Kiểm tra sự tồn tại của comment cha
        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
            return res.status(404).json({
                message: "Không tìm thấy comment cha",
                success: false,
            });
        }

        // Kiểm tra comment cha có thuộc về bài viết không
        if (parentComment.post.toString() !== postId) {
            return res.status(400).json({
                message: "Comment cha không thuộc về bài viết này",
                success: false,
            });
        }

        if (!text) {
            return res.status(400).json({
                message: "Nội dung comment không được để trống",
                success: false,
            });
        }

        // Tạo comment trả lời
        const reply = new Comment({
            text,
            post: postId,
            parentId: commentId,
            author: userCommentId,
        });

        // Lưu comment trả lời
        await reply.save();

        // Thêm ID của comment trả lời vào danh sách replies của comment cha
        parentComment.replies = parentComment.replies || []; // Đảm bảo mảng replies tồn tại
        parentComment.replies.push(reply._id);

        // Lưu comment cha và bài viết
        await Promise.all([
            parentComment.save(),
            post.save(),
        ]);

        // Populate thông tin tác giả của comment trả lời
        await reply.populate({
            path: "author",
            select: "_id fullname username profilePicture",
        });
        // socket io để thông báo có comment mới
        const user = await User.findById(userCommentId).select('username profilePicture  fullname');
        const postOwnerId = post.author.toString();
        if (postOwnerId !== userCommentId) {
            // Tạo thông báo gửi tới người đăng bài
            const notification = new Notification({
                sender: userCommentId,
                receiver: postOwnerId,
                type: 'comment',
                content: `${user.fullname} đã trả lời bình luận của bạn`,
                source: postId,
            });
            await notification.save();
            const io = req.app.get('socketio');
            io.to(postOwnerId).emit('newNotification', notification);
        }
        return res.status(201).json({
            message: "Trả lời thành công",
            reply,
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({
            message: "Lỗi server: " + error.message,
            success: false,
        });
    }
};



// [DELETE] /comment/:commentId
export const deleteComment = async (req, res) => {
    try {
        const commentId = req.params.commentId;
        const userId = req.id;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                message: "Không tìm thấy comment",
                success: false,
            });
        }

        if (comment.author.toString() !== userId) {
            return res.status(403).json({
                message: "Không có quyền xóa comment",
                success: false,
            });
        }

        // Thay thế comment.remove() bằng Comment.findByIdAndDelete
        await Comment.findByIdAndDelete(commentId);
        await Post.updateOne({ _id: comment.post }, { $pull: { comments: commentId } });

        return res.status(200).json({
            message: "Xóa comment thành công",
            success: true,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Lỗi server",
            success: false,
        });
    }
};

//[PATCH] /comment/:commentId
export const editComment = async (req, res) => {
    try {
        const commentId = req.params.commentId;
        const userId = req.userId; // Giả sử userId được lưu trong req
        const { text } = req.body;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                message: "Không tìm thấy comment",
                success: false,
            });
        }

        if (comment.author.toString() !== userId) {
            return res.status(403).json({
                message: "Không có quyền chỉnh sửa comment",
                success: false,
            });
        }

        comment.text = text;
        await comment.save();

        return res.status(200).json({
            message: "Chỉnh sửa comment thành công",
            success: true,
            comment,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Lỗi server",
            success: false,
        });
    }
};
//[Post] /comment/:commentId/like
export const likeComment = async (req, res) => {
    try {
        const commentId = req.params.commentId;
        const userId = req.id;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                message: "Không tìm thấy comment",
                success: false,
            });
        }

        if (comment.likes.includes(userId)) {
            comment.likes = comment.likes.filter((id) => id.toString() !== userId);
        } else {
            comment.likes.push(userId);
        }
        const count = comment.likes.length;
        await comment.save();
        //socket io để thông báo có comment mới
        const user = await User.findById(userId).select('username profilePicture  fullname');
        const postOwnerId = comment.author.toString();
        if (postOwnerId !== userId) {
            // Tạo thông báo gửi tới người đăng bài
            const notification = new Notification({
                sender: userId,
                receiver: postOwnerId,
                type: 'like',
                content: `${user.fullname} đã thích bình luận của bạn`,
                source: comment.post,
            });
            await notification.save();
            const io = req.app.get('socketio');
            io.to(postOwnerId).emit('newNotification', notification);
        }
        return res.status(200).json({
            message: "Thích comment thành công",
            success: true,
            likes: comment.likes,
            count: count,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Lỗi server",
            success: false,
        });
    }
};
//===================Xử lí comment cho reels giống như comment cho post===================

//[POST] /comment/:reelsId
//[GET] /comment/getConmentReels/:reelsId
export const getCommentReels = async (req, res) => {
    try {
        const reelsId = req.params.reelsId;
        const sortType = req.query.sortType || 'intelligent'; // Các kiểu sắp xếp

        // Truy vấn comments với populate đầy đủ
        const comments = await Comment.find({ reels: reelsId })
            .populate([
                {
                    path: 'author',
                    select: '_id fullname username profilePicture ',
                },
                {
                    path: 'likes',
                    select: '_id username fullname profilePicture',
                },
            ])
            .sort({ createdAt: -1 })
            .select('_id text author likes reels parentId replies createdAt updatedAt');

        let processedComments;

        // Các phương thức sắp xếp khác nhau
        switch (sortType) {
            case 'intelligent':
                processedComments = buildAdvancedCommentHierarchy(comments);
                break;
            case 'newest':
                processedComments = buildAdvancedCommentHierarchy(comments).sort(
                    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                );
                break;
            case 'mostLiked':
                processedComments = buildAdvancedCommentHierarchy(comments).sort(
                    (a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)
                );
                break;
            default:
                processedComments = buildAdvancedCommentHierarchy(comments);
        }

        // Tính tổng số bình luận bao gồm replies
        const totalComments = countComments(processedComments);

        res.status(200).json({
            comments: processedComments,
            totalComments,
            sortType,
        });
    } catch (error) {
        console.error('Lỗi khi lấy comments:', error);
        res.status(500).json({
            message: 'Lỗi server: Không thể tải bình luận',
            success: false,
            error: error.message,
        });
    }
};
//[POST] /comment/:reelsId/reels
export const addCommentReels = async (req, res) => {
    try {
        const reelsId = req.params.reelsId;
        const userCommentId = req.id;

        // Kiểm tra userCommentId
        const user = await User.findById(userCommentId);
        if (!user) {
            return res.status(401).json({
                message: 'Người dùng không hợp lệ',
                success: false
            });
        }

        const { text } = req.body;
        if (!text || text.trim() === '') {
            return res.status(400).json({
                message: 'Nội dung comment không được để trống',
                success: false
            });
        }

        const reels = await Reels.findById(reelsId);
        if (!reels) {
            return res.status(404).json({
                message: 'Không tìm thấy Reels',
                success: false
            });
        }

        const comment = await Comment.create({
            text: text.trim(),
            author: userCommentId,
            reels: reelsId
        });

        const populatedComment = await Comment.findById(comment._id).populate({
            path: 'author',
            select: 'username profilePicture fullname'
        });

        reels.comments.push(comment._id);
        await reels.save();

        // Kiểm tra chủ Reels
        const reelsOwnerId = reels.author ? reels.author.toString() : null;
        if (reelsOwnerId && reelsOwnerId !== userCommentId) {
            try {
                const notification = new Notification({
                    sender: userCommentId,
                    receiver: reelsOwnerId,
                    type: 'comment',
                    content: `${user.fullname} đã bình luận trên Reels của bạn`,
                    source: reelsId
                });
                await notification.save();

                const io = req.app.get('socketio');
                if (io) {
                    io.to(reelsOwnerId).emit('newNotification', notification);
                }
            } catch (notificationError) {
                console.error('Lỗi tạo thông báo:', notificationError);
            }
        }

        res.status(201).json({
            message: 'Bình luận thành công',
            comment: populatedComment
        });

    } catch (error) {
        console.error('Lỗi thêm comment:', error);
        res.status(500).json({
            message: 'Lỗi server',
            success: false
        });
    }
};
//[POST] /comment/:reelsId/replyReels/:commentId
export const replyCommentReels = async (req, res) => {
    try {
        const reelsId = req.params.reelsId;
        const commentId = req.params.commentId;
        const userCommentId = req.id;
        const { text } = req.body;

        const reels = await Reels.findById(reelsId);
        if (!reels) {
            return res.status(404).json({
                message: 'Không tìm thấy Reels',
                success: false,
            });
        }

        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
            return res.status(404).json({
                message: 'Không tìm thấy comment cha',
                success: false,
            });
        }

        if (parentComment.reels.toString() !== reelsId) {
            return res.status(400).json({
                message: 'Comment cha không thuộc về Reels này',
                success: false,
            });
        }

        if (!text) {
            return res.status(400).json({
                message: 'Nội dung comment không được để trống',
                success: false,
            });
        }

        const reply = new Comment({
            text,
            reels: reelsId,
            parentId: commentId,
            author: userCommentId,
        });

        await reply.save();

        parentComment.replies = parentComment.replies || [];
        parentComment.replies.push(reply._id);

        await Promise.all([parentComment.save(), reels.save()]);

        await reply.populate({
            path: 'author',
            select: '_id fullname username profilePicture',
        });

        const user = await User.findById(userCommentId).select('username profilePicture fullname');
        const reelsOwnerId = reels.author.toString();
        if (reelsOwnerId !== userCommentId) {
            const notification = new Notification({
                sender: userCommentId,
                receiver: reelsOwnerId,
                type: 'comment',
                content: `${user.fullname} đã trả lời bình luận trên Reels của bạn`,
                source: reelsId,
            });
            await notification.save();
            const io = req.app.get('socketio');
            io.to(reelsOwnerId).emit('newNotification', notification);
        }

        return res.status(201).json({
            message: 'Trả lời thành công',
            reply,
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({
            message: 'Lỗi server: ' + error.message,
            success: false,
        });
    }
};

//[DELETE] /comment/:commentId
export const deleteCommentReels = async (req, res) => {
    try {
        const commentId = req.params.commentId;
        const userId = req.id;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({
                message: 'Không tìm thấy comment',
                success: false,
            });
        }

        if (comment.author.toString() !== userId) {
            return res.status(403).json({
                message: 'Không có quyền xóa comment',
                success: false,
            });
        }

        await Comment.findByIdAndDelete(commentId);
        await Reels.updateOne({ _id: comment.reels }, { $pull: { comments: commentId } });

        return res.status(200).json({
            message: 'Xóa comment thành công',
            success: true,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: 'Lỗi server',
            success: false,
        });
    }
};
//[PATCH] /comment/:commentId/editCommentReels
//edit dùng chung cho comment của post và reels được
//like cũng dùng chung cho comment của post và reels được



