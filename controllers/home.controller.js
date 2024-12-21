import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import Conversation from '../models/conversation.model.js';
import mongoose from 'mongoose';

//Mỗi trang 20 bài viết thôi nha, nếu kéo hết 20 bài viết thì gửi thêm query page=2, page=3, ... lên để lấy tiếp mấy trang khác
export const getPostHome = async (req, res) => {
    try {
        const userId = req.id;

        const user = await User.findById(userId).populate(['following', 'followers']);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại',
            });
        }

        // Lấy danh sách ID của người following và followers
        const followingIds = user.following.map((followedUser) => followedUser._id.toString());
        const followersIds = user.followers.map((followerUser) => followerUser._id.toString());
        const connectionIds = [...new Set([...followingIds, ...followersIds])];

        // Danh sách username ưu tiên nhất
        const famousUsernames = ['Huy', 'Loc'];
        const famousUsers = await User.find({ username: { $in: famousUsernames } });
        const famousIds = famousUsers.map((famousUser) => famousUser._id.toString());

        // Danh sách ưu tiên hiển thị
        const priorityUserIds = [...new Set([...famousIds, ...connectionIds, userId])];

        // Lấy thông tin phân trang
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Truy vấn bài viết với điểm hiển thị dựa trên tương tác
        const posts = await Post.aggregate([
            {
                $match: {
                    author: { $in: priorityUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'authorData',
                },
            },
            {
                $addFields: {
                    author: { $arrayElemAt: ['$authorData', 0] }, // Thông tin của tác giả
                },
            },
            {
                $lookup: {
                    from: 'comments',
                    localField: '_id',
                    foreignField: 'post',
                    as: 'commentData',
                },
            },
            {
                $addFields: {
                    commentCount: { $size: '$commentData' }, // Tổng số lượng bình luận
                    likesCount: { $size: '$likes' }, // Tổng số lượt thích
                    randomScore: { $rand: {} }, // Điểm ngẫu nhiên để thêm yếu tố random
                    displayScore: {
                        $add: [
                            { $size: '$likes' }, // Mỗi lượt thích +1 điểm
                            { $size: '$commentData' }, // Mỗi bình luận +1 điểm
                            {
                                $cond: [
                                    { $in: ['$author._id', famousIds.map((id) => mongoose.Types.ObjectId(id))] },
                                    10, // Nếu là người nổi tiếng, +10 điểm
                                    0,
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    finalScore: {
                        $add: [
                            { $multiply: ['$displayScore', 2] }, // Ưu tiên cao cho điểm hiển thị
                            { $multiply: ['$randomScore', 1] }, // Thêm yếu tố ngẫu nhiên
                        ],
                    },
                },
            },
            {
                $project: {
                    caption: 1,
                    img: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    author: { _id: 1, fullname: 1, username: 1, profilePicture: 1 },
                    likes: { _id: 1, fullname: 1, username: 1, profilePicture: 1 },
                    commentCount: 1,
                    likesCount: 1,
                    displayScore: 1, // Xuất điểm hiển thị để sắp xếp
                    randomScore: 1, // Xuất điểm ngẫu nhiên để kiểm tra (nếu cần debug)
                    finalScore: 1, // Điểm tổng hợp để sắp xếp cuối cùng
                },
            },
            {
                $sort: { finalScore: -1, createdAt: -1 }, // Sắp xếp theo điểm tổng hợp giảm dần, sau đó theo thời gian
            },
            {
                $skip: skip,
            },
            {
                $limit: limit,
            },
        ]);

        // Trả về danh sách bài viết
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách bài viết thành công',
            posts,
        });
    } catch (error) {
        console.error('Error in getPostHome:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi trong quá trình xử lý yêu cầu',
        });
    }
};






//[GET] Tìm kiếm thông minh /api/home/smart-search?query=
export const smartSearch = async (req, res) => {
    try {
        const { query } = req.query;
        const userId = req.id;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu từ khóa tìm kiếm',
            });
        }

        const currentUser = await User.findById(userId).populate(['following', 'followers']);

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại',
            });
        }

        const followingIds = currentUser.following.map(f => f.toString());
        const followerIds = currentUser.followers.map(f => f.toString());

        // Tìm user khớp với query
        const regex = new RegExp(query, 'i');
        const users = await User.find({
            $or: [
                { username: regex },
                { fullname: regex },
                { email: regex },
            ],
        }).lean();

        // Lọc chính mình khỏi kết quả
        users.filter(user => user._id.toString() !== userId);

        // Chấm điểm từng user
        const scoredUsers = users.map(user => {
            let score = 0;

            if (regex.test(user.username)) score += 3;
            if (regex.test(user.fullname)) score += 2;
            if (regex.test(user.email)) score += 1;

            if (followingIds.includes(user._id.toString())) score += 5;
            if (followerIds.includes(user._id.toString())) score += 4;

            return {
                _id: user._id,
                username: user.username,
                fullname: user.fullname,
                profilePicture: user.profilePicture,
                isFollowing: followingIds.includes(user._id.toString()), // Trạng thái đang theo dõi
                isFollower: followerIds.includes(user._id.toString()),  // Trạng thái là follower
                tolalFollowers: user.followers.length,
                score
            };
        });

        // Sắp xếp kết quả dựa trên điểm (cao nhất lên đầu)
        const sortedUsers = scoredUsers.sort((a, b) => b.score - a.score);

        // Chỉ giữ các trường cần thiết trong kết quả trả về
        const result = sortedUsers.map(user => ({
            _id: user._id,
            username: user.username,
            fullname: user.fullname,
            profilePicture: user.profilePicture,
            totalFollowers: user.tolalFollowers,
            text: 'ở dưới là trạng thái fl của 2 người nhé lộc',
            isFollowing: user.isFollowing,
            isFollower: user.isFollower
        }));

        res.status(200).json({
            success: true,
            message: 'Tìm kiếm thành công',
            data: result,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ',
        });
    }
};

