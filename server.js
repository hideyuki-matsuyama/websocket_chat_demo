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

  // public ディレクトリ内の変更を監視する LiveReload サーバーを作成
  const liveReloadServer = livereload.createServer();
  liveReloadServer.watch(__dirname + "/public");

  // LiveReload サーバーがクライアントに接続したときに一度リフレッシュを実行
  // (サーバー起動時に既に開いているページをリロードするため)
  liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
      liveReloadServer.refresh("/");
    }, 100);
  });

  // connect-livereload ミドルウェアを Express アプリケーションに適用
  app.use(connectLiveReload());
}

// 静的ファイルを提供
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

io.on("connection", (socket) => {
  console.log("新しいユーザーが接続しました:", socket.id);

  socket.on("chat message", (msg) => {
    console.log("メッセージ:", msg);
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("ユーザーが切断しました:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  if (process.env.NODE_ENV !== "production") {
    console.log("LiveReload が有効です。");
  }
});
