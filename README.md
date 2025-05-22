[![Docker Image CI](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/docker-image.yml/badge.svg)](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/docker-image.yml)
[![Node.js CI](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/hideyuki-matsuyama/websocket_chat_demo/actions/workflows/nodejs-ci.yml)

# 何コレー？

- WebSocket を用いたチャットアプリのデモです。投稿をリアルタイムで更新します
  ![f3e2f5f736a0153fbd7b0fa27f09c928](https://github.com/user-attachments/assets/efa591e5-6658-4d46-bafd-0348e393b6ef)

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
