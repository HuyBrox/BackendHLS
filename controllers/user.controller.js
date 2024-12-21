import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import getDatUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import Note from "../models/note.model.js";
import { sendOtp, verifyOtp } from '../helper/otp-generator.js';
import Follow from "../models/follow.model.js";
import Notification from "../models/notification.model.js";
import { getReciverSocketIds, io } from "../socket/socket.js";
//[GET] /
export const home = async (_, res) => {
    try {
        const users = await User.find().select("-password");
        return res.status(200).json({
            success: true,
            users,
        });
    } catch (error) {
        console.log(error);
    }
}
//[POST] /api/user/register
export const register = async (req, res) => {
    try {
        //lấy thông tin từ req.body
        const { fullname, username, email, password, otp } = req.body; // bỏ đi OTP
        if (!username || !email || !password || !fullname) {
            return res.status(400).json({
                message: "Vui lòng điền đầy đủ thông tin",
                success: false,
            });
        }//kiem tra ten người dùng
        // if (!otp) {
        //     return res.status(400).json({
        //         message: "Vui lòng nhập mã OTP",
        //         success: false,
        //     });
        // }
        const regexUsername = /^[a-zA-Z0-9_]+$/;
        const regexEmail = /^\S+@\S+\.\S+$/;
        if (!regexUsername.test(username)) {
            return res.status(400).json({
                message: "Tên người dùng khôn hợp lệ",
                success: false,
            })
        }
        if (!regexEmail.test(email)) {
            return res.status(400).json({
                message: "Email không hợp lệ",
                success: false,
            });
        }
        // Kiểm tra xem email hoặc username đã tồn tại chưa
        const user = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (user) {
            return res.status(400).json({
                message: "Email hoặc tên người dùng đã tồn tại",
                success: false,
            });
        }
        //xác thực email bằng OTP
        // const isOTP = await verifyOtp(email, otp);
        // if (!isOTP) {
        //     return res.status(400).json({
        //         message: "OTP không hợp lệ",
        //         success: false,
        //     });
        // }

        //mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 12);
        await User.create({
            fullname,
            username,
            email,
            password: hashedPassword,
        });
        //201 Created – Tài nguyên đã được tạo thành công trên máy chủ
        return res.status(201).json({
            message: "Đăng ký thành công",
            success: true,
        });
    } catch (error) {
        console.log(error);
    }
}
export const verifyOtpForRegistration = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                message: "Vui lòng cung cấp email và OTP",
                success: false,
            });
        }

        // Kiểm tra OTP
        const isOtpValid = await verifyOtp(email, otp);
        if (!isOtpValid) {
            return res.status(400).json({
                message: "OTP không hợp lệ",
                success: false,
            });
        }

        return res.status(200).json({
            message: "OTP hợp lệ",
            success: true,
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({
            message: "Lỗi server khi xác thực OTP",
            success: false,
        });
    }
};
//[POST] /api/user/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Vui lòng điền đầy đủ thông tin",
                success: false,
            });
        }
        let user = await User.findOne({ email }).populate({
            path: "featuredNote",
            select: "content"
        });
        if (!user) {
            return res.status(400).json({
                message: "Kiểm tra lại Email hoặc Password",
                success: false,
            });
        }
        //so sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        //400 Bad Request – Máy chủ không thể hoàn thành yêu cầu do cú pháp không chính xác
        if (!isMatch) {
            return res.status(400).json({
                message: "Mật khẩu không chính xác",
                success: false,
            });
        }
        user = {
            _id: user._id,
            fullname: user.fullname,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            followers: user.followers,
            following: user.following,
            posts: user.posts,
            bookmarks: user.bookmarks,
            featuredNote: user.featuredNote ? user.featuredNote.content : "",
        }
        //Tạo token - tham số đầu tiên là payload, tham số thứ 2 là secret key
        const token = await jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        return res.cookie("token", token, {
            httpOnly: true,     //cookie không thể được truy cập bằng mã JavaScript
            // secure: true,       //cookie chỉ được gửi khi có https
            sameSite: "strict", //cookie chỉ được gửi khi có cùng domain
            maxAge: 1 * 10 * 60 * 60 * 1000, //5h
        }).json({
            message: "Đăng nhập thành công",
            success: true,
            user,
        });
    } catch (error) {
        console.log(error);
    }
}
//[GET] /api/user/logout
export const logout = async (_, res) => {
    try {
        return res.clearCookie("token", "", { maxAge: 0 }).json({
            message: "Đăng xuất thành công",
            success: true,
        });
    } catch (error) {
        console.log(error);
    }
}
//[GET] /api/:id
//lấy thông tin trang cá nhân
export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(userId)
        const user = await User.findById(userId).select("-password").populate({
            path: "featuredNote",
            select: "content"
        });

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        console.log(error);
    }
}
//[SET] /api/profile
//cập nhật thông tin trang cá nhân - chỉ của chính user đã đăng nhập
export const setProfile = async (req, res) => {
    try {
        const userId = req.id;
        const { bio, gender } = req.body;
        const profilePicture = req.file;
        let cloudResponse;
        //nếu có ảnh đại diện thì upload lên cloudinary
        if (profilePicture) {
            //chuyển file thành base64
            const fileUri = getDatUri(profilePicture);
            //upload lên cloudinary
            cloudResponse = await cloudinary.uploader.upload(fileUri);
        }
        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy user",
                success: false,
            });
        }
        //nếu có bio thì cập nhật
        if (bio !== undefined) user.bio = bio;
        if (gender) user.gender = gender;
        if (cloudResponse) user.profilePicture = cloudResponse.url;
        await user.save();

        //200 OK – Máy chủ đã xử lý thành công yêu cầu
        return res.status(200).json({
            message: "Cập nhật thành công",
            success: true,
            user,
        });

    } catch (error) {
        console.log(error);
    }
}
//[GET] suggested user (người dùng gợi ý)
export const suggestedUser = async (req, res) => {
    try {
        const suggestedUsers = await User.find({ _id: { $ne: req.id } }).select("-password").limit(20);
        if (!suggestedUsers) {
            return res.status(404).json({
                message: "Không có user nào",
                success: false,
            });
        }
        return res.status(200).json({
            success: true,
            users: suggestedUsers,
        });
    }
    catch (error) {
        console.log(error);
    }
}
//follow or unfollow
export const followOrUnfollow = async (req, res) => {
    try {
        const followKrneWala = req.id; // Người thực hiện hành động
        const jiskoFollowKrunga = req.params.id; // Người được theo dõi hoặc hủy theo dõi
        if (followKrneWala === jiskoFollowKrunga) {
            return res.status(400).json({
                message: 'Không thể theo dõi chính mình',
                success: false,
            });
        }
        // Tìm người dùng theo dõi và người dùng được theo dõi
        const user = await User.findById(followKrneWala);
        const targetUser = await User.findById(jiskoFollowKrunga);

        if (!user || !targetUser) {
            return res.status(400).json({
                message: 'User not found',
                success: false,
            });
        }

        // Kiểm tra xem người dùng hiện tại đã theo dõi người kia chưa
        const isFollowing = user.following.includes(jiskoFollowKrunga);

        if (isFollowing) {
            // Nếu đã theo dõi, thực hiện hủy theo dõi
            await Promise.all([
                User.updateOne(
                    { _id: followKrneWala },
                    { $pull: { following: jiskoFollowKrunga } }
                ),
                User.updateOne(
                    { _id: jiskoFollowKrunga },
                    { $pull: { followers: followKrneWala } }
                ),
            ]);
            return res.status(200).json({
                message: 'Unfollow successfully',
                success: true,
            });
        } else {
            // Nếu chưa theo dõi, thực hiện theo dõi
            //khi có nhiều hơn 1 tác vụ cần thực hiện cùng 1 lúc thì sử dụng Promise.all
            await Promise.all([
                User.updateOne(
                    { _id: followKrneWala },
                    { $push: { following: jiskoFollowKrunga } }
                ),
                User.updateOne(
                    { _id: jiskoFollowKrunga },
                    { $push: { followers: followKrneWala } }
                ),
            ]);
            return res.status(200).json({
                message: 'Follow successfully',
                success: true,
            });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: 'Internal server error',
            success: false,
        });
    }
};
//[DELETE] /api/user/deleteAvatar
export const deleteAvatar = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId).select("profilePicture");
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy user",
                success: false,
            });
        }
        user.profilePicture = "https://www.kindpng.com/picc/m/22-223863_no-avatar-png-circle-transparent-png.png";
        await user.save();
        return res.status(200).json({
            message: "Xóa ảnh đại diện thành công",
            success: true,
        });
    }
    catch (error) {
        console.log(error);
    }
}
//[delete] /api/user/featuredNote
export const deleteFeaturedNote = async (req, res) => {
    const userId = req.id;
    const user = await User.findOne({ _id: userId });
    if (!user) {
        return res.status(404).json({
            message: "Không tìm thấy user",
            success: false,
        });
    }

    user.featuredNote = null;
    await user.save();
    return res.status(200).json({
        message: "Xóa featured note",
        success: true,
    });
}

