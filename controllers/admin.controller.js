import User from "../models/user.model.js";
import Follow from "../models/follow.model.js";
import Notification from "../models/notification.model.js";
import Note from "../models/note.model.js";
import Comment from "../models/comment.model.js";
import Message from "../models/message.model.js";
import Post from "../models/post.model.js";
import Reels from "../models/reels.model.js";
import Story from "../models/story.model.js";

//router cho admin xóa hết data trên db trừ dữ liệu của user với id được chỉ định
export const deleteAllMongo = async (req, res) => {
    const userIdToKeep = '675f0b0e32b5521057320cf5';
    try {
        await User.deleteMany({ _id: { $ne: userIdToKeep } });
        await Follow.deleteMany({});  // Tất cả các dữ liệu follow có thể xóa, giữ nguyên phần này
        await Notification.deleteMany({});
        await Note.deleteMany({});
        await Comment.deleteMany({ author: { $ne: userIdToKeep } });
        await Message.deleteMany({});  // Tất cả các tin nhắn có thể xóa, giữ nguyên phần này
        await Post.deleteMany({ author: { $ne: userIdToKeep } });
        await Reels.deleteMany({ author: { $ne: userIdToKeep } });
        await Story.deleteMany({ userId: { $ne: userIdToKeep } });
        await res.status(200).json({ message: "Xóa thành công", success: true });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống", success: false });
    }
}
