import User from '../../models/user.mode.js';
import UserInteraction from '../../models/userinteraction.model.js';
import Post from '../../models/post.model.js';

export const getPersonalizedFeed = async (userId, page = 1, limit = 10) => {
    try {
        if (!userId) throw new Error('UserId is required');

        // Validate page và limit
        page = Math.max(1, parseInt(page));
        limit = Math.min(50, Math.max(1, parseInt(limit)));

        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const currentHour = new Date().getHours();

        // Lấy lịch sử tương tác của người dùng
        const userInteractions = await UserInteraction.find({ user: userId })
            .sort({ lastInteracted: -1 })
            .limit(100)
            .lean();

        const viewedPosts = userInteractions
            .filter(i => i.interactionType === 'view')
            .map(i => i.post);

        const interactedPosts = await Post.find({
            _id: { $in: userInteractions.map(i => i.post) }
        }).lean();

        const userPreferredHashtags = interactedPosts
            .flatMap(p => p.hashtags)
            .reduce((acc, tag) => {
                acc[tag] = (acc[tag] || 0) + 1;
                return acc;
            }, {});

        const totalHashtagCount = Object.values(userPreferredHashtags)
            .reduce((sum, count) => sum + count, 0);

        const normalizedHashtags = {};
        Object.keys(userPreferredHashtags).forEach(tag => {
            normalizedHashtags[tag] = userPreferredHashtags[tag] / totalHashtagCount;
        });


        // Tính điểm cho mỗi bài viết
        const posts = await Post.aggregate([
            {
                $match: {
                    _id: { $nin: viewedPosts } // Loại bỏ bài đã xem
                }
            },
            {
                $addFields: {
                    // Tính điểm hashtag cho bài viết
                    hashtagScore: {
                        $reduce: {
                            input: "$hashtags",
                            initialValue: 0,
                            in: {
                                $add: [
                                    "$$value",
                                    {
                                        $multiply: [
                                            100, // Hệ số nhân cho điểm hashtag
                                            {
                                                $cond: {
                                                    if: { $ifNull: [{ $literal: normalizedHashtags["$$this"] }, 0] },
                                                    then: { $literal: normalizedHashtags["$$this"] },
                                                    else: 0
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    score: {
                        $add: [
                            // Điểm cơ bản từ engagement
                            "$engagement",

                            // Điểm từ hashtags
                            "$hashtagScore",

                            // Bonus cho content type ưa thích
                            {
                                $cond: {
                                    if: { $in: ["$contentType", user.preferredContentTypes] },
                                    then: 50,
                                    else: 0
                                }
                            },

                            // Bonus cho thời gian đăng phù hợp
                            {
                                $cond: {
                                    if: { $in: [currentHour, user.activeHours] },
                                    then: 30,
                                    else: 0
                                }
                            },

                            // Penalty cho bài cũ
                            {
                                $multiply: [
                                    -0.5,
                                    {
                                        $divide: [
                                            { $subtract: [new Date(), "$createdAt"] },
                                            1000 * 60 * 60 // Giờ
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $sort: { score: -1 }
            },
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: limit
            }
        ]);

        // Cập nhật lịch sử xem
        await UserInteraction.create({
            user: userId,
            post: posts.map(p => p._id),
            interactionType: 'view'
        });

        return posts;
    } catch (error) {
        console.error('Error in getPersonalizedFeed:', error);
        throw error;
    }
}

export const updateViewHistory = async (userId, postId) => {
    try {
        if (!userId || !postId) throw new Error('UserId and PostId are required');

        const interaction = await UserInteraction.findOne({
            user: userId,
            post: postId,
            interactionType: 'view'
        });

        if (interaction) {
            interaction.viewCount += 1;
            interaction.lastInteracted = new Date();
            await interaction.save();
        } else {
            await UserInteraction.create({
                user: userId,
                post: postId,
                interactionType: 'view',
                lastInteracted: new Date()
            });
        }
    } catch (error) {
        console.error('Error in updateViewHistory:', error);
        throw error;
    }
}