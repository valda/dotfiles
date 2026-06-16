---
name: tmux
description: "Remote control tmux sessions for interactive CLIs and remote ops (ssh, rails console, sidekiq tail, python, gdb, etc.) by sending keystrokes and scraping pane output. Covers both user-owned tmux sessions (stg/prod ops) and agent-created private-socket sessions."
license: Vibecoded
---

# tmux Skill

tmux をプログラマブルな端末として使い、対話的 CLI を操作する。利用は 2 モード:

- **モード A: ユーザー所有セッション**（デフォルトソケット）— ユーザーが開いた SSH / rails console / sidekiq tail などの pane に send-keys / capture-pane する。`-S` は付けない。
- **モード B: エージェント専用セッション**（プライベートソケット）— 自分で REPL やデバッガを立ち上げる。ユーザーの tmux と分離するため専用ソケットを使う。

実務ではモード A が大半。

## モード A: ユーザー所有セッションの操作

### 1. 「再列挙 → 確認 → 送信」の順を守る

セッション番号・pane はターン間で容易に変わる（`can't find pane` を起こす）。記憶したターゲットに直接送らず、毎回確認:

```bash
./scripts/find-sessions.sh                 # デフォルトサーバの全 pane を pane id 付きで列挙
./scripts/find-sessions.sh -q ssh          # ssh している pane だけ
tmux capture-pane -p -J -t {target} -S -30 # 送信前に中身を見て想定の pane か確認
```

- ターゲット形式は `{session}:{window}.{pane}`（例 `6:1.2`）または pane id `%12`。pane id は分割や入れ替えに強いので、**列挙で得た `%N` を同一作業内では使い回す**。ただしターンをまたいだら再列挙。
- 中身を確認せずに send-keys しない。コマンド実行系は capture で現在のプロンプト状態（シェルか console か、何か走っていないか）を見てから。

### 2. 本番・共有 pane の安全ルール

- 本番に繋がっている pane は原則 **読み取り専用**（capture-pane、読み取りクエリのみ）。書き込み・状態変更はユーザーの明示的指示があるときだけ。
- **直接 Bash で拒否された操作を tmux send-keys 経由で流さない**。権限上は同一操作であり、迂回とみなされる。
- 自分が起動していないプロセスに `C-c` を送らない（ユーザーの本番シェルを殺すリスク）。中断が必要ならユーザーに確認。
- ユーザー所有 pane は作業後も **開けたまま残す**。kill-session / kill-pane はユーザー指示があるときだけ。

### 3. 完了待ちは until ループ（`sleep N; capture` は禁止）

ハーネスは `sleep 30; tmux capture-pane ...` 形式をブロックする。完了マーカーやプロンプト復帰を until ループで待つ:

```bash
# プロンプト復帰待ち（正規表現は事前に capture で実物を確認して合わせる。
# 例: リモート bash は 'gcolle4\$ *$'、ローカル zsh (powerlevel系) は '❯ *$'）
until tmux capture-pane -p -t {target} -S -3 | grep -qE '[$%#❯] *$'; do sleep 3; done
tmux capture-pane -p -J -t {target} -S -40
```

- 行末アンカー `*$` 付きで pane 末尾数行（`-S -3`）だけを見ると誤マッチしにくい。
- 長時間（数分超）かかる処理は until ループを `run_in_background: true` で回すか、ヘルパーを使う:

```bash
./scripts/wait-for-text.sh -t {target} -p 'DONE_MARKER' -T 120
./scripts/wait-for-text.sh -t {target} -p '\$ *$' --tail -T 60   # プロンプト復帰待ち
```

### 4. 出力はマーカーで拾う

ノイズの多い pane（SQL ログが流れる rails console 等）では、実行コマンド側に **一意のマーカー** を仕込み、capture を grep する:

```bash
tmux send-keys -t {target} -l -- 'echo "RESULT_X=$(date +%s)"'; tmux send-keys -t {target} Enter
until tmux capture-pane -p -t {target} -S -50 | grep -q 'RESULT_X='; do sleep 2; done
tmux capture-pane -p -J -t {target} -S -50 | grep 'RESULT_X='
```

## モード B: エージェント専用セッション

```bash
SOCKET_DIR=${CLAUDE_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/claude-tmux-sockets}
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/claude.sock"
SESSION=claude-python                  # slug 形式、スペース禁止
tmux -S "$SOCKET" -f /dev/null new-session -d -s "$SESSION" -n shell
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -- 'python3 -q' Enter
tmux -S "$SOCKET" capture-pane -p -J -t "$SESSION":0.0 -S -200
tmux -S "$SOCKET" kill-session -t "$SESSION"   # 作業完了後は必ず掃除
```

- **`-S`（パス）と `-L`（ソケット名）を混在させない**。このスキルでは常に `-S "$SOCKET"`。
- 新しい pane / セッション直後はシェル起動前で入力が落ちることがある。最初の send-keys の前にプロンプトを待つ。
- セッション開始直後、ユーザーに監視用コマンドをコピペ可能な形で必ず提示する（最後にも再掲）:

