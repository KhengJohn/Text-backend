const express = require('express');
const dotenv = require('dotenv'); 
const cors = require('cors');
const http = require('http'); 
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

// Initialize the app
const app = express();

// CORS Configuration
const corsOptions = {
    origin: process.env.CLIENT_URL || 'https://finovaii.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/auth', authRoutes); // Authentication routes

// Create HTTP server for Socket.IO
const server = http.createServer(app);


// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