//[GET] người liên hệ /api/home/contacts
export const getContacts = async (req, res) => {
    try {
        const userId = req.id;

        const currentUser = await User.findById(userId).populate(['followers', 'following']);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại',
            });
        }

        const contactIds = new Set([
            ...currentUser.followers.map(user => user._id.toString()),
            ...currentUser.following.map(user => user._id.toString())
        ]);

        // Tìm tất cả các cuộc trò chuyện liên quan
        const conversations = await Conversation.find({
            members: { $in: [...contactIds] } // Tìm cuộc trò chuyện với các liên hệ
        })
            .sort({ updatedAt: -1 })
            .populate({
                path: 'members',
                select: '_id username fullname profilePicture lastActiveAt'
            });


        const contacts = [];
        for (const conversation of conversations) {
            const otherMember = conversation.members.find(member => contactIds.has(member._id.toString()));
            if (otherMember && !contacts.some(contact => contact._id.toString() === otherMember._id.toString())) {
                contacts.push({
                    _id: otherMember._id,
                    username: otherMember.username,
                    fullname: otherMember.fullname,
                    profilePicture: otherMember.profilePicture,
                    lastActiveAt: otherMember.lastActiveAt,
                    lastMessageTime: conversation.updatedAt // Thời gian nhắn tin gần nhất
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Danh sách người liên hệ',
            contacts
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};
export const getSuggestedUsers = async (req, res) => {
    try {
        const userId = req.id;

        // Lấy thông tin người dùng hiện tại và danh sách đang theo dõi
        const currentUser = await User.findById(userId).populate('following');
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại',
            });
        }

        const followingIds = currentUser.following.map(user => user._id.toString());

        // Danh sách người nổi tiếng
        const famousUsernames = ['hjuy', 'vanloc_196'];
        const famousUsers = await User.find({ username: { $in: famousUsernames } })
            .select('_id username fullname profilePicture lastActiveAt')
            .lean();

        const famousUsersNotFollowed = famousUsers.filter(user => !followingIds.includes(user._id.toString()));

        // Lấy danh sách bạn bè (following)
        const friendsFollowing = await User.find({
            _id: { $in: followingIds },
        }).select('following').lean();

        // Tìm danh sách những người mà bạn bè mình đang theo dõi
        const friendsFollowingIds = new Set();
        friendsFollowing.forEach(friend => {
            friend.following.forEach(followingUserId => {
                if (
                    followingUserId.toString() !== userId && // Không phải chính mình
                    !followingIds.includes(followingUserId.toString()) // Không phải người đã theo dõi
                ) {
                    friendsFollowingIds.add(followingUserId.toString());
                }
            });
        });

        // Lấy thông tin những người "có thể quen"
        const potentialConnections = await User.find({
            _id: { $in: Array.from(friendsFollowingIds) },
        })
            .select('_id username fullname profilePicture lastActiveAt')
            .lean();

        // Lấy danh sách người dùng khác
        const otherUsers = await User.find({
            _id: { $nin: [...followingIds, userId, ...Array.from(friendsFollowingIds)] },
        })
            .select('_id username fullname profilePicture lastActiveAt')
            .lean();

        // Xử lý trùng lặp bằng cách sử dụng Set
        const seenIds = new Set();

        const suggestedUsers = [
            ...famousUsersNotFollowed.filter(user => {
                if (seenIds.has(user._id.toString())) return false;
                seenIds.add(user._id.toString());
                return true;
            }),
            ...potentialConnections.filter(user => {
                if (seenIds.has(user._id.toString())) return false;
                seenIds.add(user._id.toString());
                return true;
            }),
            ...otherUsers.filter(user => {
                if (seenIds.has(user._id.toString())) return false;
                seenIds.add(user._id.toString());
                return true;
            }),
        ];

        res.status(200).json({
            success: true,
            message: 'Danh sách người dùng đề xuất',
            users: suggestedUsers,
        });
    } catch (error) {
        console.error('Error fetching suggested users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
        });
    }
};