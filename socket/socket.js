import { Server } from "socket.io";
import express from "express";
import http from "http";

import User from '../models/user.model.js';


const app = express();
const server = http.createServer(app);

const allowedOrigins = ["http://frontend-hls.vercel.app"];
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log(`CORS từ chối kết nối từ: ${origin}`)
                callback(new Error("Miền không được phép kết nối (CORS)"));
            }
        },
        methods: ["GET", "POST"],
    },
    pingInterval: 25000, // Thời gian ping interval (mặc định là 25000ms)
    pingTimeout: 60000, // Thời gian ping timeout (mặc định là 60000ms)
});
// //tạm thời chấp nhận tất cả các domain
// const io = new Server(server, { cors: { origin: "*" } });

// // Quản lý user online
// const userSocketMap = {};

// // Helper functions
// export const getReciverSocketIds = (userId) => userSocketMap[userId] || [];

// // Hàm cập nhật thời gian hoạt động cuối của người dùng
const updateLastActiveTime = async (userId) => {
    try {
        const currentTime = new Date();
        await User.findByIdAndUpdate(userId, { lastActiveAt: currentTime });
        // console.log(`Cập nhật thời gian hoạt động cuối cho người dùng ${userId}: ${currentTime}`);
    } catch (error) {
        console.error("Lỗi khi cập nhật thời gian hoạt động cuối: ", error);
    }
};

// const handleUserConnection = async (socket, userId) => {
//     const sockets = userSocketMap[userId] || [];
//     sockets.push(socket.id);
//     userSocketMap[userId] = sockets;

//     // Cập nhật thời gian hoạt động cuối khi người dùng kết nối
//     await updateLastActiveTime(userId);

//     console.log(`Người dùng kết nối: userId=${userId}, socketId=${socket.id}`);
//     io.emit("getOnlineUsers", Object.keys(userSocketMap));
// };

// const handleUserDisconnection = async (socket, userId) => {
//     if (userId) {
//         const sockets = userSocketMap[userId] || [];
//         const updatedSockets = sockets.filter((id) => id !== socket.id);
//         if (updatedSockets.length) {
//             userSocketMap[userId] = updatedSockets;
//         } else {
//             delete userSocketMap[userId];
//         }

//         // Cập nhật thời gian hoạt động cuối khi người dùng ngắt kết nối
//         await updateLastActiveTime(userId);

//         console.log(`Người dùng ngắt kết nối: userId=${userId}, socketId=${socket.id}`);
//         io.emit("getOnlineUsers", Object.keys(userSocketMap));
//     }
// };
const userSocketMap = {};

export const getReciverSocketIds = (userId) => {
    return userSocketMap[userId] ? Array.from(userSocketMap[userId]) : [];
};

const handleUserConnection = async (socket, userId) => {
    if (!userSocketMap[userId]) {
        userSocketMap[userId] = new Set();
    }
    userSocketMap[userId].add(socket.id);

    await updateLastActiveTime(userId);
    console.log(`Người dùng kết nối: userId=${userId}, socketId=${socket.id}`);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
};

const handleUserDisconnection = async (socket, userId) => {
    if (userSocketMap[userId]) {
        userSocketMap[userId].delete(socket.id);
        if (userSocketMap[userId].size === 0) {
            delete userSocketMap[userId];
        }
    }

    await updateLastActiveTime(userId);
    console.log(`Người dùng ngắt kết nối: userId=${userId}, socketId=${socket.id}`);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
};

// Chat handlers
const handleChatMessage = (socket, { receiverId, message, senderId }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    if (receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("newMessage", {
                senderId,
                message,
                timestamp: new Date()
            });
        });
    }
};

// Call handlers
const handleVideoCallRequest = (socket, { callerId, receiverId, callerName }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    if (receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("incomingCall", {
                callerId,
                callerName,
                callType: 'video'
            });
        });
    }
};

// Call handlers để xử lý cuộc gọi video và cuộc gọi thoại
const handleVoiceCallRequest = (socket, { callerId, receiverId, callerName }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    if (receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("incomingCall", {
                callerId,
                callerName,
                callType: 'voice'
            });
        });
    }
};

// Call handlers để xử lý cuộc gọi video và cuộc gọi thoại
const handleCallResponse = (socket, { callerId, receiverId, accepted }) => {
    const callerSockets = getReciverSocketIds(callerId);
    callerSockets.forEach(socketId => {
        io.to(socketId).emit("callResponse", {
            receiverId,
            accepted
        });
    });
};

// Notification handlers
const handleNotification = (socket, { receiverId, notification }) => {
    const receiverSockets = getReciverSocketIds(receiverId);
    if (receiverSockets.length > 0) {
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("notification", notification);
        });
    }
};