```
To monitor this session yourself:
  tmux -S "$SOCKET" attach -t claude-python    # detach: Ctrl+b d
Or capture once:
  tmux -S "$SOCKET" capture-pane -p -J -t claude-python:0.0 -S -200
```

### 自分の Claude Code が tmux 内で動いている場合（共有 pane）

「新しい pane で見せて」「tmux で見せて」系の依頼では、プライベートソケットでなく **ユーザーに見える pane** を作る:

```bash
printf 'TMUX=%s TMUX_PANE=%s\n' "${TMUX:-}" "${TMUX_PANE:-}"   # ツール実行環境で tmux 内か確認
SHARED_PANE=$(tmux split-window -v -P -F '#{pane_id}' -t "$TMUX_PANE")
tmux select-pane -t "$SHARED_PANE" -T claude-work
# プロンプトを待ってから送信。pane は基本開けたまま残す
```

`TMUX`/`TMUX_PANE` が空ならプライベートソケットにフォールバックするか、ユーザーに対象を聞く。

## 入力の送り方

- 任意テキストは literal 送信: `tmux send-keys -t {target} -l -- "$text"` のあと別コマンドで `Enter`。`-l` を忘れると空白やキー名が解釈されて事故る。
- 制御キー: `tmux send-keys -t {target} C-c` / `C-d` / `Escape` など。
- **長い・クォート地獄なペイロード（複数行 Ruby、ワンライナー SQL 等）は load-buffer / paste-buffer**。エスケープ問題が消える:

```bash
cat > /tmp/payload.txt <<'EOF'
bin/rails runner 'puts Content.where(...).count'
EOF
tmux load-buffer /tmp/payload.txt && tmux paste-buffer -t {target} && sleep 1 && tmux send-keys -t {target} Enter
```

paste 直後の Enter が bracketed paste に飲まれることがあるため `sleep 1` を挟む。モード B では各コマンドに `-S "$SOCKET"` を付ける。

## 対話ツール別レシピ

- **rails console / pry**: 複数行コードは **1 行に潰して** 送る（継続プロンプト `..>` に入ると制御不能になりやすい）。長いものは `bin/rails runner` + load-buffer が安全。出力は `grep -vE 'pry\(main\)|DEBUG|SELECT|Load \('` で SQL ノイズを除去し、結果はマーカー（`puts "[[...]]"` や JSON 1 行）で拾う。プロンプト待ちは `pry\(main\)>` / `irb.*>`。
- **Python REPL**: 必ず `PYTHON_BASIC_REPL=1` を付けて起動（新 REPL は send-keys と干渉する）。プロンプト `^>>>` を待ってから送る。
- **デバッガ**: 指定がなければ lldb を既定に。gdb は最初に `set pagination off`。中断は `C-c`、終了は `quit` → `y`。
- **psql / mysql / node 等**: 同パターン — 起動 → プロンプト待ち → literal 送信 → capture。

## 出力の読み取り

- 基本形: `tmux capture-pane -p -J -t {target} -S -200`（`-J` で折返し行を結合、`-S -N` で履歴 N 行）。
- 一時的に attach して目視も可: `tmux -S "$SOCKET" attach -t "$SESSION"`、detach は `Ctrl+b d`。

## よくある落とし穴

1. 古いターゲットへの送信 → `can't find pane`。**送信前に必ず再列挙**（モード A 第 1 則）。
2. `sleep 30; tmux capture` → ハーネスにブロックされる。until ループか `wait-for-text.sh` を使う。
3. `-l --` なしの send-keys でスペース・キー名が解釈される。
4. zsh では `for s in dir/*.sock` がマッチなしでエラー（`no matches found`）。glob には `ls ... 2>/dev/null` か `find` を使う（`find-sessions.sh` は対応済み）。
5. Bash で拒否された操作の send-keys 迂回（権限的に同一操作。やらない）。
6. paste-buffer 直後の Enter が paste に飲まれる → `sleep 1` を挟む。
7. シークレット（パスワード、トークン）を pane に流さない。pane 履歴に残る。
8. モード B のセッションを放置（kill-session を忘れる）／逆にユーザー所有 pane を勝手に kill する。

## ヘルパースクリプト

- `./scripts/find-sessions.sh [-S SOCKET] [--all] [-q QUERY]` — pane 列挙（pane id 付き）。引数なしでデフォルトサーバ、`--all` でプライベートソケット群も走査。
- `./scripts/wait-for-text.sh [-S SOCKET] -t TARGET -p PATTERN [-F] [--tail] [-T 秒] [-i 秒] [-l 行]` — パターン出現までポーリング。match で exit 0、タイムアウトで exit 1（直近 capture を stderr に出す）。

スクリプトパスはこの SKILL.md からの相対（`~/.claude/skills/tmux/scripts/`）。カレントディレクトリ相対で呼ばない。
