import jwt from 'jsonwebtoken';
import UserModel from '../models/UserModel.js';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserModel.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }

        console.error("Error in authMiddleware:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export default authMiddleware;
