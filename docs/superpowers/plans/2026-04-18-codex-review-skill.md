# codex-review スキル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現行 `codex` スキルを `codex-review` にリネームし、レビュー特化（新規・resume・収束ループ）に再構成する。

**Architecture:** 新スキル SKILL.md を `claude/.claude/skills/codex-review/` に新規作成し、旧 `claude/.claude/skills/codex/` を削除する。stow 管理下のため、再 stow は不要（シンボリックリンクはディレクトリ単位で追従）。spec: `docs/superpowers/specs/2026-04-18-codex-review-skill-design.md`。

**Tech Stack:** Markdown（Claude Code skills）, GNU Stow

---

### Task 1: 新スキル `codex-review` を作成

**Files:**
- Create: `claude/.claude/skills/codex-review/SKILL.md`

- [ ] **Step 1: SKILL.md を作成**

ファイル内容:

````markdown
---
name: codex-review
description: |
  Codex CLI（OpenAI）にコード・plan・spec のクロスレビューを依頼する。
  新規レビュー / 再レビュー（resume）/ 指摘がなくなるまでのループレビュー に対応。
  トリガー: "codexでレビュー", "codexで再レビュー", "codexの指摘がなくなるまで",
           "codexレビュー", "クロスレビュー", "プランレビュー", "スペックレビュー"
---

# codex-review

Codex CLI（OpenAI）にクロスレビューを依頼するスキル。Claude 自身の作業を Codex に見てもらう、いわばセカンドオピニオン用。

レビュー以外の相談・バグ調査・分析・提案は対象外（クロスレビューにこそ価値がある、という方針）。

## 3つの実行モード

トリガー語句から以下のいずれかを選ぶ。

### モード1: 新規レビュー

「codexでレビュー」「プランレビュー」「スペックレビュー」系のトリガー。

```
codex exec --full-auto --sandbox read-only --cd <project_dir> "<prompt>"
```

### モード2: 再レビュー（resume）

「再レビュー」「更新したからもう一回見て」系のトリガー。直前の Codex セッションのコンテキストを引き継ぐ。

```
codex exec resume --last --full-auto "<prompt>"
```

### モード3: 収束ループ

「指摘がなくなるまで」系のトリガー。重要指摘がゼロになるまで繰り返す。

手順:

1. モード1 で新規レビュー実行
2. 結果を「結果のトリアージ」基準でフィルタ
3. 重要指摘があれば報告 → 修正（ユーザー or Claude）
4. 修正後、モード2（`resume --last`）で再レビュー
5. 重要指摘がゼロになったら終了

## プロンプトのルール

**重要**: codex に渡すリクエストには、以下の指示を**すべて**含めること:

1. 「些細な点への指摘はせず、致命的・本質的な点だけ指摘して。」
2. 「確認や質問は不要です。具体的な提案・修正案・コード例まで自主的に出力してください。」

codex はどうでもいい些細な指摘をしがちなので、(1) のクソリプ防止指示は**全てのリクエストで必須**。

### ファイル参照のパターン

codex にファイルを読ませたい場合、プロンプト内に絶対パスを直接記述する:

- **対象ファイル**: パスをそのまま記述（codex が自動的に読む）
- **参考ファイル**: `(ref: /path/to/file)` の形式で補足コンテキストを渡す

例: `"このプランをレビューして: /path/to/plan.md (ref: /path/to/project/CLAUDE.md)"`

### レビュー粒度の調整

デフォルトで「些細な点への指摘はしない」が入るが、さらに粒度を調整したい場合:
- 網羅的なレビューが欲しい場合: 「致命的な点に加え、改善点も漏れなく指摘して」

## パラメータ

| パラメータ | 説明 |
|-----------|------|
| `--full-auto` | 完全自動モードで実行 |
| `--sandbox read-only` | 読み取り専用サンドボックス（安全な分析用） |
| `--cd <dir>` | 対象プロジェクトのディレクトリ |
| `resume --last` | 前回のセッションを引き継いで実行 |
| `"<request>"` | 依頼内容（日本語可） |

## 使用例

### プランレビュー（新規）

```
codex exec --full-auto --sandbox read-only --cd /path/to/project "このプランをレビューして。些細な点への指摘はせず、致命的な点だけ指摘して。確認や質問は不要です。具体的な提案まで自主的に出力してください: /path/to/plan.md (ref: /path/to/project/CLAUDE.md)"
```

### プランレビュー（更新後の再レビュー）

