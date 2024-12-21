import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReciverSocketIds, io } from "../socket/socket.js";
import Notification from "../models/notification.model.js";

export const sendMessage = async (req, res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập tin nhắn",
            });
        }

        // Kiểm tra người nhận có tồn tại
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người nhận",
            });
        }

        // Tìm hoặc tạo cuộc trò chuyện
        let conversation = await Conversation.findOne({
            members: { $all: [senderId, receiverId] },
        });

        if (!conversation) {
            conversation = new Conversation({
                members: [senderId, receiverId],
            });
            await conversation.save();
        }

        // Tạo tin nhắn mới
        const newMessage = await Message.create({
            receiverId,
            senderId,
            message,
        });

        // Thêm tin nhắn vào cuộc trò chuyện
        conversation.messages.push(newMessage._id);
        await Promise.all([conversation.save(), newMessage.save()]);

        // Lấy thông tin người gửi để gửi kèm socket
        const sender = await User.findById(senderId).select("fullname username profilePicture");
        //Tạo thông báo cho người nhận
        const notification = new Notification({
            sender: senderId,
            receiver: receiverId,
            type: "message",
            content: "Bạn có tin nhắn mới từ " + sender.fullname,
            link: conversation._id
        });
        // Gửi tin nhắn qua socket
        const receiverSockets = getReciverSocketIds(receiverId);
        if (receiverSockets.length > 0) {
            receiverSockets.forEach(socketId => {
                io.to(socketId).emit("newMessage", {
                    message: newMessage,
                    sender: {
                        _id: sender._id,
                        fullname: sender.fullname,
                        username: sender.username,
                        profilePicture: sender.profilePicture
                    },
                    conversationId: conversation._id,
                    timestamp: new Date()
                });
            });
        }

        return res.status(201).json({
            success: true,
            message: newMessage,
        });
    } catch (error) {
        console.log("Error in sendMessage controller:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server: Không thể gửi tin nhắn",
            error: error.message,
        });
    }
};

