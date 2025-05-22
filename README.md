[![Docker Image CI](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/docker-image.yml/badge.svg)](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/docker-image.yml)
[![Node.js CI](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/nodejs-ci.yml)

# 何コレー？

- WebSocket を用いたチャットアプリのデモです。投稿をリアルタイムで更新します

## スクショ
![c9897ab7ed71f1c6745ff3d14e4b1b28](https://github.com/user-attachments/assets/398fab3a-a5ec-422e-a2c7-46d6cf38e5d2)


## はじめ方

```sh
docker-compose up --build
```

## メモ

```sh
% npm init -y
% npm install express socket.io
% npm install --save-dev nodemon livereload connect-livereload
```