//[POST] /api/user/featuredNote
export const postFeaturedNote = async (req, res) => {
    try {
        const userId = req.id;
        const { featuredNote } = req.body;

        // Kiểm tra xem user có tồn tại không
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy user",
                success: false,
            });
        }

        // Kiểm tra nếu không có nội dung
        if (!featuredNote || featuredNote.trim() === '') {
            return res.status(400).json({
                message: "Vui lòng điền featured note",
                success: false,
            });
        }

        // Kiểm tra độ dài của nội dung
        if (featuredNote.length > 60) {
            return res.status(400).json({
                message: "Featured note không được quá 60 ký tự",
                success: false,
            });
        }

        const note = await Note.create({ content: featuredNote, author: userId });
        await note.save();
        user.featuredNote = note._id;
        await user.save();


        return res.status(200).json({
            message: "Cập nhật featured note thành công",
            success: true,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Có lỗi xảy ra khi cập nhật featured note",
            success: false,
        });
    }
};
//[GET] /api/user/followers/:id
export const getFollowers = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy user",
                success: false,
            });
        }
        const followers = await User.find({ _id: { $in: user.followers } }).select("-password");
        return res.status(200).json({
            success: true,
            followers,
        });
    }
    catch (error) {
        console.log(error);
    }
}
//[GET] /api/user/following/:id
export const getFollowing = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy user",
                success: false,
            });
        }
        const following = await User.find({ _id: { $in: user.following } }).select("-password");
        return res.status(200).json({
            success: true,
            following,
        });
    }
    catch (error) {
        console.log(error);
    }
}
//[DELETE] /api/user/deleteFollower/:id
export const deleteFollower = async (req, res) => {
    try {
        const userId = req.id;
        const followerId = req.params.id;


        const user = await User.findById(userId);
        const follower = await User.findById(followerId);
        if (!user || !follower) {
            return res.status(404).json({
                message: "Không tìm thấy user hoặc follower",
                success: false,
            });
        }
        Promise.all([
            User.updateOne({ _id: userId }, { $pull: { followers: followerId } }),
            User.updateOne({ _id: followerId }, { $pull: { following: userId } }),
        ]);
        res.status(200).json({
            message: 'Xóa thành công người theo dõi',
            success: true
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
// [POST] /api/user/sendOtp
export const sendOtpToEmail = async (req, res) => {
    try {
        const id = req.id;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                message: "User not found",
                success: false,
            });
        }

        // Gửi OTP qua email mà không trả lại OTP
        await sendOtp(user.email); // Gửi OTP và lưu vào cơ sở dữ liệu
        const [localPart, domain] = user.email.split("@"); // Tách phần tên và phần domain

        // Tạo phần ẩn với số lượng ký tự * dựa vào độ dài của localPart
        const maskedLocalPart = localPart[0] + "*".repeat(localPart.length - 2) + localPart.slice(-1);

        const maskedEmail = `${maskedLocalPart}@${domain}`; // Kết hợp lại

        return res.status(200).json({
            message: `OTP đã được gửi đến email ${maskedEmail}`,
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Đã xảy ra lỗi',
            success: false,
        });
    }
}
//[POST] gửi otp để đăng ký (chưa có tài khoản)
export const sendOtpToEmailRegister = async (req, res) => {
    try {
        const { email } = req.body;
        await sendOtp(email); // Gửi OTP và lưu vào cơ sở dữ liệu
        if (!email) {
            return res.status(400).json({
                message: 'Vui lòng nhập email',
                success: false,
            });
        }
        return res.status(200).json({
            message: `OTP đã được giửi đến email ${email}`,
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Đã xảy ra lỗi',
            success: false,
        });
    }
}
// [PATCH] /api/user/changePassword
export const changePassword = async (req, res) => {
    try {
        const id = req.id;
        const { password, newPassword, otp } = req.body;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                message: "Người dùng không tồn tại",
                success: false,
            });
        }
        const email = user.email;
        // Kiểm tra mật khẩu cũ
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Mật khẩu cũ không chính xác',
                success: false,
            });
        }

        // Kiểm tra OTP
        const isOTP = await verifyOtp(email, otp);
        if (!isOTP) {
            return res.status(400).json({
                message: 'OTP không hợp lệ',
                success: false,
                passwordSuccess: true,
            });
        }

        // Mã hóa mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();
        //Tạo thông báo hệ thống
        const receiverSocketIds = getReciverSocketIds(id);
        io.to(receiverSocketIds).emit("system", {
            sender: "Hệ thống",
            message: "Bạn đã thay đổi mật khẩu lúc " + new Date().toLocaleString(),
        });
        //Lưu thông báo vào db:
        const notification = new Notification({
            sender: "Hệ thống",
            receiver: id,
            type: "system",
            content: "Bạn đã thay đổi mật khẩu lúc " + new Date().toLocaleString(),
        });
        await notification.save();


        return res.status(200).json({
            message: 'Đổi mật khẩu thành công',
            success: true,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Xảy ra lỗi',
            success: false,
        });
    }
}
//===================================NÂNNG CẤP XỬ LÍ FOLLOW THEO CÁCH MỚI===========================================

