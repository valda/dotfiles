# TODO確認・セッション開始コマンド (/check-todos)

## 概要
新しいClaude Codeセッション開始時に、軽量索引から作業コンテキストを選択し、必要な詳細情報とナレッジを読み込んで優先作業を決定する

## 実行タイミング
- 新しいセッション開始時（**必須**）
- 長時間の中断後の再開時
- プロジェクト切り替え時

## 新しいファイル構成
```
docs/todo/
├── index.md                    # 📋 軽量索引（各コンテキストの要約のみ）
├── contexts/                   # 🎯 作業コンテキスト別詳細
│   ├── [dynamic].md           # プロジェクトに応じて動的に作成
│   ├── [dynamic].md           # 例: infrastructure.md, webapp.md, mobile-app.md
│   └── [dynamic].md           # 例: data-pipeline.md, ml-training.md など
├── knowledge/                  # 🧠 ナレッジベース（コンテキスト別）
│   ├── [dynamic]-learnings.md # 各コンテキストに対応した学習記録
│   └── debug-patterns.md      # 汎用デバッグパターン
└── archive/                    # 📦 完了したタスクのアーカイブ
    ├── 2025-06/
    └── 2025-05/
```

**注意**: コンテキスト名はプロジェクトごとに動的に決定されます。

## 自動実行手順

**注意**: 以下のbashコマンド例は、LLMが実行すべき処理フローを表したものです。実際にはClaude Codeが適切なファイルを読み込み、内容を解析してユーザーに提示します。

### 1. TODOディレクトリの確認と移行チェック
**LLMが実行すべき処理**:
- `docs/todo` ディレクトリの存在を確認
- 新しいファイル構成への移行が必要かチェック
- 既存ファイルが見つかった場合は移行提案を表示

```bash
# 処理フローの例（LLMが内部的に実行）
if [ -d "docs/todo" ]; then
    echo "📁 TODOディレクトリが見つかりました"

    # 新しいファイル構成への移行が必要かチェック
    if [ ! -f "docs/todo/index.md" ]; then
        echo "🔄 新しいファイル構成への移行が必要です"
        echo "💡 既存ファイルを新構成に移行しますか？ (Y/n)"
        echo "   - 既存のタスクファイルを適切なコンテキストに分類"
        echo "   - 学習記録をコンテキスト別に整理"
        echo "   - 軽量索引ファイル(index.md)を作成"
        # ユーザーの回答待ち
    fi
else
    echo "❌ docs/todoディレクトリが存在しません"
    echo "💡 /sync-todos コマンドで作成することをお勧めします"
    exit
fi
```

### 2. 軽量索引の読み込み（index.md）
**LLMが実行すべき処理**:
- `docs/todo/index.md` ファイルを読み込み
- 各コンテキストの要約情報を表示
- ファイルが存在しない場合は新規作成を提案

```bash
# 処理フローの例（LLMが内部的に実行）
if [ -f "docs/todo/index.md" ]; then
    echo "📋 【プロジェクト概要】"
    # LLMがファイル内容を読み込んで表示
    cat docs/todo/index.md
    echo ""
else
    echo "⚠️ index.md が見つかりません。新規作成が必要です。"
fi
```

### 3. 作業コンテキストの選択
**LLMが実行すべき処理**:
- `docs/todo/contexts/` ディレクトリ内のファイルを動的に確認
- 利用可能なコンテキストを自動検出して表示
- 各コンテキストの概要情報を抽出して表示

ユーザーに以下の選択肢を日本語で提示：

```
🎯 **今回のセッションで作業するコンテキストを選択してください：**

利用可能なコンテキスト：
```

```bash
# 処理フローの例（LLMが内部的に実行）
if [ -d "docs/todo/contexts" ]; then
    # 既存のコンテキストファイルを動的に検出
    for context_file in docs/todo/contexts/*.md; do
        if [ -f "$context_file" ]; then
            context_name=$(basename "$context_file" .md)
            echo "  📂 $context_name"
            # LLMがファイルの最初の数行から概要を抽出
        fi
    done

    # 新しいコンテキスト作成の選択肢を追加
    echo "  ➕ 新しいコンテキストを作成"
else
    echo "⚠️ contextsディレクトリが見つかりません"
fi
```

