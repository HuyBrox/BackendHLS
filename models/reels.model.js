import mongoose from "mongoose";

const reelsSchema = new mongoose.Schema({
    caption: {
        type: String
    },
    urlVideo: {
        type: String,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    likes: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: []
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: `Comment`,
        }
    ],
    views: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }
    ],
}, { timestamps: true });

const Reels = mongoose.model('Reels', reelsSchema);
export default Reels;