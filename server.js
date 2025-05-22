const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 開発モードでのみ livereload を有効にする
if (process.env.NODE_ENV !== "production") {
  const livereload = require("livereload");
  const connectLiveReload = require("connect-livereload");

  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(__dirname + "/public");

  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });
  app.use(connectLiveReload());
}

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

io.on("connection", (socket) => {
  console.log("新しいユーザーが接続しました:", socket.id);

  // 現在のソケットがどのルームにいるかを保持する変数
  socket.currentRoom = null;

  // ルーム参加処理
  socket.on("join room", (roomName, callback) => {
    if (socket.currentRoom) {
      // 既に他のルームに参加している場合は、まず退出させる
      socket.leave(socket.currentRoom);
      io.to(socket.currentRoom).emit(
        "room notification",
        `ユーザー ${socket.id.substring(0, 5)}... がルーム '${
          socket.currentRoom
        }' から退出しました。`
      );
      console.log(
        `ユーザー ${socket.id} がルーム '${socket.currentRoom}' から退出しました。`
      );
    }

    socket.join(roomName);
    socket.currentRoom = roomName;
    console.log(
      `ユーザー ${socket.id} がルーム '${roomName}' に参加しました。`
    );

    // 参加した本人に成功を通知
    if (callback && typeof callback === "function") {
      callback({ success: true, message: `ルーム '${roomName}' にようこそ！` });
    }

    // ルーム内の他の参加者に通知 (本人以外)
    socket
      .to(roomName)
      .emit(
        "room notification",
        `ユーザー ${socket.id.substring(
          0,
          5
        )}... がルーム '${roomName}' に参加しました。`
      );
    // 参加した本人にもシステムメッセージとして送信（オプション）
    socket.emit(
      "room notification",
      `あなたはルーム '${roomName}' に参加しました。`
    );
  });

  // メッセージ受信とルーム内への転送
  socket.on("chat message", (data) => {
    // data は { room: "ルーム名", message: "メッセージ内容" } という形式を期待
    if (data && data.room && data.message && socket.currentRoom === data.room) {
      console.log(
        `ルーム '${data.room}' のメッセージ (from ${socket.id}): ${data.message}`
      );
      // 送信者情報も付加して、ルーム内の全員（送信者含む）にメッセージを送信
      io.to(data.room).emit("chat message", {
        message: data.message,
        sender: socket.id, // 送信者のID
        room: data.room,
      });
    } else {
      console.log("無効なメッセージまたはルーム情報:", data);
    }
  });

  // 切断処理
  socket.on("disconnect", () => {
    console.log("ユーザーが切断しました:", socket.id);
    if (socket.currentRoom) {
      // ユーザーが参加していたルームがあれば、そのルームの他の参加者に退出を通知
      io.to(socket.currentRoom).emit(
        "room notification",
        `ユーザー ${socket.id.substring(0, 5)}... がルーム '${
          socket.currentRoom
        }' から退出しました。`
      );
      console.log(
        `ユーザー ${socket.id} がルーム '${socket.currentRoom}' から退出しました。`
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  if (process.env.NODE_ENV !== "production") {
    console.log("LiveReload が有効です。");
  }
});
