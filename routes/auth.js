const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// Middleware to authenticate the token
const auth = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", ""); // Remove 'Bearer ' prefix
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.userId; // Attach userId to request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    const userId = req.user;  // Extracted from token after authentication
    User.findById(userId)
        .then(user => {
            if (user.role !== 'admin') {
                return res.status(403).json({ message: 'Access denied' });
            }
            next(); // Proceed to next middleware or route handler
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ message: 'Server Error' });
        });
};

// Register a new user
router.post("/register", async (req, res) => {
  const { name, email, password, phonenumber, refferalcode, how  } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    user = new User({ name, email, password, phonenumber, refferalcode, how, balance: 0, role: 'customer' });
    await user.save();

    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(201).json({ token, payload });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Login user
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // Directly compare password (no hashing)
    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const payload = { userId: user.id };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, payload: payload });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// Endpoint to get user profile
router.get("/me", auth, async (req, res) => {
  try {
    // Find the user by the userId from the JWT token
    const user = await User.findById(req.user).select("-password"); // Exclude password from the response
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user); // Return the user profile data
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET endpoint to fetch all users (admin only)
router.get('/admin/users', auth, isAdmin, async (req, res) => {
    try {
        // Fetch all users (excluding sensitive data like passwords)
        const users = await User.find()  // Use .select('-password') to exclude passwords from the response
        res.json({ users });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
// Admin can edit a user's newBalanceValue
router.put('/admin/edit-task/:userId', auth, isAdmin, async (req, res) => {
    const { userId } = req.params; // User ID from URL params
    const { newBalanceValue } = req.body;     // New newBalanceValue value from request body

    try {
        // Check if the newBalanceValue value is valid
        if (newBalanceValue === undefined) {
            return res.status(400).json({ message: 'newBalanceValue value is required' });
        }

        // Find the user and update the newBalanceValue value
        const user = await User.findByIdAndUpdate(
            userId,
            { balance: newBalanceValue },
            { new: true } // Return the updated user document
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'newBalanceValue updated successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
