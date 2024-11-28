const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const DepositRequest = require('../models/Deposit');
const WithdrawRequest  = require('../models/Withdraw');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // You can customize the storage path

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
  const userId = req.user; // Extracted from token after authentication
  User.findById(userId)
    .then((user) => {
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      next(); // Proceed to next middleware or route handler
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Server Error" });
    });
};

// Register a new user
router.post("/register", async (req, res) => {
  const { name, email, password, phonenumber, refferalcode, how } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    user = new User({
      name,
      email,
      password,
      phonenumber,
      refferalcode,
      how,
      balance: 0,
      role: "customer",
    });
    await user.save();

    const payload = { userId: user._id };
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
    const payload = { userId: user._id, userRole: user.role, _id: user._id };
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
router.get("/admin/users", auth, isAdmin, async (req, res) => {
  try {
    // Fetch all users (excluding sensitive data like passwords)
    const users = await User.find().select("-password"); // Use .select('-password') to exclude passwords from the response
    res.json({ users });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// Admin can edit a user's newBalanceValue
router.put("/admin/edit-task/:userId", auth, isAdmin, async (req, res) => {
  const { userId } = req.params; // User ID from URL params
  const { newBalanceValue } = req.body; // New newBalanceValue value from request body

  try {
    // Check if the newBalanceValue value is valid
    if (newBalanceValue === undefined) {
      return res
        .status(400)
        .json({ message: "newBalanceValue value is required" });
    }

    // Find the user and update the newBalanceValue value
    const user = await User.findByIdAndUpdate(
      userId,
      { balance: newBalanceValue },
      { new: true } // Return the updated user document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "newBalanceValue updated successfully", user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server Error" });
  }
});

// Endpoint to update user details (Auth only)
router.put("/admin/users-profile/:userId", auth,  async (req, res) => {
  try {
    const { userId } = req.params;
    const { address, dob, idCard } = req.body;

    // Find the user by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update only the provided fields
    if (address) user.address = address;
    if (dob) user.dob = dob;
    if (idCard) user.idCard = idCard;

    await user.save(); // Save the updated user data

    res.json({ user }); // Return the updated user data
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// PUT endpoint to update the password without hashing
router.put('/update-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body; 
  // Check if oldPassword and newPassword are provided
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide both old and new passwords.' });
  }

  try {
    // Find the user by the userId from the JWT token
    const user = await User.findById(req.user); // Assuming req.user contains the authenticated user info

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the old password with the stored password (no hashing involved)
    if (oldPassword !== user.password) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Update the password in the database
    user.password = newPassword; // Directly assign the new password (no hashing)
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// Update User Information Endpoint
router.post('/submit-document',auth, upload.single('idCardFile'), async (req, res) => {
  try {
    const { idCardType, idCardNumber } = req.body; // Get the values from the body
    const idCardFile = req.file; // Get the uploaded file from multer

    // Check if all required fields are present
    if (!idCardType || !idCardNumber) {
      return res.status(400).json({ message: 'ID Card Type and Number are required' });
    }

    // Optionally validate the file if it's uploaded
    if (idCardFile && !['image/jpeg', 'image/png', 'application/pdf'].includes(idCardFile.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPG, PNG, and PDF are allowed.' });
    }

    // Find the user by their ID (assuming the user is authenticated and their ID is in req.user)
    const user = await User.findById(req.user); // Adjust according to your auth setup
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user profile with the new information
    user.idCardType = idCardType;
    user.idCardNumber = idCardNumber;

    // If a new file was uploaded, save the file path to the user's profile (you may want to use a proper storage service like AWS S3 for production)
    if (idCardFile) {
      user.idCardFile = idCardFile.path; // Save the file path or URL (depending on where you store the file)
    }

    // Save the updated user profile to the database
    await user.save();

    res.json({ message: 'User information updated successfully', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// POST: Create a deposit request
router.post('/deposit-requests', auth, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: 'User ID and amount are required.' });
    }

    const newRequest = new DepositRequest({ userId, amount });
    await newRequest.save();
    res.status(201).json({ message: 'Deposit request created successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// GET: Fetch deposit requests for a specific user
router.get('/deposit-requests/:userId',auth,  async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await DepositRequest.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// GET: Fetch all deposit requests (Admin)
router.get('/deposit-requests',auth, isAdmin,async (req, res) => {
  try {
    const requests = await DepositRequest.find().populate('userId').sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// PATCH: Update deposit request status
router.patch('/deposit-requests/:id', auth, isAdmin,async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use "approved" or "rejected".' });
    }

    // Find the deposit request
    const depositRequest = await DepositRequest.findById(id);
    if (!depositRequest) {
      return res.status(404).json({ message: 'Deposit request not found.' });
    }

    // Update status
    depositRequest.status = status;
    depositRequest.updatedAt = new Date();
    await depositRequest.save();

    // If approved, update the user's balance
    if (status === 'approved') {
      const user = await User.findById(depositRequest.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      user.balance += depositRequest.amount; // Add the deposit amount to the balance
      await user.save();
    }

    res.status(200).json({ message: `Request ${status} successfully.`, depositRequest });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// POST: Create a withdraw request
router.post('/withdraw-requests', auth, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: 'User ID and amount are required.' });
    }

    const newRequest = new WithdrawRequest({ userId, amount });
    await newRequest.save();
    res.status(201).json({ message: 'Withdraw request created successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// GET: Fetch withdraw requests for a specific user
router.get('/withdraw-requests/:userId',auth,  async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await WithdrawRequest.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// GET: Fetch all withdraw requests (Admin)
router.get('/withdraw-requests',auth, isAdmin,async (req, res) => {
  try {
    const requests = await WithdrawRequest.find().populate('userId').sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});

// PATCH: Update withdraw request status
router.patch('/withdraw-requests/:id', auth, isAdmin,async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use "approved" or "rejected".' });
    }

    // Find the withdraw request
    const withdrawRequest = await WithdrawRequest.findById(id);
    if (!withdrawRequest) {
      return res.status(404).json({ message: 'Withdraw request not found.' });
    }

    // Update status
    withdrawRequest.status = status;
    withdrawRequest.updatedAt = new Date();
    await withdrawRequest.save();

    // If approved, update the user's balance
    if (status === 'approved') {
      const user = await User.findById(withdrawRequest.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      user.balance -= withdrawRequest.amount; // remove the withdraw amount to the balance
      await user.save();
    }

    res.status(200).json({ message: `Request ${status} successfully.`, withdrawRequest });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error.', error });
  }
});
module.exports = router;
