import mongoose from "mongoose";

const noteSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        max: 100,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    expireAt: { type: Date, index: { expires: '0s' } }
});

noteSchema.pre("save", function (next) {
    this.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ sau
    next();
});

const Note = mongoose.model('Note', noteSchema);
export default Note;