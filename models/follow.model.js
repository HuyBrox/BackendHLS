// Follow schema
import mongoose from "mongoose";

const followSchema = new mongoose.Schema({
    follower: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", required: true
    }, // Người gửi yêu cầu
    following: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", required: true
    }, // Người được gửi yêu cầu
    status: {
        type: String,
        enum: ["pending", "accepted"],
        default: "pending"
    }, // Trạng thái
    createdAt: {
        type: Date,
        default: Date.now
    },
});
const Follow = mongoose.model("Follow", followSchema);
export default Follow;
