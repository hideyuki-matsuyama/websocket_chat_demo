const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 開発モードでのみ livereload を有効にする
if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
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
  console.log("LiveReload が有効になりました。"); // ← 確認用に追加しても良い
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

// テスト用にエクスポートする関数
const startServer = (testPort) => {
  return new Promise((resolve) => {
    const activeServer = server.listen(testPort || PORT, () => {
      console.log(
        `テストサーバーがポート ${activeServer.address().port} で起動しました`
      );
      resolve(activeServer); // 起動したサーバーインスタンスを返す
    });
  });
};

const stopServer = (httpServerInstance) => {
  return new Promise((resolve, reject) => {
    if (!httpServerInstance) {
      console.log("テストサーバーインスタンスが存在しません。");
      return resolve();
    }

    // まずSocket.IOサーバーを閉じる
    io.close((ioErr) => {
      if (ioErr) {
        console.error(
          "Socket.IOサーバーのクローズ中にエラー発生（無視して続行）:",
          ioErr
        );
      }
      console.log(
        "Socket.IOサーバーがクローズされました（またはクローズ試行完了）。"
      );

      // Socket.IOクローズ後、HTTPサーバーがまだリスニング中か再確認
      if (!httpServerInstance.listening) {
        console.log(
          "HTTPテストサーバーはSocket.IOクローズ後にリスニングを停止していました。"
        );
        return resolve();
      }

      httpServerInstance.close((httpErr) => {
        if (httpErr) {
          console.error("HTTPテストサーバーの停止処理中にエラー発生:", httpErr);
          return reject(httpErr); // ここで発生するエラーは深刻な可能性
        }
        console.log("HTTPテストサーバーが正常に停止しました。");
        resolve();
      });
    });
  });
};

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
    // livereload をコメントアウトしているので、以下のNODE_ENVのチェックも
    // 本来は不要ですが、あっても害はありません。
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test"
    ) {
      console.log("LiveReload が有効です。(現在はコメントアウト中のはず)");
    }
  });
}

module.exports = {
  app, // Express アプリケーション
  server, // HTTP サーバー (元のインスタンス)
  io, // Socket.IO インスタンス
  PORT, // 設定されたポート
  startServer, // テスト用起動関数
  stopServer, // テスト用停止関数
};