// Main socket connection handler dùng để xử lý các sự kiện socket ở phía client
io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (!userId) {
        console.log("Kết nối bị từ chối: Không có userId");
        socket.disconnect();
        return;
    }

    // Xử lý kết nối
    handleUserConnection(socket, userId);

    // Chat events
    socket.on("sendMessage", (data) => handleChatMessage(socket, data));

    // Call events
    socket.on("requestVideoCall", (data) => handleVideoCallRequest(socket, data));
    socket.on("requestVoiceCall", (data) => handleVoiceCallRequest(socket, data));
    socket.on("respondToCall", (data) => handleCallResponse(socket, data));

    // Notification events
    socket.on("sendNotification", (data) => {
        console.log("Nhận thông báo: ", data);
        handleNotification(socket, data);
    });
    // // Cập nhật sự kiện khi người gọi gửi Offer
    // socket.on("sendOffer", async (data) => {
    //     const receiverSockets = getReciverSocketIds(data.receiverId);
    //     if (receiverSockets.length > 0) {
    //         receiverSockets.forEach(socketId => {
    //             io.to(socketId).emit("receiveOffer", {
    //                 callerId: data.callerId,
    //                 offer: data.offer // Offer từ WebRTC
    //             });
    //         });
    //     } else {
    //         // Xử lý trường hợp receiver không online
    //         console.log(`Receiver ${data.receiverId} không trực tuyến`);
    //     }
    // });

    // // Cập nhật sự kiện khi người nhận gửi Answer
    // socket.on("sendAnswer", async (data) => {
    //     const callerSockets = getReciverSocketIds(data.callerId);
    //     if (callerSockets.length > 0) {
    //         callerSockets.forEach(socketId => {
    //             io.to(socketId).emit("receiveAnswer", {
    //                 receiverId: data.receiverId,
    //                 answer: data.answer // Answer từ WebRTC
    //             });
    //         });
    //     } else {
    //         // Xử lý trường hợp caller không online
    //         console.log(`Caller ${data.callerId} không trực tuyến`);
    //     }
    // });
    socket.on("sendOffer", async (data) => {
        const receiverSockets = getReciverSocketIds(data.receiverId);
        if (receiverSockets.length > 0) {
            receiverSockets.forEach(socketId => {
                io.to(socketId).emit("receiveOffer", {
                    callerId: data.callerId,
                    offer: data.offer
                });
            });
        } else {
            console.warn(`Receiver ${data.receiverId} không trực tuyến`);
            socket.emit("callError", { message: "Người nhận không trực tuyến." });
        }
    });

    socket.on("sendAnswer", async (data) => {
        const callerSockets = getReciverSocketIds(data.callerId);
        if (callerSockets.length > 0) {
            callerSockets.forEach(socketId => {
                io.to(socketId).emit("receiveAnswer", {
                    receiverId: data.receiverId,
                    answer: data.answer
                });
            });
        } else {
            console.warn(`Caller ${data.callerId} không trực tuyến`);
            socket.emit("callError", { message: "Người gọi không trực tuyến." });
        }
    });

    // Cập nhật sự kiện khi ICE Candidate được gửi
    socket.on("sendIceCandidate", async (data) => {
        const targetSockets = getReciverSocketIds(data.targetId);
        if (targetSockets.length > 0) {
            targetSockets.forEach(socketId => {
                io.to(socketId).emit("receiveIceCandidate", {
                    candidate: data.candidate // ICE Candidate từ WebRTC
                });
            });
        } else {
            console.log(`Target ${data.targetId} không trực tuyến`);
        }
    });

    // Disconnect handler
    socket.on("disconnect", (reason) => {
        console.log(`Người dùng ngắt kết nối: userId=${userId}, socketId=${socket.id}, lý do=${reason}`);
        handleUserDisconnection(socket, userId);
    });

    // Error handler
    socket.on("error", (err) => {
        console.error(`Lỗi socket: userId=${userId}, socketId=${socket.id}, lỗi=`, err);
    });
});

export { io, server, app };
// import { Server } from "socket.io";
// import express from "express";
// import http from "http";

// import User from '../models/user.model.js';

// const app = express();
// const server = http.createServer(app);

// const allowedOrigins = ["http://localhost:3000"];
// const io = new Server(server, {
//     cors: {
//         origin: (origin, callback) => {
//             if (!origin || allowedOrigins.includes(origin)) {
//                 callback(null, true);
//             } else {
//                 callback(new Error("Miền không được phép kết nối (CORS)"));
//             }
//         },
//         methods: ["GET", "POST"],
//     },
//     pingInterval: 25000, // Thời gian ping interval (mặc định là 25000ms)
//     pingTimeout: 60000, // Thời gian ping timeout (mặc định là 60000ms)
// });

