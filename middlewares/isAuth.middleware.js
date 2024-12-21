import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        // Kiểm tra token từ nhiều nguồn
        const token = 
            req.cookies.token || 
            req.headers.authorization?.replace('Bearer ', '') ||
            req.headers['x-access-token'];

        console.log('Token received:', token);
        console.log('Cookies received:', req.cookies);
        console.log('Headers received:', req.headers);

        if (!token) {
            return res.status(401).json({
                message: "Không tìm thấy token xác thực",
                success: false,
            });
        }

        try {
            // Giải mã token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (!decoded) {
                return res.status(401).json({
                    message: "Token không hợp lệ",
                    success: false,
                });
            }

            // Thêm thông tin user vào request
            req.id = decoded.userId;
            req.user = decoded; // Lưu toàn bộ thông tin decoded nếu cần

            // Refresh token nếu gần hết hạn (optional)
            const tokenExp = decoded.exp * 1000; // Convert to milliseconds
            const now = Date.now();
            const timeUntilExp = tokenExp - now;
            
            // Nếu token sắp hết hạn (ví dụ: còn 1 giờ), tạo token mới
            if (timeUntilExp < 3600000) { // 1 hour
                const newToken = jwt.sign(
                    { userId: decoded.userId },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'none',
                    maxAge: 24 * 60 * 60 * 1000,
                    path: '/'
                });
            }

            next();
        } catch (jwtError) {
            console.log('JWT verification error:', jwtError);
            
            // Xóa cookie không hợp lệ
            res.clearCookie('token', {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path: '/'
            });

            return res.status(401).json({
                message: "Token không hợp lệ hoặc đã hết hạn",
                success: false,
                error: jwtError.message
            });
        }
    } catch (error) {
        console.log('Server error:', error);
        return res.status(500).json({
            message: "Lỗi server khi xác thực",
            success: false,
            error: error.message
        });
    }
};

export default isAuth;
