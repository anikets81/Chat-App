require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const harperSaveMessage = require("./services/harper-save-message");
const harperGetMessages = require("./services/harper-get-messages");

app.use(cors());

const server = http.createServer(app);
const CHAT_BOT = "ChatBot";
let chatRoom = "";
let allUsers = [];

// allowing only this server/port to connect to out server 4000.
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

function leaveRoom(userID, chatRoomUsers) {
  return chatRoomUsers.filter((user) => user.id != userID);
}

io.on("connection", (socket) => {
  console.log(`User connected ${socket.id}`);

  socket.on("join_room", (data) => {
    const { username, room } = data;
    socket.join(room);

    let __createdtime__ = Date.now();

    // sending msg to everyone in the room except the user who just joined.
    socket.to(room).emit("receive_message", {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    // sending msg to newly joined user only.
    socket.emit("receive_message", {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    chatRoomUsers = allUsers.filter((user) => room === user.room);
    socket.to(room).emit("chatroom_users", chatRoomUsers);
    socket.emit("chatroom_users", chatRoomUsers);

    harperGetMessages(room)
      .then((last100Messages) => {
        socket.emit("last_100_messages", last100Messages);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  socket.on("send_message", (data) => {
    const { message, username, room, __createdtime__ } = data;
    io.in(room).emit("receive_message", data);
    harperSaveMessage(message, username, room, __createdtime__)
      .then((response) => console.log(response))
      .catch((err) => console.log(err));
  });

  socket.on("leave_room", (data) => {
    const { username, room } = data;
    socket.leave(room);
    const __createdtime__ = Date.now();
    // Remove user from memory
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit("chatroom_users", allUsers);
    socket.to(room).emit("receive_message", {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__,
    });
    console.log(`${username} has left the chat`);
  });

  socket.on("disconnect", () => {
    const user = allUsers.find((user) => user.id === socket.id);
    if (user?.username) {
      allUsers = leaveRoom(socket.id, allUsers);
      socket.to(chatRoom).emit("chatroom_users", allUsers);
      socket.to(chatRoom).emit("receive_message", {
        message: `${user.username} has disconnected fromt he chat`,
      });
    }
  });
});

app.get("/", (req, res) => {
  res.send("hello world");
});

server.listen(4000, () => {
  console.log("server is running on port 4000");
});