// // Quản lý user online
// const userSocketMap = {};

// // Helper functions
// export const getReciverSocketIds = (userId) => userSocketMap[userId] || [];

// Hàm cập nhật thời gian hoạt động cuối của người dùng
// const updateLastActiveTime = async (userId) => {
//     try {
//         const currentTime = new Date();
//         await User.findByIdAndUpdate(userId, { lastActiveAt: currentTime });
//         console.log(`Cập nhật thời gian hoạt động cuối cho người dùng ${userId}: ${currentTime}`);
//     } catch (error) {
//         console.error("Lỗi khi cập nhật thời gian hoạt động cuối: ", error);
//     }
// };

// const handleUserConnection = async (socket, userId) => {
//     const sockets = userSocketMap[userId] || [];
//     sockets.push(socket.id);
//     userSocketMap[userId] = sockets;

//     // Cập nhật thời gian hoạt động cuối khi người dùng kết nối
//     await updateLastActiveTime(userId);

//     console.log(`Người dùng kết nối: userId=${userId}, socketId=${socket.id}`);
//     io.emit("getOnlineUsers", Object.keys(userSocketMap));
// };

// const handleUserDisconnection = async (socket, userId) => {
//     if (userId) {
//         const sockets = userSocketMap[userId] || [];
//         const updatedSockets = sockets.filter((id) => id !== socket.id);
//         if (updatedSockets.length) {
//             userSocketMap[userId] = updatedSockets;
//         } else {
//             delete userSocketMap[userId];
//         }

//         // Cập nhật thời gian hoạt động cuối khi người dùng ngắt kết nối
//         await updateLastActiveTime(userId);

//         console.log(`Người dùng ngắt kết nối: userId=${userId}, socketId=${socket.id}`);
//         io.emit("getOnlineUsers", Object.keys(userSocketMap));
//     }
// };

// // Chat handlers
// const handleChatMessage = (socket, { receiverId, message, senderId }) => {
//     const receiverSockets = getReciverSocketIds(receiverId);
//     if (receiverSockets.length > 0) {
//         receiverSockets.forEach(socketId => {
//             io.to(socketId).emit("newMessage", {
//                 senderId,
//                 message,
//                 timestamp: new Date()
//             });
//         });
//     }
// };

// // Call handlers
// const handleVideoCallRequest = (socket, { callerId, receiverId, callerName }) => {
//     const receiverSockets = getReciverSocketIds(receiverId);
//     if (receiverSockets.length > 0) {
//         receiverSockets.forEach(socketId => {
//             io.to(socketId).emit("incomingCall", {
//                 callerId,
//                 callerName,
//                 callType: 'video'
//             });
//         });
//     }
// };

// const handleVoiceCallRequest = (socket, { callerId, receiverId, callerName }) => {
//     const receiverSockets = getReciverSocketIds(receiverId);
//     if (receiverSockets.length > 0) {
//         receiverSockets.forEach(socketId => {
//             io.to(socketId).emit("incomingCall", {
//                 callerId,
//                 callerName,
//                 callType: 'voice'
//             });
//         });
//     }
// };

// // Call handlers để xử lý cuộc gọi video và cuộc gọi thoại
// const handleCallResponse = (socket, { callerId, receiverId, accepted }) => {
//     const callerSockets = getReciverSocketIds(callerId);
//     callerSockets.forEach(socketId => {
//         io.to(socketId).emit("callResponse", {
//             receiverId,
//             accepted
//         });
//     });
// };

// // Notification handlers
// const handleNotification = (socket, { receiverId, notification }) => {
//     const receiverSockets = getReciverSocketIds(receiverId);
//     if (receiverSockets.length > 0) {
//         receiverSockets.forEach(socketId => {
//             io.to(socketId).emit("notification", notification);
//         });
//     }
// };

// // Main socket connection handler dùng để xử lý các sự kiện socket ở phía client
// io.on("connection", (socket) => {
//     const userId = socket.handshake.query.userId;

//     if (!userId) {
//         console.log("Kết nối bị từ chối: Không có userId");
//         socket.disconnect();
//         return;
//     }

//     // Xử lý kết nối
//     handleUserConnection(socket, userId);

//     // Chat events
//     socket.on("sendMessage", (data) => handleChatMessage(socket, data));

//     // Call events
//     socket.on("requestVideoCall", (data) => handleVideoCallRequest(socket, data));
//     socket.on("requestVoiceCall", (data) => handleVoiceCallRequest(socket, data));
//     socket.on("respondToCall", (data) => handleCallResponse(socket, data));

