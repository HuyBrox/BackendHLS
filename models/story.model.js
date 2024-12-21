import mongoose from 'mongoose';
import { deleteMediaById } from '../helper/uploadMedia.js'
import User from '../models/user.model.js';
import cron from 'node-cron';

const storySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    contentType: {
        type: String,
        enum: ['image', 'video', 'video_audio', 'image_audio'],
        required: true,
    },
    caption: {
        type: String,
        maxlength: 255,
    },
    privacy: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public',
    },
    sound: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sound',
    },
    timeAction: {
        type: String,
        default: "00:00",
    },
    timeEnd: {
        type: String,
        default: "00:00",
    },
    views: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            viewedAt: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    likes: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            reactionTypes: {
                type: [String],
                enum: ['like', 'haha', 'love', 'sad', 'angry'],
                required: true,
                validate: {
                    validator: function (value) {
                        return value.length <= 8;
                    },
                    message: 'Số lượng cảm xúc tối đa là 8',
                },
            },
        }
    ],
    active: {
        type: Boolean,
        default: true,
    },

}, { timestamps: true });


storySchema.pre(['deleteOne', 'findOneAndDelete'], async function (next) {
    try {
        const story = await this.model.findOne(this.getFilter());
        if (!story) {
            console.warn("Không tìm thấy document để xóa");
            return next();
        }

        const publicId = story.content.split('/').pop().split('.')[0];
        if (publicId) {
            let fileType = '';
            if (['video', 'video_audio'].includes(story.contentType)) {
                fileType = 'video';
            } else if (['image', 'image_audio'].includes(story.contentType)) {
                fileType = 'image';
            }

            if (fileType) {
                await deleteMediaById(publicId, fileType);
                console.log(`Đã xóa ${fileType} trên Cloudinary: ${publicId}`);
            } else {
                console.warn("Không xác định được loại file từ contentType");
            }
        } else {
            console.warn("Không thể xác định publicId từ URL của nội dung");
        }

        // Xóa tham chiếu story khỏi User
        await User.findByIdAndUpdate(story.userId, { $pull: { stories: story._id } });

        next();
    } catch (error) {
        console.error("Lỗi trong middleware xóa Story: ", error);
        next(error);
    }
});


const Story = mongoose.model('Story', storySchema);


// Cron job chạy mỗi giờ để cập nhật trạng thái `active` của stories sau 24 giờ
cron.schedule('*/30 * * * *', async () => {
    try {
        console.log('Bắt đầu kiểm tra và cập nhật trạng thái stories:', new Date().toLocaleString());

        const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const storiesToUpdate = await Story.find({
            active: true,
            createdAt: { $lt: thresholdDate }
        });

        if (storiesToUpdate.length > 0) {
            const updateResults = await Story.updateMany(
                { _id: { $in: storiesToUpdate.map(story => story._id) } },
                { active: false }
            );
            console.log(`Đã cập nhật trạng thái active cho ${updateResults.modifiedCount} stories.`);
        } else {
            console.log('Không có stories nào cần cập nhật.');
        }

        console.log('Quét và cập nhật trạng thái stories hoàn tất.');
    } catch (error) {
        console.error('Lỗi trong cron job cập nhật trạng thái stories:', error);
    }
});
// cron.schedule('0 * * * *', async () => { // Chạy mỗi giờ
//     try {
//         console.log('Bắt đầu kiểm tra và cập nhật trạng thái stories:', new Date().toLocaleString());

//         // Lấy thời gian 24 giờ trước
//         const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

//         // Tìm những stories active và được tạo trước thời điểm 24 giờ trước
//         const storiesToUpdate = await Story.find({
//             active: true,
//             createdAt: { $lt: thresholdDate }
//         });

//         if (storiesToUpdate.length > 0) {
//             // Cập nhật tất cả những stories tìm thấy
//             const updateResults = await Story.updateMany(
//                 { _id: { $in: storiesToUpdate.map(story => story._id) } },
//                 { active: false }
//             );
//             console.log(`Đã cập nhật trạng thái active cho ${updateResults.modifiedCount} stories.`);
//         } else {
//             console.log('Không có stories nào cần cập nhật.');
//         }

//         console.log('Quét và cập nhật trạng thái stories hoàn tất.');
//     } catch (error) {
//         console.error('Lỗi trong cron job cập nhật trạng thái stories:', error);
//     }
// });
export default Story;
