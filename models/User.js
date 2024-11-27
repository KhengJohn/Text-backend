const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phonenumber: {
    type: String,
    required: true,
  },
  refferalcode: {
    type: String,
  },
  how: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false, // New users are not verified by default
  },
  balance: {
    type: Number,
  },
  role: {
    type: String,
  },
  date: { type: Date, default: Date.now, required: true },
  address: {
    type: String,
    default: "", // You can adjust the type based on your address structure
  },
  dob: {
    type: Date,
    default: "",
  },
  // New fields for ID card
  idCardType: { type: String, default: "" },
  idCardNumber: { type: String, default: "" },
  idCardFile: { type: String, default: "" }, // Store file path or URL
});

// // Hash password before saving
// UserSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

module.exports = mongoose.model("User", UserSchema);
