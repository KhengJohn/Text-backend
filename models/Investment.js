const mongoose = require('mongoose');

// Define the Investment Schema
const investmentSchema = new mongoose.Schema({
  img: {
    type: String,
    default: '', // Default value if no image is provided
  },
  name: {
    type: String,
    required: true, // Investment name is mandatory
  },
  investmentReturn: {
    type: String,
    required: true, // Investment return percentage (e.g., "18%")
  },
  duration: {
    type: String,
    required: true, // Duration of investment (e.g., "9 months")
  },  
  category: {
    type: String,
    required: true, // category name is mandatory
  },
  pricePerUnit: {
    type: Number,
    required: true, // Price per investment unit
  },
  investors: {
    type: Number,
    default: 0, // Default number of investors is 0
  },
}, {
  timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
});

// Create the Investment model
module.exports = mongoose.model('Investment', investmentSchema); 