```
**選択してください：**
- 既存のコンテキスト名（動的に表示）
- N) new (新しいコンテキストの作成)
- A) all (全コンテキストの概要表示)

入力:
```

### 4. 選択されたコンテキストの詳細読み込み
ユーザーの選択に基づいて該当ファイルを読み込み：

```bash
# 例: webapp が選択された場合
if [ "$USER_CHOICE" = "W" ] || [ "$USER_CHOICE" = "webapp" ]; then
    echo "🚀 【Rails + Frontend 統合開発の詳細タスク】"
    if [ -f "docs/todo/contexts/webapp.md" ]; then
        cat docs/todo/contexts/webapp.md
    else
        echo "⚠️ webapp.md が見つかりません"
    fi
    echo ""

    echo "🧠 【WebApp関連の過去の学習記録】"
    if [ -f "docs/todo/knowledge/webapp-learnings.md" ]; then
        # 最新の10エントリーのみ表示
        tail -50 docs/todo/knowledge/webapp-learnings.md
    else
        echo "📝 学習記録はまだありません"
    fi
    echo ""

    echo "🔍 【WebApp関連のデバッグパターン】"
    if [ -f "docs/todo/knowledge/debug-patterns.md" ]; then
        # WebApp関連のパターンのみフィルタリング
        grep -A 5 -B 1 -i "Rails\|Ruby\|Frontend\|JavaScript\|CSS\|HTML\|React\|Vue" docs/todo/knowledge/debug-patterns.md || tail -20 docs/todo/knowledge/debug-patterns.md
    fi
fi

# 例: infrastructure が選択された場合
if [ "$USER_CHOICE" = "I" ] || [ "$USER_CHOICE" = "infrastructure" ]; then
    echo "🔥 【インフラ関連の詳細タスク】"
    if [ -f "docs/todo/contexts/infrastructure.md" ]; then
        cat docs/todo/contexts/infrastructure.md
    else
        echo "⚠️ infrastructure.md が見つかりません"
    fi
    echo ""

    echo "🧠 【インフラ関連の過去の学習記録】"
    if [ -f "docs/todo/knowledge/infra-learnings.md" ]; then
        # 最新の10エントリーのみ表示
        tail -50 docs/todo/knowledge/infra-learnings.md
    else
        echo "📝 学習記録はまだありません"
    fi
fi
```

### 5. 具体的なタスク優先度の確認

選択されたコンテキスト内で、今回のセッションの具体的な作業を決定：

```
📋 **今回のセッションで取り組む具体的なタスクを選択してください：**

表示されたタスクから：
1️⃣ 最優先で解決すべき課題はありますか？
2️⃣ 継続中で完了を目指すタスクはありますか？
3️⃣ 新規で着手したいタスクはありますか？
4️⃣ 過去の失敗パターンを避けながら進めたいものはありますか？

**今回のセッション目標を設定してください：**
- 具体的なタスクID または タスク名
- 予想作業時間
- 期待する成果物
- 注意すべき過去の失敗例（あれば）
```

### 6. セッション開始の準備完了

```
✅ **セッション開始準備完了**

📂 作業コンテキスト: [選択されたコンテキスト]
🎯 今回の目標: [設定された目標]
⏰ 予想時間: [予想時間]
📝 関連ナレッジ: 読み込み済み

🚀 作業を開始してください！
セッション終了時は /sync-todos で進捗と学習内容を記録することをお忘れなく。
```

## 出力形式
- すべての表示内容は日本語で出力
- 絵文字を使用して視認性を向上
- 重要度に応じた色分け表示（可能な場合）
- 選択されたコンテキスト以外の詳細は読み込まない（軽量化）

## 注意事項
- このコマンドは **毎セッション開始時に必ず実行**
- 最初は軽量な index.md のみを読み込み、必要な詳細だけを後から読み込む
- コンテキスト選択により、関係ない大きなファイルの読み込みを回避
- 新しいファイル構成への移行支援機能を含む
- セッション終了時には必ず /sync-todos の実行を促す
- 選択したコンテキストに関連する過去の学習・失敗例を必ず確認
