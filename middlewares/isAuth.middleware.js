import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
    try {
        // Kiểm tra token từ nhiều nguồn
        const token = 
            req.cookies.token || 
            req.headers.authorization?.replace('Bearer ', '');

        console.log('Received token:', token);
        
        if (!token) {
            return res.status(401).json({
                message: "Xác thực không hợp lệ",
                success: false,
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.id = decoded.userId;
            next();
        } catch (jwtError) {
            console.log('JWT verification error:', jwtError);
            return res.status(401).json({
                message: "Token không hợp lệ",
                success: false,
            });
        }
    } catch (error) {
        console.log('Auth error:', error);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false,
        });
    }
};

export default isAuth;
