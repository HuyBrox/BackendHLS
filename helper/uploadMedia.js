import sharp from 'sharp';
import { Readable } from 'stream'; //để chuyển buffer thành stream để upload lên cloudinary
import cloudinary from '../utils/cloudinary.js';
import ffmpeg from 'fluent-ffmpeg';


// Hàm chuyển đổi buffer thành stream
function bufferToStream(buffer) {
    const stream = new Readable();
    stream._read = () => { };
    stream.push(buffer);
    stream.push(null);
    return stream;
}

// Hàm tạo mã không trùng
function generateUniqueId() {
    const uniquePart = Math.random().toString(36).substr(2, 9);
    return `media_${Date.now()}_${uniquePart}`;
}

// Hàm upload hình ảnh
export const uploadImage = async (media) => {
    const optimizedImgBuffer = await sharp(media.buffer)
        .resize({ width: 500, height: 500, fit: 'inside' })
        .toFormat("jpeg", { quality: 80 })
        .toBuffer();

    const cloudinaryResponse = await cloudinary.uploader.upload(`data:image/jpeg;base64,${optimizedImgBuffer.toString('base64')}`, {
        resource_type: 'image',
        public_id: generateUniqueId(),
    });

    return cloudinaryResponse.secure_url;
};

// Hàm upload video
export const uploadVideo = async (media) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: 'video',
            public_id: generateUniqueId(),
            eager: [
                { width: 1000, crop: "scale", quality: "auto:best", fetch_format: "auto" }
            ],
            eager_async: true
        }, (error, result) => {
            if (error) {
                reject(new Error(`Error uploading video to Cloudinary: ${error.message}`));
            } else {
                resolve(result.secure_url);
            }
        });

        const videoStream = bufferToStream(media.buffer);
        videoStream.pipe(uploadStream);
    });
};


// Hàm upload video và loại bỏ âm thanh
export const uploadVideoNoAudio = (media) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: 'video',
            public_id: generateUniqueId(),
            // Tắt âm thanh
            eager: [
                { width: 1000, crop: "scale", quality: "auto:best", fetch_format: "auto" }
            ],
            transformation: [
                { audio_codec: 'none' },
            ],
            eager_async: true // Để xử lý video không đồng bộ
        }, (error, result) => {
            if (error) {
                reject(new Error(`Error uploading video to Cloudinary: ${error.message}`));
            } else {
                resolve(result.secure_url);
            }
        });

        const videoStream = bufferToStream(media.buffer);
        videoStream.pipe(uploadStream);
    });
};


// Hàm upload âm thanh
export const uploadAudio = async (media) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({
            resource_type: 'auto',
            public_id: generateUniqueId(),
            format: 'mp3',
            transformation: [
                { quality: "auto:best" },
                { fetch_format: "auto" }
            ]
        }, (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                reject(new Error(`Error uploading audio to Cloudinary: ${error.message}`));
            } else {
                resolve(result.secure_url);
            }
        });

        const audioStream = bufferToStream(media.buffer);
        audioStream.pipe(uploadStream);
    });
};

// Hàm xóa media
export const deleteMediaById = async (publicId, resourceType) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
            if (error) {
                reject(new Error(`Error deleting media from Cloudinary: ${error.message}`));
            } else {
                resolve(result);
            }
        });
    });
};

