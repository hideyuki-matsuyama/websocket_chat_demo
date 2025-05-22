process.env.NODE_ENV = "test";

const ioClient = require("socket.io-client");
const { startServer, stopServer, PORT: APP_PORT } = require("./server"); // server.jsからエクスポートされたものを利用

let httpServerInstance;
let clientSocket1, clientSocket2;
const TEST_SERVER_PORT = process.env.TEST_PORT || 3001; // テスト用に別のポートを使用

// ヘルパー関数: クライアントソケットを作成
function createClientSocket() {
  // サーバーアドレスとポートを指定
  return ioClient(`http://localhost:${TEST_SERVER_PORT}`, {
    reconnection: false, // テスト中は再接続を無効に
    forceNew: true, // 各クライアントが新しい接続を確立するように
    transports: ["websocket"], // WebSocketを優先
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = "test"; // これは先頭にある想定
  console.log("テストスイート開始: startServer を呼び出します。");
  httpServerInstance = await startServer(TEST_SERVER_PORT);
  if (httpServerInstance && httpServerInstance.listening) {
    console.log(
      `テストサーバーがポート ${
        httpServerInstance.address().port
      } で正常に起動・リスニング中。`
    );
  } else {
    console.error("テストサーバーの起動に失敗したか、リスニングしていません。");
    // サーバーが起動しない場合はテストを続行できないため、エラーを投げることも検討
    throw new Error("テストサーバーの起動に失敗しました。");
  }
});

afterAll(async () => {
  await stopServer(httpServerInstance);
});

beforeEach((done) => {
  // 各テストの前にクライアントソケットが接続されていれば切断
  if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
  if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
  clientSocket1 = null;
  clientSocket2 = null;
  done();
});

const disconnectClient = (socket) => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

afterEach((done) => {
  disconnectClient(clientSocket1);
  disconnectClient(clientSocket2);
  clientSocket1 = null; // 参照をクリア
  clientSocket2 = null; // 参照をクリア
  done(); // done() を呼ぶか、async/await を使用
});

describe("WebSocket Chat Server", () => {
  test("新しいユーザーが接続できること", (done) => {
    clientSocket1 = createClientSocket();
    clientSocket1.on("connect", () => {
      expect(clientSocket1.connected).toBe(true);
      done();
    });
    clientSocket1.on("connect_error", (error) => {
      done(error); // 接続エラーでテスト失敗
    });
  });

  describe("ルーム機能", () => {
    test("ユーザーがルームに参加し、成功のコールバックと通知を受け取ること", (done) => {
      clientSocket1 = createClientSocket();
      const roomName = "test-room1";

      clientSocket1.on("connect", () => {
        clientSocket1.emit("join room", roomName, (response) => {
          expect(response.success).toBe(true);
          expect(response.message).toBe(`ルーム '${roomName}' にようこそ！`);
        });
      });

      // 参加者本人への通知
      clientSocket1.on("room notification", (notification) => {
        if (notification === `あなたはルーム '${roomName}' に参加しました。`) {
          done();
        }
      });
    });

    test("新しいユーザーがルームに参加した際、ルーム内の他のユーザーに通知が送られること", (done) => {
      const roomName = "test-room2";
      clientSocket1 = createClientSocket(); // 先に参加するユーザー
      let client1Ready = false;

      clientSocket1.emit("join room", roomName, () => {
        client1Ready = true;
        // clientSocket1 がルームに参加した後、clientSocket2 が参加
        clientSocket2 = createClientSocket();
        clientSocket2.emit("join room", roomName, () => {
          // clientSocket2 も参加完了
        });
      });

      // clientSocket1 が clientSocket2 の参加通知を受け取ることを期待
      clientSocket1.on("room notification", (notification) => {
        // clientSocket1自身への参加通知は無視
        if (notification === `あなたはルーム '${roomName}' に参加しました。`)
          return;

        // clientSocket2が定義されてからチェック
        if (
          client1Ready &&
          clientSocket2 &&
          notification ===
            `ユーザー ${clientSocket2.id.substring(
              0,
              5
            )}... がルーム '${roomName}' に参加しました。`
        ) {
          done();
        }
      });
    });

    test("ユーザーがルームを移動した際、旧ルームと新ルームに適切に通知が送られること", (done) => {
      const roomNameOld = "old-room";
      const roomNameNew = "new-room";

      clientSocket1 = createClientSocket(); // 移動するユーザー
      clientSocket2 = createClientSocket(); // 旧ルームに留まるユーザー

      let notifiedOldRoomOfExit = false;
      let notifiedNewRoomOfEntrySelf = false;

      const checkDone = () => {
        if (notifiedOldRoomOfExit && notifiedNewRoomOfEntrySelf) {
          done();
        }
      };

      // 1. client1 と client2 が old-room に参加
      clientSocket1.emit("join room", roomNameOld, () => {
        clientSocket2.emit("join room", roomNameOld, () => {
          // 2. client1 が new-room に移動
          clientSocket1.emit("join room", roomNameNew, (response) => {
            expect(response.success).toBe(true);
          });
        });
      });

      // client2 が client1 の old-room からの退出通知を受け取る
      clientSocket2.on("room notification", (notification) => {
        if (
          clientSocket1 &&
          notification ===
            `ユーザー ${clientSocket1.id.substring(
              0,
              5
            )}... がルーム '${roomNameOld}' から退出しました。`
        ) {
          notifiedOldRoomOfExit = true;
          checkDone();
        }
      });

      // client1 が new-room への参加通知（自分宛）を受け取る
      clientSocket1.on("room notification", (notification) => {
        if (
          notification === `あなたはルーム '${roomNameNew}' に参加しました。`
        ) {
          notifiedNewRoomOfEntrySelf = true;
          checkDone();
        }
        // client1 が old-room から退出した旨の通知は自分には来ない想定 (実装による)
      });
    });
  });

  describe("チャットメッセージ機能", () => {
    test("同じルーム内の全ユーザー（送信者含む）にメッセージが送信されること", (done) => {
      const roomName = "chat-test-room";
      const messageText = "こんにちは、皆さん！";
      let client1MsgCount = 0;
      let client2MsgCount = 0;

      clientSocket1 = createClientSocket();
      clientSocket2 = createClientSocket();

      const onClient1Message = (data) => {
        // 参加通知などを除外
        if (data.message === messageText) {
          expect(data.sender).toBe(clientSocket1.id);
          expect(data.room).toBe(roomName);
          client1MsgCount++;
          if (client1MsgCount === 1 && client2MsgCount === 1) done();
        }
      };

      const onClient2Message = (data) => {
        // 参加通知などを除外
        if (data.message === messageText) {
          expect(data.sender).toBe(clientSocket1.id);
          expect(data.room).toBe(roomName);
          client2MsgCount++;
          if (client1MsgCount === 1 && client2MsgCount === 1) done();
        }
      };

      clientSocket1.emit("join room", roomName, () => {
        clientSocket1.on("chat message", onClient1Message);
        clientSocket2.emit("join room", roomName, () => {
          clientSocket2.on("chat message", onClient2Message);
          // 両者がルームに参加した後、clientSocket1がメッセージを送信
          clientSocket1.emit("chat message", {
            room: roomName,
            message: messageText,
          });
        });
      });
    });

    test("ユーザーが参加していないルームへのメッセージは送信されないこと (または無視されること)", (done) => {
      clientSocket1 = createClientSocket(); // roomA に参加
      clientSocket2 = createClientSocket(); // roomB に参加 (メッセージを受信しないことを期待)
      const roomA = "room-A";
      const roomB = "room-B";
      const messageText = "これはroomBへのメッセージです";

      clientSocket1.emit("join room", roomA, () => {
        clientSocket2.emit("join room", roomB, () => {
          // client1 (roomA在籍) が roomB 宛にメッセージを送信しようとする
          // サーバー側のロジック (socket.currentRoom === data.room) により、これは無視されるはず
          clientSocket1.emit("chat message", {
            room: roomB,
            message: messageText,
          });

          // 少し待って、メッセージが配信されないことを確認
          setTimeout(() => {
            done(); // clientSocket2 がメッセージを受信しなければ成功
          }, 500);
        });
      });

      clientSocket2.on("chat message", (data) => {
        // このイベントハンドラが呼ばれたらテスト失敗
        done(
          new Error(
            `roomBのclientSocket2がメッセージを受信してしまいました: ${data.message}`
          )
        );
      });
      clientSocket1.on("chat message", (data) => {
        // このイベントハンドラが呼ばれたらテスト失敗 (自分にも送られないはず)
        done(
          new Error(
            `roomAのclientSocket1がメッセージを受信してしまいました: ${data.message}`
          )
        );
      });
    });

    test("メッセージデータが無効な場合（例: messageフィールド欠如）、メッセージは送信されないこと", (done) => {
      clientSocket1 = createClientSocket();
      const roomName = "valid-room-for-invalid-message";

      clientSocket1.emit("join room", roomName, () => {
        // 無効なメッセージ (message フィールドがない)
        clientSocket1.emit("chat message", { room: roomName });

        setTimeout(() => {
          done(); // chat message イベントが発生しなければ成功
        }, 300);
      });

      clientSocket1.on("chat message", (data) => {
        done(
          new Error(
            "無効なデータで chat message イベントが発生してしまいました。"
          )
        );
      });
    });
  });

  describe("切断処理", () => {
    test("ユーザーが切断した際、そのユーザーがいたルームの他のユーザーに通知が送られること", async () => {
      // ★★★ done を削除 ★★★
      jest.setTimeout(10000); // このテストケースのタイムアウトを10秒に設定
      const roomName = "disconnect-notify-room";
      clientSocket1 = createClientSocket();
      clientSocket2 = createClientSocket();
      let client1Id; // clientSocket1のIDを保存する変数

      // clientSocket1 の接続とルーム参加
      clientSocket1.on("connect", () => {
        client1Id = clientSocket1.id; // ★ 接続時にIDを確実に保存
        console.log(
          `DEBUG (disconnect test): client1 (ID: ${client1Id}) connected.`
        );
        clientSocket1.emit("join room", roomName, (joinResponse1) => {
          if (!joinResponse1.success)
            return done(new Error("Client1 failed to join room"));
          console.log(
            `DEBUG (disconnect test): client1 joined room ${roomName}.`
          );

          // clientSocket2 の接続とルーム参加
          clientSocket2.on("connect", () => {
            console.log(`DEBUG (disconnect test): client2 connected.`);
            clientSocket2.emit("join room", roomName, (joinResponse2) => {
              if (!joinResponse2.success)
                return done(new Error("Client2 failed to join room"));
              console.log(
                `DEBUG (disconnect test): client2 joined room ${roomName}. Now disconnecting client1.`
              );
              // 両者がルームに参加した後、clientSocket1が切断
              clientSocket1.disconnect();
            });
          });
          clientSocket2.on("connect_error", (err) =>
            done(new Error(`Client2 connection error: ${err}`))
          );
        });
      });
      clientSocket1.on("connect_error", (err) =>
        done(new Error(`Client1 connection error: ${err}`))
      );

      // clientSocket2 が通知を受け取る処理
      clientSocket2.on("room notification", (notification) => {
        console.log(
          `DEBUG (disconnect test): client2 received notification: "${notification}"`
        );
        // ★ client1Id が未定義でないことを確認してから substring を呼び出す
        if (
          client1Id &&
          notification.includes(
            `ユーザー ${client1Id.substring(
              0,
              5
            )}... がルーム '${roomName}' から退出しました。`
          )
        ) {
          console.log(
            `DEBUG (disconnect test): Correct disconnect notification received. Test passes.`
          );
          done();
        } else if (client1Id) {
          console.log(
            `DEBUG (disconnect test): Received notification, but not the expected one. Expected ID part: ${client1Id.substring(
              0,
              5
            )}`
          );
        } else {
          console.log(
            `DEBUG (disconnect test): Received notification, but client1Id was undefined.`
          );
        }
      });
    }, 10000); // テストケースごとのタイムアウト設定（こちらが優先されることが多い）

    test("ルームに参加していないユーザーが切断しても、他のルームに通知はいかないこと", (done) => {
      clientSocket1 = createClientSocket(); // 接続するがルームには参加しない
      clientSocket2 = createClientSocket(); // 特定のルームに参加

      const roomForClient2 = "another-room";
      let client2SelfNotificationReceived = false;

      clientSocket2.on("connect_error", (err) =>
        done(new Error(`Client2 connect_error: ${err.message}`))
      );
      clientSocket1.on("connect_error", (err) =>
        done(new Error(`Client1 connect_error: ${err.message}`))
      );

      clientSocket2.on("connect", () => {
        console.log("DEBUG (no notify test): client2 connected.");
        clientSocket2.emit("join room", roomForClient2, () => {
          console.log(
            `DEBUG (no notify test): client2 emitted join room ${roomForClient2}.`
          );
        });
      });

      clientSocket2.on("room notification", (notification) => {
        console.log(
          `DEBUG (no notify test): client2 received room notification: "${notification}"`
        );
        if (
          notification === `あなたはルーム '${roomForClient2}' に参加しました。`
        ) {
          if (client2SelfNotificationReceived) {
            // 既に自身の参加通知を受け取っているのに再度同じ通知が来た場合は問題の可能性
            return done(
              new Error(
                "Client2 received self-join notification multiple times."
              )
            );
          }
          console.log(
            "DEBUG (no notify test): client2 received self-join notification. Proceeding with client1 logic."
          );
          client2SelfNotificationReceived = true;

          // clientSocket2 の準備ができたので、clientSocket1 を接続・切断
          clientSocket1.on("connect", () => {
            console.log(
              "DEBUG (no notify test): client1 connected. Now disconnecting client1."
            );
            clientSocket1.disconnect(); // client1を切断

            // 少し待って、clientSocket2 が意図しない通知を受け取らないことを確認
            // このタイマーが完了すれば、テスト成功とみなす
            setTimeout(() => {
              console.log(
                "DEBUG (no notify test): Timeout reached. Assuming no unexpected notifications for client2. Test passes."
              );
              done();
            }, 500); // 待機時間は適宜調整
          });
          // clientSocket1 が接続を試みる
          if (!clientSocket1.connected) {
            console.log(
              "DEBUG (no notify test): client1 is not connected, attempting to connect."
            );
            // clientSocket1.connect(); // createClientSocketで自動接続が有効なら不要な場合も
          } else {
            // 既に接続済みならすぐにdisconnect
            console.log(
              "DEBUG (no notify test): client1 was already connected. Disconnecting client1."
            );
            clientSocket1.disconnect();
            setTimeout(() => {
              console.log(
                "DEBUG (no notify test): Timeout reached (client1 already connected case). Test passes."
              );
              done();
            }, 500);
          }
          return; // この通知は処理したので、これ以上このハンドラでエラーにしない
        }

        // client2 が自身の参加通知を受け取った後で、
        // かつ、それが「あなたはルーム...」以外の通知であれば、予期せぬ通知としてエラー
        if (client2SelfNotificationReceived) {
          done(
            new Error(
              `clientSocket2 が予期せぬルーム通知を受信しました: ${notification}`
            )
          );
        } else {
          // 自身の参加通知より前に他の通知が来た場合もエラー（通常はありえないが念のため）
          done(
            new Error(
              `clientSocket2 が自身の参加通知より前に予期せぬ通知を受信: ${notification}`
            )
          );
        }
      });
    });
  });
});
