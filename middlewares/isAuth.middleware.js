import jwt from "jsonwebtoken";
const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({
                message: "Xác thực không hợp lệ",
                success: false,
            });
        }
        //giải mã token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(401).json({
                message: "Token không hợp lệ",
                success: false,
            });
        }
        //biến userId được tạo khi tạo token bởi lần đăng nhập thành công trong phương thức jwt.sign
        req.id = decoded.userId;
        //tạo ra một biến id trong req trong middleware này để sử dụng trong controller
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false,
        });
    }
}
export default isAuth;