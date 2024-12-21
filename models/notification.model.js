import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }, // Người thực hiện hành động
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }, // Người nhận thông báo
    type: {
        type: String,
        enum: ['follow_request', 'follow_accept', 'like', 'comment', 'system'],
        required: true
    }, // Loại thông báo
    content: {
        type: String
    },
    link: {
        type: String,
    }, // Nguồn thông báo // để gắn link đến bài viết hoặc người dùng hoặc bình luận
    isRead: {
        type: Boolean,
        default: false
    }, // Đã đọc hay chưa
    createdAt: {
        type: Date,
        default: Date.now
    } // Thời gian tạo
});
const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