```
codex exec resume --last --full-auto "プランを更新したのでレビューして。些細な点への指摘はせず、致命的な点だけ指摘して。確認や質問は不要です。具体的な提案まで自主的に出力してください: /path/to/plan.md"
```

### コードレビュー（新規）

```
codex exec --full-auto --sandbox read-only --cd /path/to/project "このプロジェクトのコードをレビューして。些細な点への指摘はせず、致命的・本質的な改善点だけ指摘して。確認や質問は不要です。具体的な修正案とコード例まで自主的に出力してください。"
```

## 実行手順

1. ユーザーから依頼内容を受け取る
2. トリガー語からモード（1/2/3）を判定する
3. 対象プロジェクトのディレクトリを特定する（現在のワーキングディレクトリまたはユーザー指定）
4. **プロンプト末尾に必須指示2つを必ず追加する**
5. codex に読ませたいファイルがある場合、絶対パスをプロンプト内に含める。参考資料は `(ref: ...)` で渡す
6. 選んだモードのコマンド形式で Codex を実行
7. 結果をトリアージし、ユーザーに報告する（下記「結果のトリアージ」）
8. モード3（収束ループ）の場合は、重要指摘がゼロになるまで 6-7 を繰り返す

## 結果のトリアージ

codex の出力を鵜呑みにしない。以下の基準でフィルタリングすること:

**重視する（ユーザーに伝える）**
- 致命的なバグ・ロジックエラー
- セキュリティ上の問題
- データ損失・破壊のリスク
- 仕様との明確な矛盾

**建設的に無視する（ユーザーに伝えない、または軽く触れるだけ）**
- 些細なスタイル・命名の好み
- 過剰な共通化・DRY の押しつけ（3回未満の重複は放置でよい）
- 時期尚早な最適化・パフォーマンス改善の提案
- 「こうした方がベター」レベルの主観的改善案
- 既存コードベースの慣習と合わない提案
````

- [ ] **Step 2: ファイル作成を確認**

Run: `ls -la /home/valda/dotfiles/claude/.claude/skills/codex-review/SKILL.md`
Expected: ファイルが存在

---

### Task 2: 旧 `codex` スキルを削除

**Files:**
- Delete: `claude/.claude/skills/codex/` (ディレクトリごと)

- [ ] **Step 1: 旧スキルディレクトリを削除**

Run: `rm -rf /home/valda/dotfiles/claude/.claude/skills/codex/`

- [ ] **Step 2: 削除を確認**

Run: `ls /home/valda/dotfiles/claude/.claude/skills/ | grep -E '^codex'`
Expected: `codex-review` のみ表示される（旧 `codex` は存在しない）

---

### Task 3: stow で新スキルを反映

**Files:** 変更なし（シンボリックリンクのみ更新）

- [ ] **Step 1: dry-run で差分確認**

Run: `cd /home/valda/dotfiles && ./stow-all.sh -n -v 2>&1 | grep -i codex`
Expected: 旧 `codex` シンボリックリンクの削除と新 `codex-review` のリンク作成が表示される

- [ ] **Step 2: stow 実行**

Run: `cd /home/valda/dotfiles && ./stow-all.sh`
Expected: エラーなし

- [ ] **Step 3: リンク確認**

Run: `ls -la ~/.claude/skills/ | grep codex`
Expected: `codex-review -> ...` が存在し、旧 `codex` リンクは存在しない

---

### Task 4: コミット

- [ ] **Step 1: 変更をステージしてコミット**

Run:
```bash
cd /home/valda/dotfiles
git add claude/.claude/skills/
git status
git commit -m "$(cat <<'EOF'
refactor(skills): codexスキルをcodex-reviewへ改称しレビュー特化に再構成

plugin側のcodex:*名前空間との衝突回避と、実用途（plan/spec/コードの
クロスレビュー）への特化を目的に改称。新規レビュー・再レビュー（resume）・
指摘がなくなるまでの収束ループの3モードを明示化。相談・バグ調査・分析・
提案の記述は削除した。
EOF
)"
```

Expected: コミット成功

---

## Self-Review 結果

- **Spec coverage:** spec の全項目（リネーム / description・トリガー / 3モード / プロンプト必須要素 / ファイル参照 / トリアージ / 削除要素）を Task 1 の SKILL.md 内容でカバー済み。移行（新規作成→削除→stow）は Task 1-3 でカバー。
- **Placeholder scan:** なし
- **Type consistency:** N/A（コードなし）