//     // Cập nhật sự kiện kết thúc cuộc gọi
//     socket.on("endCall", async (data, callback) => { // Thêm callback
//         console.log(`Call ended by user ${data.userId}, call ID: ${data.callId}`);

//         try {
//             // Xác định người đối diện
//             const otherUserId = (data.callerId === data.userId) ? data.receiverId : data.callerId;
//             const otherUserSockets = getReciverSocketIds(otherUserId);

//             // Nếu người đối diện không online, return với thông báo
//             if (otherUserSockets.length === 0) {
//                 console.log(`Receiver ${otherUserId} không trực tuyến`);
//                 return callback({ success: false, message: 'Receiver is not online.' });
//             }

//             // Gửi thông báo chỉ đến người đối diện
//             otherUserSockets.forEach(socketId => {
//                 io.to(socketId).emit("callEnded", {
//                     callId: data.callId,
//                     endedBy: data.userId
//                 });
//             });

//             console.log('User notified about the call end.');
//             return callback({ success: true, message: 'Call ended successfully.' });
//         } catch (error) {
//             console.error('Error ending call:', error);
//             return callback({ success: false, message: 'An error occurred while ending the call.' });
//         }
//     });

//     // Notification events
//     socket.on("sendNotification", (data) => {
//         console.log("Nhận thông báo: ", data);
//         handleNotification(socket, data);
//     });

//     // Cập nhật sự kiện khi người gọi gửi Offer
//     socket.on("sendOffer", async (data, callback) => { // Thêm callback
//         const receiverSockets = getReciverSocketIds(data.receiverId);
//         if (receiverSockets.length === 0) {
//             console.log(`Receiver ${data.receiverId} không trực tuyến`);
//             return callback({ success: false, message: 'Receiver is not online.' });
//         }

//         receiverSockets.forEach(socketId => {
//             io.to(socketId).emit("receiveOffer", {
//                 callerId: data.callerId,
//                 offer: data.offer // Offer từ WebRTC
//             });
//         });

//         return callback({ success: true, message: 'Offer sent successfully.' });
//     });

//     // Cập nhật sự kiện khi người nhận gửi Answer
//     socket.on("sendAnswer", async (data, callback) => { // Thêm callback
//         const callerSockets = getReciverSocketIds(data.callerId);
//         if (callerSockets.length === 0) {
//             console.log(`Caller ${data.callerId} không trực tuyến`);
//             return callback({ success: false, message: 'Caller is not online.' });
//         }

//         callerSockets.forEach(socketId => {
//             io.to(socketId).emit("receiveAnswer", {
//                 receiverId: data.receiverId,
//                 answer: data.answer // Answer từ WebRTC
//             });
//         });

//         return callback({ success: true, message: 'Answer sent successfully.' });
//     });

//     // Cập nhật sự kiện khi ICE Candidate được gửi
//     socket.on("sendIceCandidate", async (data, callback) => { // Thêm callback
//         const targetSockets = getReciverSocketIds(data.targetId);
//         if (targetSockets.length === 0) {
//             console.log(`Target ${data.targetId} không trực tuyến`);
//             return callback({ success: false, message: 'Target is not online.' });
//         }

//         targetSockets.forEach(socketId => {
//             io.to(socketId).emit("receiveIceCandidate", {
//                 candidate: data.candidate // ICE Candidate từ WebRTC
//             });
//         });

//         return callback({ success: true, message: 'ICE Candidate sent successfully.' });
//     });

//     // Cập nhật sự kiện khi ICE Candidate được gửi
//     socket.on("sendIceCandidate", async (data, callback) => { // Thêm callback
//         const targetSockets = getReciverSocketIds(data.targetId);
//         if (targetSockets.length === 0) {
//             console.log(`Target ${data.targetId} không trực tuyến`);
//             return callback({ success: false, message: 'Target is not online.' });
//         }

//         targetSockets.forEach(socketId => {
//             io.to(socketId).emit("receiveIceCandidate", {
//                 candidate: data.candidate // ICE Candidate từ WebRTC
//             });
//         });

//         return callback({ success: true, message: 'ICE Candidate sent successfully.' });
//     });

//     // Disconnect handler
//     socket.on("disconnect", (reason) => {
//         console.log(`Người dùng ngắt kết nối: userId=${userId}, socketId=${socket.id}, lý do=${reason}`);
//         handleUserDisconnection(socket, userId);
//     });

//     // Error handler
//     socket.on("error", (err) => {
//         console.error(`Lỗi socket: userId=${userId}, socketId=${socket.id}, lỗi=`, err);
//     });
// });

// export { io, server, app };
