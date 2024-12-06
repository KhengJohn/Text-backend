const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const DepositRequest = require("../models/Deposit");
const WithdrawRequest = require("../models/Withdraw");
const Investment = require("../models/Investment");
const UserInvestment = require("../models/UserInvestment");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" }); // You can customize the storage path
const nodemailer = require("nodemailer");

// FORMAT TIME AND DATE
function formatTimestamp(isoString) {
  const date = new Date(isoString);

  const formattedDate = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC", // Adjust as needed for your timezone
  });

  return `${formattedDate}, ${formattedTime} UTC`;
}

// Create a transporter object using SMTP with Yahoo's SMTP settings
const transporter = nodemailer.createTransport({
  service: "yahoo", // You can use 'yahoo' directly or specify the SMTP host
  auth: {
    user: "idokojohn72@yahoo.com", // Replace with your Yahoo email
    pass: "wqqjqjpqevxszcuk", // Replace with your Yahoo email password or app password
  },
});

// EMAIL TEMPLATES
const depositRequestEmailTemplate = (
  userName,
  requestId,
  amount,
  requestDate,
  status
  // paymentMethod
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="color: #4CAF50; text-align: center;">Deposit Request Receipt</h2>
    <p>Dear ${userName},</p>
    <p>Thank you for creating a deposit request. Below are the details of your request:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request ID</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestId}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Amount</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${amount}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request Date</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestDate}</td>
     </tr>
        <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Status</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${status}</td>
     </tr> 
    </table>
    <p>Please allow up to <strong>24-48 hours</strong> for processing. Once your deposit is successfully credited, you will receive a confirmation email.</p>
    <p>If you have any questions, feel free to contact us at <a href="mailto:support@yourcompany.com">Finova Support</a>.</p>
    <p style="text-align: center; margin-top: 30px;">Thank you for choosing <strong>Finova</strong>.</p>
  </div>
`;

const createApprovalEmailTemplate = (
  userName,
  requestId,
  amount,
  approvalDate,
  status
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="color: #4CAF50; text-align: center;">Deposit Request Approved</h2>
    <p>Dear ${userName},</p>
    <p>We are pleased to inform you that your deposit request has been approved and processed successfully. Below are the details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request ID</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestId}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Amount</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${amount}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Approval Date</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${approvalDate}</td>
      </tr>  
        <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Status</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${status}</td>
     </tr> 
    </table>
    <p>Your deposit has been credited to your account and is now available for use. If you have any questions or require further assistance, please don't hesitate to contact us at <a href="mailto:support@yourcompany.com">support@yourcompany.com</a>.</p>
    <p style="text-align: center; margin-top: 30px;">Thank you for choosing <strong>Your Company Name</strong>.</p>
  </div>
`;

const withdrawRequestEmailTemplate = (
  userName,
  requestId,
  amount,
  requestDate,
  status
  // paymentMethod
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="color: #4CAF50; text-align: center;">Withdrawal Request Receipt</h2>
    <p>Dear ${userName},</p>
    <p>You created a withdrawal request. Below are the details of your request:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request ID</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestId}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Amount</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${amount}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request Date</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestDate}</td>
     </tr>
        <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Status</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${status}</td>
     </tr> 
    </table>
    <p>Please allow up to <strong>24-48 hours</strong> for processing. Once your withdraw is successfully, you will receive a confirmation email.</p>
    <p>If you have any questions, feel free to contact us at <a href="mailto:support@yourcompany.com">Finova Support</a>.</p>
    <p style="text-align: center; margin-top: 30px;">Thank you for choosing <strong>Finova</strong>.</p>
  </div>
`;

const createInvestmentEmailTemplate = (
  userName,
  investmentName,
  unitsPurchased,
  totalCost,
  investmentReturn,
  duration,
  userBalance
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="color: #4CAF50; text-align: center;">Investment Successful</h2>
    <p>Dear ${userName},</p>
    <p>We are pleased to inform you that your investment has been processed successfully. Here are the details of your transaction:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Investment Name</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${investmentName}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Units Purchased</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${unitsPurchased}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Total Cost</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${totalCost}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Expected Return</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${investmentReturn}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Duration</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${duration}</td>
      </tr>
    </table>
    <p>Your remaining balance is <strong>$${userBalance}</strong>. Thank you for trusting us with your investments. If you have any questions, feel free to contact us at <a href="mailto:support@yourcompany.com">Finova</a>.</p>
    <p style="text-align: center; margin-top: 30px;">Thank you for choosing <strong>Finova</strong>.</p>
  </div>
`;

