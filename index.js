import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./utils/db.js";
import indexRouter from "./routes/index.route.js";
import { app, server } from "./socket/socket.js";
import { ExpressPeerServer } from "peer"; // Import PeerServer

// Cấu hình dotenv để sử dụng biến môi trường
dotenv.config();

const PORT = process.env.PORT || 5000;

// Endpoint kiểm tra kết nối server
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Kết nối thành công tới server",
        success: true,
    });
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(urlencoded({ extended: true }));

await connectDB();
// Cấu hình CORS
const corsOptions = {
    origin: ['http://localhost:3000', 'http://hls-sand.vercel.app'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};
app.use(cors(corsOptions));

// Tích hợp PeerServer vào Express
const peerServer = ExpressPeerServer(server, {
    debug: true,       // Hiển thị thông tin debug
    path: '/peerjs',    // Đường dẫn API PeerJS
    allow_discovery: true, // Cho phép khám phá peer (nếu cần)
});

// Middleware sử dụng PeerServer
app.use('/peerjs', peerServer);  // Kích hoạt endpoint PeerJS

// Lắng nghe sự kiện peer connect và disconnect
peerServer.on('connection', (peer) => {
    console.log('Peer connected:', peer.id);
});

peerServer.on('disconnect', (peer) => {
    console.log('Peer disconnected:', peer.id);
});

// Sử dụng router chính
app.use("/api", indexRouter);

// Kết nối database và khởi động server
server.listen(PORT, async () => {

    console.log(`Server is running on port ${PORT}`);
});
