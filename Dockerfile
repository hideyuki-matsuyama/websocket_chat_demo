# ベースイメージとして公式のNode.jsイメージを使用 (LTS版を推奨)
FROM node:22-slim

# アプリケーションディレクトリを作成
WORKDIR /usr/src/app

# アプリケーションの依存関係をインストール
# package.json と package-lock.json (あれば) をコピー
# ワイルドカードを使用して両方に対応
COPY package*.json ./

# npm install を実行
RUN npm install
# 本番環境向けには npm ci --only=production を検討

# アプリケーションのソースコードをコンテナにコピー
COPY . .

# アプリケーションがリッスンするポートを指定
EXPOSE 3000

# アプリケーションを起動するコマンド
CMD [ "node", "server.js" ]
