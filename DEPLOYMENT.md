# Cloud Run デプロイメントガイド

このガイドでは、Discord ポモドーロボットをGoogle Cloud Runにデプロイする方法を説明します。

## 事前準備

### 1. Google Cloud プロジェクトの設定

```bash
# Google Cloud CLIをインストール（まだの場合）
# https://cloud.google.com/sdk/docs/install

# ログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Discord Bot の設定

Discord Developer Portalで以下を確認：
- Bot Token が取得済み
- Bot に必要な権限が設定済み
- OAuth2 URL でサーバーに招待済み

## デプロイ方法

### 方法1: Google Cloud Build を使用（推奨）

1. **シークレットの作成**
```bash
# Discord Bot のシークレットを作成
echo -n "YOUR_DISCORD_TOKEN" | gcloud secrets create discord-token --data-file=-
echo -n "YOUR_CLIENT_ID" | gcloud secrets create client-id --data-file=-

# または、統合版シークレット
gcloud secrets create discord-secrets --data-file=- <<EOF
DISCORD_TOKEN=YOUR_DISCORD_TOKEN
CLIENT_ID=YOUR_CLIENT_ID
EOF
```

2. **Cloud Build でデプロイ**
```bash
# cloudbuild.yaml を使用してデプロイ
gcloud builds submit --config=cloudbuild.yaml .
```

### 方法2: ローカルビルド + デプロイ

1. **Docker イメージをビルド**
```bash
# ローカルでイメージをビルド
docker build -t gcr.io/YOUR_PROJECT_ID/pomodoro-discord-bot .

# Container Registry にプッシュ
docker push gcr.io/YOUR_PROJECT_ID/pomodoro-discord-bot
```

2. **Cloud Run にデプロイ**
```bash
gcloud run deploy pomodoro-discord-bot \
    --image=gcr.io/YOUR_PROJECT_ID/pomodoro-discord-bot \
    --region=asia-northeast1 \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=5 \
    --min-instances=1 \
    --port=8080 \
    --set-env-vars=PORT=8080 \
    --set-secrets=DISCORD_TOKEN=discord-token:latest,CLIENT_ID=client-id:latest
```

### 方法3: npm スクリプトを使用

```bash
# package.json に定義されているスクリプトを使用
npm run deploy
```

## 設定オプション

### リソース設定

- **メモリ**: 512Mi（推奨）
- **CPU**: 1 vCPU
- **最小インスタンス**: 1（Botを常時稼働）
- **最大インスタンス**: 5（コスト制御）

### 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `PORT` | HTTPサーバーのポート | ○ |
| `DISCORD_TOKEN` | Discord Bot Token | ○ |
| `CLIENT_ID` | Discord Application ID | ○ |

## モニタリング

### ヘルスチェック

- **エンドポイント**: `/health`
- **レスポンス例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600.5,
  "discord": "connected",
  "activeSessions": 2
}
```

### ログ確認

```bash
# Cloud Run ログを確認
gcloud logs tail --follow --format="value(textPayload)" \
    --filter="resource.type=cloud_run_revision AND resource.labels.service_name=pomodoro-discord-bot"
```

### メトリクス監視

Google Cloud Consoleの以下で監視可能：
- Cloud Run > サービス > pomodoro-discord-bot
- Cloud Monitoring でカスタムダッシュボード作成

## トラブルシューティング

### よくある問題

1. **Bot が応答しない**
   - Discord Token が正しいか確認
   - Bot がサーバーに招待されているか確認
   - Cloud Run サービスが起動しているか確認

2. **メモリ不足エラー**
   - メモリ制限を増やす: `--memory=1Gi`

3. **タイムアウトエラー**
   - リクエストタイムアウトを確認
   - min-instances を1に設定してコールドスタートを回避

### デバッグコマンド

```bash
# サービス状態確認
gcloud run services describe pomodoro-discord-bot --region=asia-northeast1

# リビジョン一覧
gcloud run revisions list --service=pomodoro-discord-bot --region=asia-northeast1

# トラフィック設定確認
gcloud run services describe pomodoro-discord-bot --region=asia-northeast1 --format="value(spec.traffic)"
```

## セキュリティ

### 推奨設定

- シークレットマネージャーを使用してトークンを保護
- IAM でアクセス制御
- VPC コネクタ（必要に応じて）

### シークレット管理

```bash
# シークレットの更新
echo -n "NEW_DISCORD_TOKEN" | gcloud secrets versions add discord-token --data-file=-

# シークレットの確認
gcloud secrets versions list discord-token
```

## コスト最適化

- **min-instances**: 常時稼働が必要なら1、そうでなければ0
- **max-instances**: トラフィックに応じて調整
- **CPU allocation**: "CPU is only allocated during request processing"を有効化
- **リージョン**: 最も近いリージョンを選択

## 更新とメンテナンス

### ローリングアップデート

```bash
# 新しいイメージでデプロイ（自動ローリングアップデート）
gcloud builds submit --config=cloudbuild.yaml .
```

### ロールバック

```bash
# 前のリビジョンに戻す
gcloud run services update-traffic pomodoro-discord-bot \
    --to-revisions=PREVIOUS_REVISION=100 \
    --region=asia-northeast1
```

## サポート

問題が発生した場合：
1. Cloud Run ログを確認
2. Discord Bot の状態を確認
3. GitHub Issues で報告