export const getMessages = async (req, res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;

        // Kiểm tra người dùng tồn tại
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy người nhận",
            });
        }

        const conversation = await Conversation.findOne({
            members: { $all: [senderId, receiverId] },
        });

        if (!conversation) {
            return res.status(200).json({
                success: true,
                messages: [],
            });
        }

        // Populate đầy đủ thông tin
        await conversation.populate([
            {
                path: "messages",
                populate: {
                    path: "senderId",
                    select: "_id fullname username profilePicture",
                }
            },
            {
                path: "members",
                select: "_id fullname username profilePicture"
            }
        ]);

        // Đánh dấu tin nhắn đã đọc nếu cần
        const unreadMessages = conversation.messages.filter(
            msg => !msg.read && msg.senderId._id.toString() !== senderId
        );

        if (unreadMessages.length > 0) {
            await Message.updateMany(
                {
                    _id: { $in: unreadMessages.map(msg => msg._id) }
                },
                { $set: { read: true } }
            );

            // Thông báo cho người gửi biết tin nhắn đã được đọc
            const senderSockets = getReciverSocketIds(senderId);
            if (senderSockets.length > 0) {
                senderSockets.forEach(socketId => {
                    io.to(socketId).emit("messagesRead", {
                        conversationId: conversation._id,
                        readBy: senderId
                    });
                });
            }
        }

        return res.status(200).json({
            success: true,
            messages: conversation.messages,
            conversation: {
                _id: conversation._id,
                members: conversation.members
            }
        });
    } catch (error) {
        console.log("Error in getMessages controller:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server: Không thể lấy tin nhắn",
            error: error.message,
        });
    }
};
//[GET] /api/messages/Person
// [GET] /api/messages/Person
export const getPerson = async (req, res) => {
    try {
        const userId = req.id;

        // Tìm các cuộc trò chuyện của người dùng hiện tại
        const conversations = await Conversation.find({
            members: userId
        })
            .sort({ updatedAt: -1 }) // Sắp xếp theo thời gian cập nhật mới nhất
            .populate({
                path: 'members',
                select: 'username fullname profilePicture lastActiveAt' // Lấy thêm lastActiveAt
            });

        // Lọc thông tin và chỉ giữ lại người nhắn tin cùng và thời gian nhắn tin cuối
        const filteredConversations = await Promise.all(conversations.map(async (conversation) => {
            const otherMember = conversation.members.find(member => member._id.toString() !== userId); // Lấy thông tin người kia
            if (otherMember) {
                // Lấy 50 tin nhắn gần nhất giữa người dùng và người kia
                const messages = await Message.find({
                    conversationId: conversation._id,
                    $or: [
                        { sender: userId },
                        { sender: otherMember._id }
                    ]
                })
                    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tin nhắn
                    .limit(50); // Giới hạn lấy 50 tin nhắn gần nhất

                // Đếm số tin nhắn chưa đọc của người đó
                const unreadMessagesCount = messages.filter(message =>
                    message.isRead === false && message.sender.toString() !== userId // Kiểm tra tin nhắn chưa đọc từ người khác
                ).length;

                return {
                    _id: conversation._id,
                    lastMessageTime: conversation.updatedAt,
                    lastActiveAt: otherMember.lastActiveAt, // Thêm thông tin lastActiveAt
                    member: otherMember,
                    unreadMessagesCount: unreadMessagesCount // Thêm số lượng tin nhắn chưa đọc
                };
            }
        }));

        // Lọc ra những cuộc trò chuyện hợp lệ và không có lỗi
        const validConversations = filteredConversations.filter(conversation => conversation && conversation.member);

        res.status(200).json({
            success: true,
            message: 'Danh sách người đã trò chuyện',
            conversations: validConversations
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

//[GET] /api/messages/Search
// Tìm kiếm người dùng để nhắn tin, ưu tiên hiển thị những người đã nhắn tin gần đây (tối đa 20 người)
export const searchUsers = async (req, res) => {
    try {
        const userId = req.id;
        const { keyword } = req.query;

        // Tìm kiếm người dùng theo username hoặc fullname
        const users = await User.find({
            $or: [
                { username: { $regex: keyword, $options: 'i' } },
                { fullname: { $regex: keyword, $options: 'i' } }
            ]
        }).select('username fullname profilePicture lastActiveAt');

        // Tìm các cuộc trò chuyện của người dùng hiện tại, sắp xếp theo thời gian cập nhật mới nhất
        const conversations = await Conversation.find({
            members: userId
        })
            .sort({ updatedAt: -1 }) // Sắp xếp theo thời gian cập nhật mới nhất
            .populate({ path: 'members', select: 'username fullname profilePicture lastActiveAt' });

        // Lọc danh sách những người đã nhắn tin gần đây
        const recentContacts = conversations.map(conversation => {
            const otherMember = conversation.members.find(member => member._id.toString() !== userId); // Lấy thông tin người kia
            if (otherMember) {
                return {
                    _id: otherMember._id,
                    username: otherMember.username,
                    fullname: otherMember.fullname,
                    profilePicture: otherMember.profilePicture,
                    lastActiveAt: otherMember.lastActiveAt,
                    lastMessageTime: conversation.updatedAt // Thêm thời gian của tin nhắn gần đây
                };
            }
        }).filter(contact => contact); // Loại bỏ nếu không có thành viên khác

        // Lọc danh sách người dùng từ kết quả tìm kiếm và sắp xếp ưu tiên người đã nhắn tin gần đây
        const filteredUsers = users.map(user => {
            // Kiểm tra nếu người dùng này có trong các cuộc trò chuyện gần đây
            const recentContact = recentContacts.find(contact => contact._id.toString() === user._id.toString());
            return {
                ...user.toObject(),
                lastMessageTime: recentContact ? recentContact.lastMessageTime : null // Thêm thời gian tin nhắn gần đây nếu có
            };
        });

        // Sắp xếp người dùng đã tìm kiếm dựa trên thời gian tin nhắn gần đây (nếu có)
        filteredUsers.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        // Giới hạn tối đa 20 người
        const limitedUsers = filteredUsers.slice(0, 20);

        res.status(200).json({
            success: true,
            message: 'Danh sách người dùng tìm kiếm',
            users: limitedUsers
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
// [PATCH] /api/messages/Read/:id
// [PATCH] /api/messages/Read/:id
export const readMessages = async (req, res) => {
    try {
        const userId = req.id;
        const otherUserId = req.params.id; // ID người đối diện (người bạn muốn đọc tin nhắn với)

        // Tìm cuộc trò chuyện giữa người dùng và người kia
        const conversation = await Conversation.findOne({
            members: { $all: [userId, otherUserId] }
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Cuộc trò chuyện không tồn tại'
            });
        }

        // Tìm tất cả các tin nhắn trong cuộc trò chuyện, sắp xếp theo thứ tự mới nhất
        const messages = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: -1 }); // Sắp xếp tin nhắn từ mới đến cũ

        // Duyệt qua các tin nhắn và cập nhật trạng thái đã đọc
        let updatedMessages = 0;
        for (const message of messages) {
            if (message.receiverId.toString() === userId && !message.read) {
                // Cập nhật trạng thái tin nhắn chưa đọc thành đã đọc
                await Message.updateOne(
                    { _id: message._id },
                    { $set: { isRead: true } }
                );
                updatedMessages++;
            } else if (message.read) {
                // Nếu gặp phải tin nhắn đã đọc thì ngừng cập nhật
                break;
            }
        }

        if (updatedMessages > 0) {
            res.status(200).json({
                success: true,
                message: `Đã đọc ${updatedMessages} tin nhắn`
            });
        } else {
            res.status(200).json({
                success: true,
                message: 'Không có tin nhắn chưa đọc'
            });
        }
    } catch (error) {
        console.error('Error reading messages:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