const createApprovalWEmailTemplate = (
  userName,
  requestId,
  amount,
  approvalDate,
  status
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="color: #4CAF50; text-align: center;">Withdrawal Request Approved</h2>
    <p>Dear ${userName},</p>
    <p>We are pleased to inform you that your withdrawal request has been approved and processed successfully. Below are the details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Request ID</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${requestId}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Amount</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${amount}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Approval Date</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${approvalDate}</td>
      </tr>  
        <tr>
        <th style="text-align: left; padding: 8px; background-color: #f2f2f2; border-bottom: 1px solid #ddd;">Status</th>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${status}</td>
     </tr> 
    </table>
    <p>Your withdrawal has been credited to your account and is now available for use. If you have any questions or require further assistance, please don't hesitate to contact us at <a href="mailto:support@yourcompany.com">Finova</a>.</p>
    <p style="text-align: center; margin-top: 30px;">Thank you for choosing <strong>Finova</strong>.</p>
  </div>
`;
async function depositRequestEmailReceipt(
  email,
  userName,
  requestId,
  amount,
  requestDate,
  status
  // paymentMethod
) {
  // Define the email options
  const mailOptions = {
    from: '"Finova Finance Team" <idokojohn72@yahoo.com>',
    to: email,
    subject: "Transaction Receipt",
    text: `Hello ${userName}, `,
    html: depositRequestEmailTemplate(
      userName,
      requestId,
      amount,
      requestDate,
      status
      // paymentMethod
    ),
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}
async function approveDepositRequestEmailReceipt(
  email,
  userName,
  requestId,
  amount,
  approvalDate,
  status
  // paymentMethod
) {
  // Define the email options
  const mailOptions = {
    from: '"Finova Finance Team" <idokojohn72@yahoo.com>',
    to: email,
    subject: "Transaction Receipt",
    text: `Hello ${userName},`,
    html: createApprovalEmailTemplate(
      userName,
      requestId,
      amount,
      approvalDate,
      status
      // paymentMethod
    ),
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}

const sendInvestmentEmail = async (
  userEmail,
  userName,
  investmentName,
  unitsPurchased,
  totalCost,
  investmentReturn,
  duration,
  userBalance
) => {
  const emailOptions = {
    from: '"Finova Finance Team" <idokojohn72@yahoo.com>',
    to: userEmail,

    subject: "Investment Successful",
    text: `Hello ${userName},`,
    html: createInvestmentEmailTemplate(
      userName,
      investmentName,
      unitsPurchased,
      totalCost,
      investmentReturn,
      duration,
      userBalance
    ),
  };

  try {
    const info = await transporter.sendMail(emailOptions);
    console.log("Investment Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending investment email:", error);
  }
};
async function withdrawalRequestEmailReceipt(
  email,
  userName,
  requestId,
  amount,
  requestDate,
  status
  // paymentMethod
) {
  // Define the email options
  const mailOptions = {
    from: '"Finova Finance Team" <idokojohn72@yahoo.com>',
    to: email,
    subject: "Transaction Receipt",
    text: `Hello ${userName}, `,
    html: withdrawRequestEmailTemplate(
      userName,
      requestId,
      amount,
      requestDate,
      status
      // paymentMethod
    ),
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}
async function approveWithdrawalRequestEmailReceipt(
  email,
  userName,
  requestId,
  amount,
  approvalDate,
  status
  // paymentMethod
) {
  // Define the email options
  const mailOptions = {
    from: '"Finova Finance Team" <idokojohn72@yahoo.com>',
    to: email,
    subject: "Transaction Receipt",
    text: `Hello ${userName},`,
    html: createApprovalWEmailTemplate(
      userName,
      requestId,
      amount,
      approvalDate,
      status
      // paymentMethod
    ),
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.response);
  } catch (error) {
    console.error("Error sending email: ", error);
  }
}

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
router.put("/admin/users-profile/:userId", auth, async (req, res) => {
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
router.put("/update-password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // Check if oldPassword and newPassword are provided
  if (!oldPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Please provide both old and new passwords." });
  }

  try {
    // Find the user by the userId from the JWT token
    const user = await User.findById(req.user); // Assuming req.user contains the authenticated user info

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare the old password with the stored password (no hashing involved)
    if (oldPassword !== user.password) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    // Update the password in the database
    user.password = newPassword; // Directly assign the new password (no hashing)
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// Update User Information Endpoint
router.post(
  "/submit-document",
  auth,
  upload.single("idCardFile"),
  async (req, res) => {
    try {
      const { idCardType, idCardNumber } = req.body; // Get the values from the body
      const idCardFile = req.file; // Get the uploaded file from multer

      // Check if all required fields are present
      if (!idCardType || !idCardNumber) {
        return res
          .status(400)
          .json({ message: "ID Card Type and Number are required" });
      }

      // Optionally validate the file if it's uploaded
      if (
        idCardFile &&
        !["image/jpeg", "image/png", "application/pdf"].includes(
          idCardFile.mimetype
        )
      ) {
        return res.status(400).json({
          message: "Invalid file type. Only JPG, PNG, and PDF are allowed.",
        });
      }

      // Find the user by their ID (assuming the user is authenticated and their ID is in req.user)
      const user = await User.findById(req.user); // Adjust according to your auth setup
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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

      res.json({ message: "User information updated successfully", user });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// POST: Create a deposit request
router.post("/deposit-requests", auth, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res
        .status(400)
        .json({ message: "User ID and amount are required." });
    }
    // Find the user by the userId from the JWT token
    const user = await User.findById(req.user); // Assuming req.user contains the authenticated user info

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newRequest = new DepositRequest({ userId, amount });
    const userName = user.name;
    const email = user.email;
    const requestId = newRequest._id;
    const requestDate = formatTimestamp(newRequest.createdAt);
    const status = newRequest.status;
    // Send receipt email
    depositRequestEmailReceipt(
      email,
      userName,
      requestId,
      amount,
      requestDate,
      status
      // paymentMethod
    );
    await newRequest.save();
    res.status(201).json({ message: "Deposit request created successfully." });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// GET: Fetch deposit requests for a specific user
router.get("/deposit-requests/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await DepositRequest.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// GET: Fetch all deposit requests (Admin)
router.get("/deposit-requests", auth, isAdmin, async (req, res) => {
  try {
    const requests = await DepositRequest.find()
      .populate("userId")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// PATCH: Update deposit request status
router.patch("/deposit-requests/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Invalid status. Use "approved" or "rejected".' });
    }

    // Find the deposit request
    const depositRequest = await DepositRequest.findById(id);
    if (!depositRequest) {
      return res.status(404).json({ message: "Deposit request not found." });
    }

    // Update status
    depositRequest.status = status;
    depositRequest.updatedAt = new Date();

    const userId = depositRequest.userId;
    const usersInfo = await User.findById(userId);

    if (!usersInfo) {
      return res.status(404).json({
        message: "User associated with the deposit request not found.",
      });
    }

    const userName = usersInfo.name;
    const email =  usersInfo.email;
    const requestId = depositRequest._id;
    const approvalDate = formatTimestamp(depositRequest.updatedAt);
    // Send receipt email
    approveDepositRequestEmailReceipt(
      email,
      userName,
      requestId,
      depositRequest.amount,
      approvalDate,
      status
      // paymentMethod
    );
    await depositRequest.save();

    // If approved, update the user's balance
    if (status === "approved") {
      const user = await User.findById(depositRequest.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      user.balance += depositRequest.amount; // Add the deposit amount to the balance
      await user.save();
    }

    res
      .status(200)
      .json({ message: `Request ${status} successfully.`, depositRequest });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// POST: Create a withdraw request
router.post("/withdraw-requests", auth, async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res
        .status(400)
        .json({ message: "User ID and amount are required." });
    }
    // Find the user by the userId from the JWT token
    const user = await User.findById(req.user); // Assuming req.user contains the authenticated user info

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const newRequest = new WithdrawRequest({ userId, amount });
    console.log("newRequest", newRequest);
    const userName = user.name;
    const email =   user.email;
    const requestId = newRequest._id;
    const requestDate = formatTimestamp(newRequest.createdAt);
    const status = newRequest.status;
    // Send receipt email
    withdrawalRequestEmailReceipt(
      email,
      userName,
      requestId,
      amount,
      requestDate,
      status
      // paymentMethod
    );
    await newRequest.save();
    res.status(201).json({ message: "Withdraw request created successfully." });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// GET: Fetch withdraw requests for a specific user
router.get("/withdraw-requests/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await WithdrawRequest.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// GET: Fetch all withdraw requests (Admin)
router.get("/withdraw-requests", auth, isAdmin, async (req, res) => {
  try {
    const requests = await WithdrawRequest.find()
      .populate("userId")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// PATCH: Update withdraw request status
router.patch("/withdraw-requests/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Invalid status. Use "approved" or "rejected".' });
    }

    // Find the withdraw request
    const withdrawRequest = await WithdrawRequest.findById(id);
    if (!withdrawRequest) {
      return res.status(404).json({ message: "Withdraw request not found." });
    }

    // Update status
    withdrawRequest.status = status;
    withdrawRequest.updatedAt = new Date();
    const userId = withdrawRequest.userId;
    const usersInfo = await User.findById(userId);

    if (!usersInfo) {
      return res.status(404).json({
        message: "User associated with the deposit request not found.",
      });
    }

    const userName = usersInfo.name;
    const email =  usersInfo.email;
    const requestId = withdrawRequest._id;
    const approvalDate = formatTimestamp(withdrawRequest.updatedAt);
    // Send receipt email
    approveWithdrawalRequestEmailReceipt(
      email,
      userName,
      requestId,
      withdrawRequest.amount,
      approvalDate,
      status
      // paymentMethod
    );
    await withdrawRequest.save();

    // If approved, update the user's balance
    if (status === "approved") {
      const user = await User.findById(withdrawRequest.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      user.balance -= withdrawRequest.amount; // remove the withdraw amount to the balance
      await user.save();
    }

    res
      .status(200)
      .json({ message: `Request ${status} successfully.`, withdrawRequest });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// TODO Edit Valid Banks
const validBanks = [
  "JPMorgan Chase",
  "Bank of America",
  "Citigroup",
  "Wells Fargo",
  "Goldman Sachs",
  "Morgan Stanley",
  "U.S. Bank",
  "PNC Financial Services",
  "Truist Financial",
  "Capital One",
  "TD Bank",
  "American Express",
  "Charles Schwab",
  "Fifth Third Bank",
  "Citizens Bank",
  "KeyBank",
  "Huntington Bank",
  "Regions Bank",
  "Ally Bank",
  "Silicon Valley Bank",
  "First Republic Bank",
  "M&T Bank",
  "BBVA USA",
  "Bank of the West",
  "BMO Harris Bank",
  "Comerica",
  "Flagstar Bank",
  "Synovus Bank",
  "Zions Bancorp",
  "First Horizon Bank",
];

// POST: Link Bank Account
router.post("/add-bank", auth, async (req, res) => {
  try {
    const { bankName, accountNumber, accountHolderName } = req.body;
    if (!validBanks.includes(bankName)) {
      return res.status(400).json({ message: "Invalid bank name." });
    }
    if (!bankName || !accountNumber || !accountHolderName) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Add bank account to user's list
    const newBankAccount = {
      bankName,
      accountNumber,
      accountHolderName,
      isVerified: true, // Simulated verification
    };

    user.bankAccounts.push(newBankAccount);
    await user.save();

    res.status(200).json({
      message: "Bank account linked successfully!",
      bankAccount: newBankAccount,
    });
  } catch (error) {
    console.error("Error linking bank account:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// INVESTMENTS

// POST: Create a new investment
router.post("/investments", auth, isAdmin, async (req, res) => {
  try {
    const { img, name, investmentReturn, duration, pricePerUnit, investors } =
      req.body;

    // Validate required fields
    if (
      !name ||
      !investmentReturn ||
      !duration ||
      !pricePerUnit ||
      investors === undefined ||
      investors === null
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Create a new investment instance
    const newInvestment = new Investment({
      img: img || "", // Default empty string if img is not provided
      name,
      investmentReturn,
      duration,
      pricePerUnit,
      investors,
    });

    // Save the new investment to the database
    await newInvestment.save();

    // Return success response
    res.status(201).json(newInvestment);
  } catch (error) {
    // Log the error and return an internal server error response
    console.error("Error creating investment:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// GET: Retrieve all investments
router.get("/investments", auth, async (req, res) => {
  try {
    const investments = await Investment.find();
    res.status(200).json(investments);
  } catch (error) {
    console.error("Error fetching investments:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// PUT: Edit an investment by ID
router.put("/investments/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { img, name, investmentReturn, duration, pricePerUnit, investors } =
      req.body;

    // Validate input data
    if (
      !name ||
      !investmentReturn ||
      !duration ||
      !pricePerUnit ||
      investors === undefined ||
      investors === null
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const updatedData = {
      img: img || "",
      name,
      investmentReturn,
      duration,
      pricePerUnit,
      investors,
    };

    // Find and update the investment
    const updatedInvestment = await Investment.findByIdAndUpdate(
      id,
      updatedData,
      { new: true, runValidators: true }
    );

    if (!updatedInvestment) {
      return res.status(404).json({ message: "Investment not found." });
    }

    res.status(200).json({
      message: "Investment updated successfully.",
      investment: updatedInvestment,
    });
  } catch (error) {
    console.error("Error updating investment:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// DELETE: Delete an investment by ID
router.delete("/investments/:id", auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the investment
    const deletedInvestment = await Investment.findByIdAndDelete(id);

    if (!deletedInvestment) {
      return res.status(404).json({ message: "Investment not found." });
    }

    res.status(200).json({ message: "Investment deleted successfully." });
  } catch (error) {
    console.error("Error deleting investment:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// POST: User invests in an investment
router.post("/invest", async (req, res) => {
  try {
    const { userId, investmentId, unitsPurchased } = req.body;

    // Validate input
    if (!unitsPurchased || unitsPurchased <= 0) {
      return res.status(400).json({ message: "Invalid number of units." });
    }

    // Fetch the investment
    const investment = await Investment.findById(investmentId);
    if (!investment) {
      return res.status(404).json({ message: "Investment not found." });
    }

    // Fetch the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const totalCost = investment.pricePerUnit * unitsPurchased;

    // Check if user has sufficient balance
    if (user.balance < totalCost) {
      return res.status(400).json({ message: "Insufficient balance." });
    }

    // Deduct the balance from the user
    user.balance -= totalCost;

    // Create a new user investment record
    const userInvestment = new UserInvestment({
      userId: user._id,
      investmentId: investment._id,
      unitsPurchased,
      amountInvested: totalCost,
    });

    // Update the investment's investor count
    investment.investors += 1;

    // Save all changes to the database
    await userInvestment.save();
    await user.save();
    await investment.save();

    const userEmail = user.email;
    const userName = user.name;
    const investmentName = investment.name;
    const investmentReturn = investment.investmentReturn;
    const duration = investment.duration;
    const userBalance = user.balance;
    sendInvestmentEmail(
      userEmail,
      userName,
      investmentName,
      unitsPurchased,
      totalCost,
      investmentReturn,
      duration,
      userBalance
    );
    // Respond with success
    res.status(200).json({
      message: "Investment successful.",
      userBalance: user.balance,
      investmentDetails: {
        name: investment.name,
        unitsPurchased,
        totalCost,
        investmentReturn: investment.investmentReturn,
        duration: investment.duration,
      },
    });
  } catch (error) {
    console.error("Error during investment:", error.message);
    res.status(500).json({ message: "Internal server error.", error });
  }
});

// GET: Retrieve all investments for the logged-in user
router.get("/my-investments", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate("investments");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ investments: user.investments });
  } catch (error) {
    console.error("Error fetching user investments:", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all investments for a specific user
router.get("/user-investments/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all user investments
    const userInvestments = await UserInvestment.find({ userId })
      .populate("investmentId") // Populate related investment details
      .exec();

    if (userInvestments.length === 0) {
      return res
        .status(404)
        .json({ message: "No investments found" });
    }

    // Format the response
    const formattedInvestments = userInvestments.map((investment) => ({
      investmentName: investment.investmentId.name,
      unitsPurchased: investment.unitsPurchased,
      amountInvested: investment.amountInvested,
      investmentReturn: investment.investmentId.investmentReturn,
      duration: investment.investmentId.duration,
    }));

    res.status(200).json({ investments: formattedInvestments });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.", error });
  }
});

module.exports = router;
