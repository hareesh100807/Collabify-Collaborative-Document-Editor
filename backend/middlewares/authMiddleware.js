import jwt from 'jsonwebtoken';
import UserModel from '../models/UserModel.js';

const authMiddleware = async (req, res, next) => {
    try {
        console.log("Cookies:", req.cookies); // Debugging line to check cookies
        //get token from cookies
        const token = req.cookies.token;
        //check token is present or not
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        //verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        //find user by id
        const user = await UserModel.findById(decoded.userId).select("-password");
        //check user is present or not
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        //attach user to request object
        req.user = user;
        req.userId = user._id; // Add userId for easier access in controllers
        //call next middleware
        next();
    } catch (error) {
        console.error('Error in authMiddleware:', error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

export default authMiddleware;