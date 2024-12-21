import mongoose from 'mongoose';

const soundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    singerName: {
        type: String,
        default: "Unknown",
    },
    singerAvatar: {
        type: String,
        default: "https://tophinhanhdep.com/wp-content/uploads/2021/10/Beautiful-Music-Wallpapers.jpg",
    },


}, { timestamps: true });

const Sound = mongoose.model('Sound', soundSchema);

export default Sound;
