const mongoose = require("mongoose");
const UserInvestmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true },
  unitsPurchased: { type: Number, required: true },
  amountInvested: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserInvestment', UserInvestmentSchema);
