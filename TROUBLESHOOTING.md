# Cloud Run トラブルシューティングガイド

## `TokenInvalid` エラーの解決方法

`Error [TokenInvalid]: An invalid token was provided.` エラーは、Discord Botのトークンが正しく設定されていないことを示します。

### 1. 即座に確認すべきこと

#### Discord Botトークンの確認
```bash
# 1. Discord Developer Portalでトークンを確認
# https://discord.com/developers/applications

# 2. トークンが最新であることを確認
# - 古いトークンは無効になっている可能性があります
# - 必要に応じて「Reset Token」で新しいトークンを生成

# 3. トークン形式の確認
# 正しい形式: MTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 長さ: 通常70文字程度
```

### 2. Cloud Runシークレット設定の確認

#### シークレットの存在確認
```bash
# デバッグスクリプトを実行
./debug-secrets.sh YOUR_PROJECT_ID

# 手動確認
gcloud secrets list | grep discord
gcloud secrets versions list discord-token
gcloud secrets versions list client-id
```

#### シークレットの作成（存在しない場合）
```bash
# Discord Tokenシークレットの作成
echo -n "YOUR_DISCORD_TOKEN" | gcloud secrets create discord-token --data-file=-

# Client IDシークレットの作成
echo -n "YOUR_CLIENT_ID" | gcloud secrets create client-id --data-file=-
```

#### シークレットの更新（間違っている場合）
```bash
# 既存シークレットの更新
echo -n "NEW_DISCORD_TOKEN" | gcloud secrets versions add discord-token --data-file=-
echo -n "NEW_CLIENT_ID" | gcloud secrets versions add client-id --data-file=-
```

### 3. Cloud Runサービス設定の確認

#### 現在の設定を確認
```bash
gcloud run services describe pomodoro-discord-bot \
    --region=asia-northeast1 \
    --format="value(spec.template.spec.template.spec.containers[0].env[].name,spec.template.spec.template.spec.containers[0].env[].value)"
```

#### 環境変数の再設定
```bash
gcloud run services update pomodoro-discord-bot \
    --region=asia-northeast1 \
    --set-secrets=DISCORD_TOKEN=discord-token:latest,CLIENT_ID=client-id:latest
```

### 4. デプロイメントの問題

#### 完全な再デプロイ
```bash
# Cloud Buildを使用
gcloud builds submit --config=cloudbuild.yaml .

# 手動デプロイ
gcloud run deploy pomodoro-discord-bot \
    --source . \
    --region=asia-northeast1 \
    --allow-unauthenticated \
    --set-secrets=DISCORD_TOKEN=discord-token:latest,CLIENT_ID=client-id:latest
```

### 5. ログの確認

#### リアルタイムログ監視
```bash
gcloud logs tail --follow \
    --filter="resource.type=cloud_run_revision AND resource.labels.service_name=pomodoro-discord-bot" \
    --format="value(textPayload)"
```

#### 環境変数デバッグログの確認
新しいコードには詳細なデバッグログが含まれています：
```
🔍 Environment Variable Debug:
- DISCORD_TOKEN exists: true/false
- DISCORD_TOKEN length: XXX
- DISCORD_TOKEN prefix: MTxxxxxxxx...
- CLIENT_ID exists: true/false
- CLIENT_ID: YOUR_CLIENT_ID
```

### 6. よくある原因と解決策

| 問題 | 症状 | 解決策 |
|------|------|--------|
| トークンが設定されていない | `DISCORD_TOKEN exists: false` | シークレットを作成・設定 |
| 古いトークン | `TokenInvalid`エラー | Discord Developer Portalで新しいトークンを生成 |
| トークンの形式エラー | トークン長が異常 | 正しいBot Tokenを確認（User Tokenではない） |
| シークレット設定ミス | Cloud Runで環境変数が見えない | `--set-secrets`でシークレットを再設定 |
| 権限不足 | `Permission denied` | Cloud RunサービスアカウントにSecret Managerアクセス権を付与 |

### 7. 段階的デバッグ手順

#### Step 1: ローカルテスト
```bash
# .envファイルで動作確認
cp .env.example .env
# .envにトークンを設定
npm start
```

#### Step 2: シークレット作成
```bash
# 正しいトークンでシークレット作成
echo -n "VERIFIED_TOKEN" | gcloud secrets create discord-token --data-file=-
echo -n "VERIFIED_CLIENT_ID" | gcloud secrets create client-id --data-file=-
```

#### Step 3: 権限確認
```bash
# Cloud Runサービスアカウントの確認
gcloud run services describe pomodoro-discord-bot \
    --region=asia-northeast1 \
    --format="value(spec.template.spec.serviceAccountName)"

# Secret Manager権限の付与
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"
```

#### Step 4: 完全再デプロイ
```bash
# 古いリビジョンを削除して新しいデプロイ
gcloud builds submit --config=cloudbuild.yaml .
```

### 8. 緊急時の回復手順

#### 最小構成での動作確認
```bash
# 最小限の設定でデプロイ
gcloud run deploy pomodoro-discord-bot-test \
    --source . \
    --region=asia-northeast1 \
    --allow-unauthenticated \
    --set-env-vars=DISCORD_TOKEN=YOUR_TOKEN,CLIENT_ID=YOUR_CLIENT_ID
```

#### デバッグモードでの起動
```bash
# 詳細ログ出力
gcloud run deploy pomodoro-discord-bot \
    --source . \
    --region=asia-northeast1 \
    --set-env-vars=NODE_ENV=development,DEBUG=*
```

## 追加サポート

### ヘルプの取得
```bash
# サービスの詳細確認
gcloud run services describe pomodoro-discord-bot --region=asia-northeast1

# 最新のログ取得
gcloud logs read --filter="resource.type=cloud_run_revision" --limit=50
```

### 問題が解決しない場合
1. Discord Developer Portalで新しいBotを作成
2. 新しいトークンでテスト
3. 最小構成から段階的に機能を追加
4. GitHub Issuesで報告

この手順で99%の`TokenInvalid`エラーは解決できます。