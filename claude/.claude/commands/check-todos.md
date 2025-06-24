# TODO確認・セッション開始コマンド (/check-todos)

## 概要
新しいClaude Codeセッション開始時に、プロジェクトの現在のタスク状況・過去の知見を確認し、優先作業を決定する

## 実行タイミング
- 新しいセッション開始時（**必須**）
- 長時間の中断後の再開時
- プロジェクト切り替え時

## 自動実行手順

### 1. TODOディレクトリの確認
```bash
# プロジェクトルートに移動してTODOディレクトリの存在確認
cd {project_root}
if [ -d "docs/todo" ]; then
    echo "📁 TODOディレクトリが見つかりました"
    ls -la docs/todo/*.md 2>/dev/null || echo "⚠️  タスクファイルが見つかりません"
else
    echo "❌ docs/todoディレクトリが存在しません"
    echo "💡 /sync-todos コマンドで作成することをお勧めします"
fi
```

### 2. 各タスクファイルの内容確認と要約
以下の順序でファイルを確認し、日本語で要約を表示：

#### 🔥 高優先度（infrastructure-issues.md）
```bash
if [ -f "docs/todo/infrastructure-issues.md" ]; then
    echo "🔥 【インフラ関連の緊急課題】"
    cat docs/todo/infrastructure-issues.md
    echo ""
fi
```

#### ⚠️ 中優先度（development-tasks.md）
```bash
if [ -f "docs/todo/development-tasks.md" ]; then
    echo "⚠️ 【開発タスク】"
    cat docs/todo/development-tasks.md
    echo ""
fi
```

#### 📝 一般タスク（general-todos.md）
```bash
if [ -f "docs/todo/general-todos.md" ]; then
    echo "📝 【一般的なTODO】"
    cat docs/todo/general-todos.md
    echo ""
fi
```

#### 🐛 バグ報告（bugs.md）
```bash
if [ -f "docs/todo/bugs.md" ]; then
    echo "🐛 【バグ報告】"
    cat docs/todo/bugs.md
    echo ""
fi
```

#### 🧠 セッション知見（session-learnings.md）
```bash
if [ -f "docs/todo/session-learnings.md" ]; then
    echo "🧠 【過去のセッション学習記録】"
    # 最新の3エントリーのみ表示（全体が長すぎる場合）
    tail -50 docs/todo/session-learnings.md
    echo ""
fi
```

#### 🔍 デバッグログ（debug-log.md）
```bash
if [ -f "docs/todo/debug-log.md" ]; then
    echo "🔍 【最近のデバッグ・試行錯誤記録】"
    # 最新の問題解決記録を表示
    tail -30 docs/todo/debug-log.md
    echo ""
fi
```

### 3. その他のタスクファイル確認
```bash
# 上記以外のタスクファイルを探して表示
find docs/todo -name "*.md" -not -name "infrastructure-issues.md" \
    -not -name "development-tasks.md" -not -name "general-todos.md" \
    -not -name "bugs.md" -exec echo "📋 {}" \; -exec cat {} \;
```

### 4. ユーザーとの優先度確認対話

表示後、以下の質問を日本語で行う：

```
📋 **今回のセッションの作業優先度を教えてください：**

1️⃣ 緊急度の高いインフラ問題がありますか？
2️⃣ 完了予定の開発タスクはありますか？
3️⃣ 新しく発見した課題はありますか？
4️⃣ 今回のセッションで重点的に取り組みたい項目は？
5️⃣ 過去の知見・失敗例から参考にすべきことはありますか？

**選択してください：**
- A) 緊急課題を最優先で対応
- B) 継続中の開発タスクを進行
- C) 新規タスクの計画・設計
- D) バグ修正・改善作業
- E) 過去の失敗を避けながら慎重に進行
- F) その他（具体的に指定）
```

### 5. セッション目標の設定

ユーザーの回答に基づいて：
- 今回のセッションの主要目標を1-3個設定
- 予想所要時間を確認
- 必要なファイルやリソースを特定
- 作業完了時の成果物を明確化

## 出力形式
- すべての表示内容は日本語で出力
- 絵文字を使用して視認性を向上
- 重要度に応じた色分け表示（可能な場合）

## 注意事項
- このコマンドは **毎セッション開始時に必ず実行**
- タスクファイルが存在しない場合は、新規作成を提案
- 長期課題と短期タスクを明確に区別して表示
- **過去の知見・失敗例を必ず確認**して同じ失敗を回避
- セッション終了時には必ず /sync-todos の実行を促す
- セッション中の重要な学習・発見は必ず記録することを意識