// [POST] /api/user/follow/:id
export const sendFollow = async (req, res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;

        if (!receiverId) {
            return res.status(400).json({ message: "Người nhận không hợp lệ", success: false });
        }

        if (senderId === receiverId) {
            return res.status(400).json({ message: "Bạn không thể tự theo dõi chính mình", success: false });
        }

        const existingRequest = await Follow.findOne({ follower: senderId, following: receiverId });
        if (existingRequest) {
            return res.status(400).json({ message: "Yêu cầu follow đã tồn tại", success: false });
        }

        const followRequest = new Follow({
            follower: senderId,
            following: receiverId,
            status: "pending"
        });
        await followRequest.save();

        // Gửi thông báo real-time qua socket

        const sender = await User.findById(senderId).select("fullname profilePicture");

        const receiverSocketIds = getReciverSocketIds(receiverId);

        //Lưu thông báo vào db:
        const link = `/profile/${senderId}`;
        const notification = new Notification({
            sender: sender,
            receiver: receiverId,
            type: "follow",
            content: `${sender.fullname} đã gửi yêu cầu follow`,
            link,
        });
        io.to(receiverSocketIds).emit("follow-request", notification);

        await notification.save();

        res.status(200).json({ message: "Yêu cầu follow đã được gửi", success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Lỗi hệ thống", success: false });
    }
};

// [DELETE] /api/user/cancelFollow/:id
export const cancelFollow = async (req, res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;

        const followRequest = await Follow.findOneAndDelete({
            follower: senderId,
            following: receiverId,
            status: "pending",
        });

        if (!followRequest) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu follow để hủy", success: false });
        }

        res.status(200).json({ message: "Đã hủy yêu cầu follow", success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Lỗi hệ thống", success: false });
    }
};

// [POST] /api/user/acceptFollow/:id
export const acceptFollowRequest = async (req, res) => {
    try {
        const receiverId = req.id;
        const senderId = req.params.id;

        const followRequest = await Follow.findOneAndUpdate(
            { follower: senderId, following: receiverId, status: "pending" },
            { status: "accepted" }
        );

        if (!followRequest) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu follow để xác nhận", success: false });
        }

        res.status(200).json({ message: "Yêu cầu follow đã được chấp nhận", success: true });
        //thông báo cho người theo dõi

        const receiver = await User.findById(receiverId).select("fullname profilePicture");
        const receiverSocketIds = getReciverSocketIds(senderId);

        const link = `/profile/${receiverId}`;
        //Lưu thông báo vào db:
        const notification = new Notification({
            sender: receiver,
            receiver: senderId,
            type: "follow",
            content: `${receiver.fullname} đã chấp nhận yêu cầu follow`,
            link,
        });
        io.to(receiverSocketIds).emit("follow-accept", notification);
        await notification.save();
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Lỗi hệ thống", success: false });
    }
};

// [DELETE] /api/user/rejectFollow/:id
export const rejectFollow = async (req, res) => {
    try {
        const receiverId = req.id;
        const senderId = req.params.id;

        const followRequest = await Follow.findOneAndDelete({
            follower: senderId,
            following: receiverId,
            status: "pending",
        });

        if (!followRequest) {
            return res.status(404).json({ message: "Không tìm thấy yêu cầu follow để từ chối", success: false });
        }
        res.status(200).json({ message: "Yêu cầu follow đã bị từ chối", success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Lỗi hệ thống", success: false });
    }
};
// [POST] Bật/Tắt tài khoản riêng tư
export const togglePrivate = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId);


        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy người dùng",
                success: false,
            });
        }

        // Đảo trạng thái của tài khoản riêng tư
        user.private = !user.private;

        await user.save();

        return res.status(200).json({
            message: `Tài khoản của bạn đã được chuyển sang trạng thái ${user.private ? "riêng tư" : "công khai"}.`,
            success: true,
            private: user.private,
        });
    } catch (error) {

        return res.status(500).json({
            message: "Đã xảy ra lỗi khi thay đổi trạng thái tài khoản.",
            success: false,
            error: error.message,
        });
    }
};





