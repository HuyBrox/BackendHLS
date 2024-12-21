import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./utils/db.js";
import indexRouter from "./routes/index.route.js";
import { app, server } from "./socket/socket.js";
import { ExpressPeerServer } from "peer";

dotenv.config();
const PORT = process.env.PORT || 5000;

// Middleware cho parsing trước
app.use(express.json());
app.use(cookieParser());
app.use(urlencoded({ extended: true }));

// Cấu hình CORS
const corsOptions = {
    origin: ['https://hls-sand.vercel.app', 'https://hls-4kyfun5rm-huy-s-projects-492df757.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));

// Middleware CORS tùy chỉnh
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.header('Access-Control-Expose-Headers', 'Set-Cookie');
    next();
});

await connectDB();

// Endpoint kiểm tra kết nối server
app.get("/", (req, res) => {
    return res.status(200).json({
        message: "Kết nối thành công tới server",
        success: true,
    });
});


// Tích hợp PeerServer vào Express
const peerServer = ExpressPeerServer(server, {
    debug: true,       // Hiển thị thông tin debug
    path: '/peerjs'    // Đường dẫn API PeerJS
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
