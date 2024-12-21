import mongoose from "mongoose";
import Story from "./story.model.js";
import Note from "./note.model.js";
import cron from 'node-cron';

const userSchema = new mongoose.Schema({
    private: {
        type: Boolean,
        default: false,
    },
    fullname: {
        type: String,
        required: true,
        trim: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: String,
        default: "https://cellphones.com.vn/sforum/wp-content/uploads/2023/10/avatar-trang-4.jpg",
    },
    bio: {
        type: String,
        default: "",
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
    },
    followers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    following: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        },
    ],
    bookmarks: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
        },
    ],
    featuredNote: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
    },
    stories: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Story',
        },
    ],
    story_archive: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Story',
        },
    ],
    reels: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Reels',
        },
    ],

    lastActiveAt: { type: Date, default: Date.now }, // Thời gian hoạt động cuối cùng

}, { timestamps: true });

// Cron job chạy mỗi 29 phút để đồng bộ stories và notes
cron.schedule('29 * * * *', async () => {
    try {
        console.log('Bắt đầu quét stories và notes không còn hoạt động.');

        const users = await User.find({});
        console.log(`Đang xử lý ${users.length} người dùng.`);

        for (const user of users) {
            try {
                if (!user.stories || user.stories.length === 0) continue;

                // Lấy các stories không còn active
                const inactiveStories = await Story.find({ _id: { $in: user.stories }, active: false });
                const inactiveStoryIds = inactiveStories.map(story => story._id);

                if (inactiveStoryIds.length > 0) {
                    // Loại bỏ stories không còn hoạt động khỏi danh sách stories và lưu vào archive
                    await User.findByIdAndUpdate(user._id, { $pull: { stories: { $in: inactiveStoryIds } } });
                    await User.findByIdAndUpdate(user._id, { $push: { story_archive: { $each: inactiveStoryIds } } });
                    console.log(`Đã lưu trữ stories không còn hoạt động cho user: ${user._id}`);
                }

                // Xóa featuredNote không hợp lệ nếu tồn tại
                if (user.featuredNote) {
                    const noteExists = await Note.exists({ _id: user.featuredNote });
                    if (!noteExists) {
                        await User.findByIdAndUpdate(user._id, { $unset: { featuredNote: "" } });
                        console.log(`Đã xóa featuredNote không hợp lệ cho user: ${user._id}`);
                    }
                }
            } catch (error) {
                console.error(`Lỗi xử lý cho user ${user._id}:`, error);
            }
        }

        console.log('Quét stories và notes hoàn tất.');
    } catch (error) {
        console.error('Lỗi trong cron job đồng bộ stories và notes:', error);
    }
});


// Khai báo biến User
const User = mongoose.model('User', userSchema);

// Export default sau khi khai báo User
export default User;
