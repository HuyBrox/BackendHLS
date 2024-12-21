import Sound from '../models/sound.model.js';
import { uploadAudio, deleteMediaById } from '../helper/uploadMedia.js';

export const uploadSound = async (req, res) => {
    try {
        const { name, singerName, singerAvatar } = req.body; // Lấy thông tin từ body request
        const audioFile = req.file; // Lấy tệp âm thanh từ request

        if (!audioFile) {
            return res.status(400).json({
                success: false,
                message: "Không có tệp âm thanh nào để tải lên",
            });
        }

        // Upload file âm thanh và lấy URL
        const soundUrl = await uploadAudio(audioFile);

        // Tạo bản ghi âm thanh mới với các thuộc tính từ schema
        const newSound = new Sound({
            name,
            url: soundUrl,
            singerName: singerName,
            singerAvatar: singerAvatar,
        });

        // Lưu vào cơ sở dữ liệu
        await newSound.save();

        // Trả về phản hồi thành công
        return res.status(201).json({
            success: true,
            message: "Tải lên âm thanh thành công",
            sound: newSound,
        });
    } catch (error) {
        console.error('Error in uploadSound:', error);
        return res.status(500).json({
            success: false,
            message: "Đã xảy ra lỗi trong quá trình xử lý yêu cầu",
        });
    }
};


// Xóa âm thanh
export const deleteSound = async (req, res) => {
    try {
        const soundId = req.params.soundId;

        if (!soundId) {
            return res.status(400).json({ success: false, message: "chưa nhập ID của âm thanh" });
        }

        const sound = await Sound.findById(soundId);

        if (!sound) {
            return res.status(404).json({ success: false, message: "Không tìm thấy âm thanh" });
        }


        // Xóa âm thanh khỏi Cloudinary
        deleteMediaById(sound.url.split('/').pop().split('.')[0], 'video');

        await sound.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Xóa âm thanh thành công",
        });
    } catch (error) {
        console.error('Error in deleteSound:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Có lỗi xảy ra khi xóa âm thanh"
        });
    }
};
//lấy danh sách nhạc
export const getSounds = async (req, res) => {
    try {
        const sounds = await Sound.find();
        return res.status(200).json({
            success: true,
            message: 'Danh sách âm thanh',
            sounds
        });
    } catch (error) {
        console.error('Error in getSounds:', error);
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra khi lấy danh sách âm thanh" });
    }
};
//tìm kiếm nhạc [GET] /searchSound?keyword=abc
export const searchSounds = async (req, res) => {
    try {
        const { keyword } = req.query;
        const sounds = await Sound.find({
            $or: [
                { name: { $regex: keyword, $options: 'i' } },
                { singerName: { $regex: keyword, $options: 'i' } },
            ],
        });

        return res.status(200).json({
            success: true,
            message: `Tìm thấy ${sounds.length} kết quả cho từ khóa "${keyword}"`,
            sounds,
        });
    } catch (error) {
        console.error('Error in searchSounds:', error);
        return res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi tìm kiếm âm thanh',
        });
    }
};
