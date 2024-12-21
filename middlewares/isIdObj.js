import mongoose from 'mongoose';

export const isIdObj = (...ids) => {
    try {
        return (req, res, next) => {
            for (const id of ids) {
                const value = req.params[id];
                if (!mongoose.Types.ObjectId.isValid(value)) {
                    return res.status(400).json({
                        success: false,
                        message: `${id} không hợp lệ`,
                    });
                }
            }
            next();
        };
    } catch (error) {
        console.error('Lỗi kiểm tra ID:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server: Không thể kiểm tra ID',
        });
    }
};
