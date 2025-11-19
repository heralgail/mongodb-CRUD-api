const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; // Import for validation

const app = express();
// CRITICAL MODIFICATION: Use the port provided by the hosting environment (like Render) or default to 5000
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// CRITICAL MODIFICATION: Use environment variable for MongoDB connection URI for security
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://heragail:1234ian@cluster0.y2h57ud.mongodb.net/?appName=Cluster0"; 

// MongoDB Connection
mongoose.connect(MONGO_URI)
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); 
});

// =======================================================
// --- Schemas & Models ---
// =======================================================

// User Schema & Model (Existing)
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});
const User = mongoose.model("User", UserSchema);

// Product Schema & Model (NEW)
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true }, // e.g., 'assets/product-1.jpg'
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: 'Gemstone Jewelry', trim: true }
}, { timestamps: true });
const Product = mongoose.model("Product", ProductSchema);


// =======================================================
// --- API Routes for User Management (Existing) ---
// =======================================================

// 1. Admin Initial Setup (POST)
app.post("/api/admin/setup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
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

// 4. READ All Users (GET)
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select('-password -__v');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user data", details: err.message });
    }
});

// 5. UPDATE User (PUT)
app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body; 
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { name, email, role },
            { new: true, runValidators: true }
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
        res.status(200).json({ message: "User deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});

// =======================================================
// --- API Routes for Product Management (NEW) ---
// =======================================================

// 7. CREATE Product (POST) - Admin Only
app.post("/api/products", async (req, res) => {
    const { name, description, price, imageUrl, stock, category } = req.body;
    try {
        const newProduct = new Product({ name, description, price, imageUrl, stock, category });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ error: "Failed to create product", details: err.message });
    }
});

// 8. READ All Products (GET) - Public/Customer view (Replaces hardcoded list)
app.get("/api/products", async (req, res) => {
    try {
        // Fetch only products that are in stock
        const products = await Product.find({ stock: { $gt: 0 } }).select('-__v');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
});

// 9. UPDATE Product (PUT) - Admin Only
app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body; 

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Product ID format." });
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-__v');

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: "Failed to update product", details: err.message });
    }
});

// 10. DELETE Product (DELETE) - Admin Only
app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Product ID format." });
    }

    try {
        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(200).json({ message: "Product deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
});


// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
