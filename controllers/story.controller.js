
import { uploadVideoNoAudio, uploadImage, uploadVideo } from '../helper/uploadMedia.js';
import Story from '../models/story.model.js';
import User from '../models/user.model.js';

export const newStory = async (req, res) => {
    try {
        const { caption, privacy, contentType, sound, timeAction, timeEnd } = req.body; // Lấy dữ liệu từ body
        const media = req.file; // File media (image/video)
        const userId = req.id; // ID người tạo Story

        // Validate nội dung đầu vào
        if (!media && !caption) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp nội dung (media hoặc caption).",
            });
        }

        let mediaUrl;

        // Xử lý dựa trên contentType
        switch (contentType) {
            case 'image':
                mediaUrl = await uploadImage(media);
                break;

            case 'video':
                mediaUrl = await uploadVideo(media);
                break;

            case 'video_audio':
                mediaUrl = await uploadVideoNoAudio(media);

                if (!sound) {
                    return res.status(400).json({
                        success: false,
                        message: "Cần cung cấp âm thanh cho nội dung 'video_audio'.",
                    });
                }
                if (!timeAction || !timeEnd) {
                    return res.status(400).json({
                        success: false,
                        message: "Thiếu thời gian bắt đầu hoặc kết thúc cho âm thanh.",
                    });
                }
                break;

            case 'image_audio':
                mediaUrl = await uploadImage(media);

                if (!sound) {
                    return res.status(400).json({
                        success: false,
                        message: "Cần cung cấp âm thanh cho nội dung 'image_audio'.",
                    });
                }
                if (!timeAction || !timeEnd) {
                    return res.status(400).json({
                        success: false,
                        message: "Thiếu thời gian bắt đầu hoặc kết thúc cho âm thanh.",
                    });
                }
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Loại nội dung không hợp lệ. Chỉ hỗ trợ 'image', 'video', 'video_audio', 'image_audio'.",
                });
        }

        // Tạo Story mới
        const newStory = new Story({
            userId: userId,
            content: mediaUrl,
            contentType: contentType,
            caption: caption || '',
            privacy: privacy || 'public',
            sound: sound || null,
            timeAction: timeAction || "0:0",
            timeEnd: timeEnd || "0:0",
        });

        await newStory.save();

        // Cập nhật thông tin của người dùng
        const user = await User.findById(userId);
        if (user) {
            user.stories.push(newStory._id);
            await user.save();
        } else {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng.",
            });
        }

        // Trả về thông tin của Story vừa tạo
        return res.status(201).json({
            success: true,
            message: "Tạo Story thành công.",
            story: newStory,
        });

    } catch (error) {
        console.error("Error in newStory:", error);
        return res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi tạo Story.",
        });
    }
};

export const deleteStory = async (req, res) => {
    try {
        const storyId = req.params.storyId;

        // Xóa bằng phương thức query để kích hoạt middleware
        const result = await Story.deleteOne({ _id: storyId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy Story",
            });
        }

        console.log("Story đã được xóa");
        return res.status(200).json({
            success: true,
            message: "Xóa Story thành công",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi xóa Story",
        });
    }
};

// [GET] /api/story/:storyId
export const getStory = async (req, res) => {
    try {
        const { storyId } = req.params;

        // Tìm Story và populate thông tin người dùng và âm thanh
        const story = await Story.findById(storyId)
            .populate('userId', 'username fullname profilePicture')
            .populate('sound', 'name url');

        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy Story",
            });
        }

        // Chuẩn bị dữ liệu trả về
        const storyData = {
            success: true,
            message: "Trả về thông tin Story thành công",
            story,
        };

        // Nếu có âm thanh, thêm dữ liệu liên quan (bao gồm thời gian bắt đầu và kết thúc)
        if (story.sound) {
            storyData.soundDetails = {
                name: story.sound.name,
                url: story.sound.url,
                timeAction: story.timeAction,
                timeEnd: story.timeEnd,
            };
        }

        return res.status(200).json(storyData);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi lấy thông tin Story",
        });
    }
};

//[GET] /api/allStories
export const getAllStories = async (req, res) => {
    try {
        const stories = await Story.find({ active: true })
            .populate('userId', 'username fullname profilePicture')
            .populate('sound', 'name url')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Trả về danh sách Stories thành công",
            stories,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi lấy danh sách Stories",
        });
    }
};

