const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
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
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/auth', authRoutes); // Authentication routes

// Create HTTP server for Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'https://finovaii.netlify.app',
        methods: ['GET', 'POST'],
    },
});

// Keep track of active chat rooms
const activeRooms = new Set(); // This can be replaced with a database or more complex structure if needed
const connectedUsers = {};
// Define the Message schema
const messageSchema = new mongoose.Schema({
    user: { type: String, required: true },
    text: { type: String, required: true },
    recipient: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

// Create the Message model
const Message = mongoose.model('Message', messageSchema);

// Socket.IO Implementation
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Emit the list of active rooms to the user
    socket.emit('activeRooms', Array.from(activeRooms));

    // Event for users to join a chat room
    socket.on('joinRoom', ({ userId, chatPartnerId }) => {
        const room = `chat-room-${userId}-${chatPartnerId}`;
        socket.join(room);
        activeRooms.add(room);
        console.log(`${userId} joined the room with ${chatPartnerId}`);
        
        // Notify other users in the room about the new participant
        socket.to(room).emit('userJoined', { userId });

        // Emit updated active rooms to all clients
        io.emit('activeRooms', Array.from(activeRooms));
        socket.emit('activeRooms', Array.from(activeRooms)); // Send the list of active rooms to the client
    });
 
    // Handle sending of messages
    socket.on('sendMessage', async ({ senderId, recipientId, text }) => {
        if (!senderId || !recipientId || !text.trim()) {
            return socket.emit('errorMessage', 'Sender ID, recipient ID, and text are required');
        }

        try {
            // Save the message to the database
            const newMessage = new Message({ user: senderId, text, recipient: recipientId });
            await newMessage.save();

            // Broadcast the message to the specific room (sender and recipient)
            const room = `chat-room-${senderId}-${recipientId}`;
            io.to(room).emit('receiveMessage', { senderId, recipientId, text, timestamp: newMessage.timestamp });
        } catch (err) {
            console.error('Error saving message:', err);
            socket.emit('errorMessage', 'Failed to send message');
        }
    });
 // Register user when they connect
 socket.on('registerUser', (userId) => {
    connectedUsers[socket.id] = userId;
    console.log(`User registered: ${userId} with socket ID: ${socket.id}`);
    
    // Log all connected users
    console.log('Currently connected users:', connectedUsers);

    // Emit the list of connected users to the client
    socket.emit('connectedUsers', Object.values(connectedUsers));
    });
    // Handle typing events
    socket.on('typing', ({ userId, chatPartnerId }) => {
        const room = `chat-room-${userId}-${chatPartnerId}`;
        socket.broadcast.to(room).emit('userTyping', { userId });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        // Optionally remove room if empty
        activeRooms.forEach((room) => {
            if (io.sockets.adapter.rooms.get(room) === undefined) {
                activeRooms.delete(room);
            }
        });
        io.emit('activeRooms', Array.from(activeRooms));
    });
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    try {
        await mongoose.connection.close();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
