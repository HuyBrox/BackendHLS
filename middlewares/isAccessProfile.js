import User from '../models/user.model.js';
import Post from '../models/post.model.js';

export const isAccessProfile = async (req, res, next) => {
    try {
        const userId = req.id;
        const personId = req.params.id || req.body.id;
        const [user, person] = await Promise.all([
            User.findById(userId),
            User.findById(personId),
        ]);
        if (!person || !user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng"
            });
        }
        if (personId !== userId && (!user.following.includes(personId) || !user.followers.includes(personId)) && person.private) {
            const personSelect = {
                _id: person._id,
                username: person.username,
                fullname: person.fullname,
                profilePicture: person.profilePicture,
            };
            return res.status(403).json({
                success: false,
                message: "Trang cá nhân riêng tư, chưa theo dõi hoặc được theo dõi nên không có quyền truy cập",
                personSelect,
            });
        }
        console.log('Có quyền truy cập');
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Lỗi không xác định",
        });
    }
};
export const isAccessPost = async (req, res, next) => {
    try {
        const userId = req.id; // ID của người dùng hiện tại
        const postId = req.params.postId; // ID của bài viết

        // Lấy thông tin bài viết và tác giả của bài viết
        const post = await Post.findById(postId).populate('author', '_id private followers');

        // Kiểm tra xem bài viết có tồn tại hay không
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Bài viết không tồn tại"
            });
        }

        // Lấy thông tin tác giả bài viết
        const author = post.author;

        // Nếu tài khoản của tác giả là riêng tư, kiểm tra quyền truy cập
        if (author.private) {
            const isAuthor = author._id.toString() === userId; // Người dùng hiện tại có phải tác giả không?
            const isFollower = author.followers.some(followerId => followerId.toString() === userId); // Người dùng có phải người theo dõi không?

            if (!isAuthor && !isFollower) {
                return res.status(403).json({
                    success: false,
                    message: "Bài viết thuộc tài khoản riêng tư và bạn không có quyền truy cập"
                });
            }
        }

        // Cho phép tiếp tục nếu các kiểm tra trên đều vượt qua
        next();
    } catch (error) {
        console.error("Error in isAccessPost middleware:", error);
        return res.status(500).json({
            success: false,
            message: "Đã xảy ra lỗi trong quá trình kiểm tra quyền truy cập",
        });
    }
};