//[PATCH] /api/story/:storyId/:reactionType
export const likeStory = async (req, res) => {
    try {
        const { storyId } = req.params;
        const userId = req.id;
        const { reactionType } = req.body;

        // Danh sách các cảm xúc hợp lệ
        const validReactions = ['like', 'haha', 'love', 'sad', 'angry'];

        if (!validReactions.includes(reactionType)) {
            return res.status(400).json({
                success: false,
                message: "Cảm xúc không hợp lệ",
            });
        }

        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy Story"
            });
        }

        // Kiểm tra nếu userId đã tồn tại trong danh sách likes
        const likeEntry = story.likes.find((like) => like.userId.toString() === userId);

        if (likeEntry) {
            // Nếu userId đã tồn tại, kiểm tra giới hạn 8 cảm xúc
            if (likeEntry.reactionTypes.length >= 5) {
                return res.status(400).json({
                    success: false,
                    message: "Đã đạt số lượng cảm xúc tối đa là 5",
                });
            }

            likeEntry.reactionTypes.push(reactionType);
        } else {
            // Nếu userId chưa tồn tại, thêm userId mới cùng cảm xúc
            story.likes.push({
                userId,
                reactionTypes: [reactionType],
            });
        }

        await story.save();

        return res.status(200).json({
            success: true,
            message: "Cảm xúc đã được cập nhật",
            likes: story.likes,
        });
    } catch (error) {
        console.error("Error in likeStory:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Đã xảy ra lỗi trong quá trình xử lý yêu cầu",
        });
    }
};

//Lấy kho lưu trữ str
export const getArchive = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId).populate('story_archive');
        let story_archive = user.story_archive;
        story_archive.map((story) => {
            story_archive.totalLikes = story.likes.length;
            story_archive.totalViews = story.views.length;
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người dùng",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Trả về kho lưu trữ thành công",
            archive: user.story_archive,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi lấy kho lưu trữ",
        });
    }
}
import mongoose from 'mongoose';
//[PATCH] /api/story/:storyId/view
export const viewStory = async (req, res) => {
    try {
        const { storyId } = req.params;
        const userId = req.id;

        const story = await Story.findById(storyId);
        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy Story",
            });
        }

        // Kiểm tra xem user đã xem Story chưa
        const alreadyViewed = story.views.some(view =>
            view.userId && view.userId.toString() === userId.toString()
        );

        if (alreadyViewed) {
            return res.status(400).json({
                success: false,
                message: "Đã xem Story trước đó rồi",
            });
        }

        story.views.push({
            userId: userId,
            viewedAt: new Date()
        });
        await story.save();

        return res.status(200).json({
            success: true,
            message: "Đã cập nhật lượt xem",
            views: story.views.length,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi cập nhật lượt xem",
        });
    }
};

//[GET] /api/story/:storyId/viewers
export const getStoryViewers = async (req, res) => {
    try {
        const { storyId } = req.params;

        // Kiểm tra storyId có hợp lệ không
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({
                success: false,
                message: "ID của Story không hợp lệ.",
            });
        }

        // Tìm kiếm story theo ID và populate các views.userId
        const story = await Story.findById(storyId)
            .populate({
                path: 'views.userId',
                select: 'username fullname profilePicture',
            })
            .exec();

        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy Story.",
            });
        }

        // Lọc và map thông tin người xem từ mảng views
        const viewers = story.views
            .filter(view => view.userId) // Lọc những người xem có userId
            .map(view => ({
                userId: view.userId._id, // Chỉ lấy ObjectId của user
                username: view.userId.username,
                fullname: view.userId.fullname,
                profilePicture: view.userId.profilePicture,
                viewedAt: view.viewedAt, // Thêm thời gian xem
            }));

        return res.status(200).json({
            success: true,
            message: "Trả về danh sách người xem Story.",
            viewers: viewers,
            totalViews: viewers.length,
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách người xem:", error);
        return res.status(500).json({
            success: false,
            message: "Có lỗi xảy ra khi lấy danh sách người xem Story.",
            error: error.message,
        });
    }
};


// [GET] /api/story/myStories
export const getMyStories = async (req, res) => {
    try {
        const userId = req.id;
        const stories = await Story.find({ userId: userId })
            .populate('userId', 'username fullname profilePicture')
            .populate('sound', 'name url')
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: "Trả về danh sách Stories thành công",
            stories,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi lấy danh sách Stories",
        });
    }
};



