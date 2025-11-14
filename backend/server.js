const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; // Import for validation

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://heragail:1234ian@cluster0.y2h57ud.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); 
});

// --- Schema & Model ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});

const User = mongoose.model("User", UserSchema);

// --- API Routes for User Management (Admin CRUD) ---

// *********** AUTHENTICATION ROUTES ***********

// 1. Admin Initial Setup (POST) - One-time use to create 'admin@everglowgem.com'
app.post("/api/admin/setup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Check if an admin already exists to prevent misuse
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(403).json({ message: "Admin user already exists. Setup blocked." });
        }

        const newAdmin = new User({ name, email, password, role: 'admin' });
        await newAdmin.save();
        res.status(201).json({ message: "Admin user created successfully!", user: newAdmin });
    } catch (err) {
        res.status(500).json({ error: "Failed to create admin", details: err.message });
    }
});

// 2. Customer Sign-Up (Create - POST)
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Missing required fields (name, email, password)." });
    }
    try {
        const newUser = new User({ name, email, password, role: 'customer' });
        await newUser.save();
        res.status(201).json({ id: newUser._id, name: newUser.name, email: newUser.email });
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "This email address is already registered." });
        }
        res.status(500).json({ error: "Failed to create user account", details: err.message });
    }
});

// 3. Admin Login (POST)
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, role: 'admin' });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials or not an admin." });
        }
        res.json({ message: "Admin login successful", user: user.name });
    } catch (err) {
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});

// *********** ADMIN DASHBOARD CRUD ROUTES ***********

// 4. READ All Users (GET) - Used by the Admin Dashboard
app.get("/api/users", async (req, res) => {
    try {
        // Fetch ALL users (admins included, for management)
        const users = await User.find().select('-password -__v'); // Never send password!
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user data", details: err.message });
    }
});

// 5. UPDATE User (PUT)
app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body; 
    
    // Simple validation for ObjectId
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { name, email, role },
            { new: true, runValidators: true } // Return new document, enforce schema rules
        ).select('-password -__v');
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        
        res.json(updatedUser);
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "Email already exists." });
        }
        res.status(500).json({ error: "Failed to update user", details: err.message });
    }
});

// 6. DELETE User (DELETE)
app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }
    
    try {
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        // Send back the ID of the deleted user for frontend confirmation
        res.status(200).json({ message: "User deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));