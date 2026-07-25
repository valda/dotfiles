---
name: codex-yolo-implement
description: |
  Codex CLI（OpenAI）に plan を渡し、YOLO モードで実装させる。
  Claude が外側でループを回し、codex の完了申告を実走検証で二重チェックして
  plan を完遂させる。codex-cross-review の収束ループ構造を実装フェーズに転用。
  トリガー: "codexで実装", "codexに実装させる", "codex implement",
           "plan を codex に投げる", "plan を codex に流す",
           "codex にプランを走らせる"
---

# codex-yolo-implement

Codex CLI（OpenAI）に plan を渡し、YOLO モード (`--dangerously-bypass-approvals-and-sandbox`) で実装させるスキル。Claude は外側でループを回し、codex の完了申告を **実走検証で二重チェック** する。

`codex exec` には `/goal` 相当の Ralph loop フラグが無い（`/goal` は TUI スラッシュコマンドのみ）ため、ループ制御は Claude 側が担う。出力は codex の標準出力をそのまま読む（JSON スキーマ強制はしない）。

**YOLO は全ディスクへの書き込み・任意のネットワーク実行・全承認スキップを許す。信頼している作業ディレクトリでのみ使う。** 起動前に `git status` を確認する（手順 2）。

## コマンド形式

プロンプトは Write tool で一時ファイルに書き出し、stdin から読ませる。出力はログファイルへ直接 redirect する。

### 初回

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  -C <project_dir> \
  - < /tmp/codex-prompt-<scope>.txt > /tmp/codex-output-<scope>.log 2>&1
```

### 継続（resume）

```bash
codex exec resume --last \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  - < /tmp/codex-resume-<scope>.txt > /tmp/codex-output-<scope>-resume.log 2>&1
```

`-C, --cd` と `-s, --sandbox` は `resume` に存在しない（元セッションを引き継ぐ）。YOLO フラグは resume 側でも明示的に渡す。

### この形式である理由

- `"$(cat <<'PROMPT' ...)"` の引数渡しは、bg 起動時に codex が CPU 0% のまま無限ハングすることがある。ファイル + stdin 経由なら再現しない。
- `| tail -N` を挟むと `tail` が EOF まで入力をバッファするため、実行中の出力ファイルが 0 バイトのままになり、正常進行とハングの判別ができなくなる。直接 redirect すれば逐次書き込まれ、`tail -100 /tmp/codex-output-<scope>.log` で随時追える。
- `sleep N && tail` 型のポーリングは Claude Code ハーネスが `Blocked:` で弾く。進捗待ちは bg 起動 + タスク完了通知が基本で、途中観察は sleep なしの単発コマンドで行う。Monitor と ScheduleWakeup を併用すると wakeup が重複発火して無駄ターンを消費する。

## プロンプトのルール

codex に渡す **初回** プロンプトに以下 3 つをすべて含める。

1. **出力規約**:
   > 最終メッセージは以下の見出しを含む Markdown で返してください:
   > - `## 実装結果` — 今ターンの作業概要（変更ファイル、変更の要旨）
   > - `## 完了状況` — 一行目に `完了` または `未完了` のいずれか一語を必ず書き、続けて根拠を一文
   > - `## 検証コマンド` — `完了` の場合、Claude が再現可能な bash コマンドを箇条書き（テスト・lint・型チェックなど）
   > - `## 残タスク` — `未完了` の場合、残作業を箇条書き

2. **確認・質問不要**:
   > 確認や質問は不要です。不明点があっても妥当なデフォルトを採用し、`## 実装結果` にその根拠を一文で追記してください。

3. **git commit 禁止**:
   > `git commit` / `git push` は実行しないでください。変更は作業ツリーに残すだけで構いません（コミットはユーザーが検証後に手動で行います）。

見出しの順序や装飾が多少崩れても Claude が意味で抽出する。読み取れない場合は規約を再提示して resume。

### ファイル参照

- **対象 plan**: 絶対パスをプロンプトに直接記述（codex は `-C` で cwd を変えるため相対パス不可）。codex は OS のファイルシステム経由で読むので未コミットの plan でも参照できる。
- **参考ファイル**: `(ref: /path/to/file) ← 一言で理由` で渡す。理由付き（「key 規約・orphan ガードを踏襲」等）の方が参照精度が上がる。

例: `次の plan を実装してください: /tmp/plans/feature-x.md (ref: /home/valda/wc/myapp/CLAUDE.md) ← 規約`

### 1 イテレーション完走に効く追加要素

- **スコープ厳守の明示**: 「変更は上記 N ファイル + 対応する spec のみ。新規の設定キー・抽象化・ブランド分岐は追加しない」
- **設計上の罠の焼き込み**: plan レビューで洗い出した「codex が踏みがちなバグ」をコード例付きで列挙（例:「`-ss` は input 側 seek として渡す」）
- **テスト方針**: 重い外部コマンド（ffmpeg 等）は「stub すること（実バイナリを走らせない）」と明記。無いと不安定なテストを書く
- **雛形コミット参照**: 既存パターンの横展開なら「雛形はコミット `<sha>`。着手前に `git show <sha>` を読むこと」
- **完了条件のコマンド列挙**: `bin/rubocop -A` / `bin/rspec <対象spec>` 等を「実装の最後に必ず通すこと」として箇条書き。codex が自前で検証を回すようになる
- **プロジェクト規約ファイル**: CLAUDE.md に加え関連する `.claude/rules/*.md` も `(ref:)` で渡す。codex はリポジトリ固有の規約（docs/log.md は新しい日付が先頭、等）を知らない

## 実行手順

1. 依頼から plan ファイルの絶対パス（または plan 本文）、対象プロジェクト dir（未指定なら現在の cwd）、参考ファイルを特定する。

2. **事前チェック**: 対象 dir で `git status -s` と `free -h`。未コミット変更が今 codex に実装させる plan / 関連 docs だけならそのまま進める。無関係な変更が紛れていればユーザーに続行可否を確認し、stash / 別ブランチに退避してから進める。

3. **実装ブランチを切る**: `git checkout -b <feat|fix>/<scope>`。main を保護し、検証 pass 後の push + PR 作成にそのまま繋がる。未コミット変更は新ブランチに乗る。

4. **プロンプトファイル作成 → 初回実行**: Write で `/tmp/codex-prompt-<scope>.txt` を書き出し（必須指示 3 つを含む）、上記コマンド形式を bg で起動（`run_in_background: true`、`timeout: 900000`）。plan の規模次第で数分〜15 分以上かかる。途中観察は単発で `tail -100 <log>` / `git status -s | wc -l` / `ps -p <PID> -o etime,cputime,stat`（起動直後の tail はプロンプトエコー段階で意味がない）。

5. **完了通知後、`ps` で codex プロセスの終了を確認する**。完了申告（`tokens used` 出力）後もプロセスが生き残り、Claude の手編集をファイルごと書き戻すことがある。残っていれば TaskStop で止める。これが済むまで Edit / 手動修正をしない。

6. `tail -150 <log>` で末尾を読み、見出しごとに分岐（`## 実装結果` 以降は出力末尾近くに来る）:
   - `## 完了状況` 一行目が `完了` → 完了判定へ。全 pass なら `git diff --stat` の概略を添えて完了報告
   - `## 完了状況` 一行目が `未完了` → 残タスクテンプレートで resume
   - 出力規約から外れている → 規約再提示テンプレートで resume

7. 各 resume 前に `error_signature` を計算し直前と比較。2 連続一致 → エスカレート。`iteration > max_iterations`（default 10）→ 上限到達をユーザーに報告して中断。

## ループ制御

### 完了判定（二重チェック）

1. `## 完了状況` の一行目が `完了` であること
2. `## 検証コマンド` の各コマンドを `cd <project_dir> && <cmd>` で実走する。**cwd は対象 dir 固定**（Claude 自身の cwd で走らせない）。lint・brakeman・diff check など副作用のないものは Bash の並列呼び出しで同時に走らせてよいが、**同一テスト DB を共有する rspec は直列**（DB 競合で偽陽性の失敗が出る）
3. **diff 自体も読む**。「完了申告 + テスト pass」をすり抜ける典型は i18n locale のパリティ欠落、`docs/log.md` の挿入位置規約違反、呼び出し側での引数渡し漏れ。locale を触らせたら `bin/rspec spec/i18n_spec.rb` を検証に追加し、ファイル末尾改行やログの並び順など規約面は目視で拾う
4. 全 pass で完了。1 つでも失敗したら検証失敗テンプレートで resume

### 継続プロンプト（テンプレート）

resume プロンプト冒頭には **前回指摘・前回作業の 1 行要約** を入れる（例:「前回指摘（rescue が 4xx まで retry 対象になっていた）に対応した修正を依頼します」）。codex の文脈復帰精度が上がる。

**`未完了` の場合**:

```
残タスク（あなたが先ほど返したもの）:
- <残タスク[0]>
- <残タスク[1]>

続けて plan を完了させてください。完了したと判断したら `## 完了状況: 完了` と `## 検証コマンド` を含めて返してください。
```

**検証失敗の場合**:

```
あなたは `## 完了状況: 完了` を返しましたが、検証コマンドが以下のとおり失敗しました:

$ <failing_cmd>
<output 末尾 500B>

`完了` を撤回し（`## 完了状況: 未完了` として）、原因を修正したうえで再度返してください。
```

「`完了` を撤回し」の文言は必須。これがないと codex が「ほぼ完了」のまま小修正で押し切り、`完了` を返し続ける。

### 上限と停滞検出

- `max_iterations = 10`（デフォルト）
- 各ターン後に `error_signature` を計算して直前と比較:
  - **検証失敗時**: `(failing_cmd, output 末尾 500B の SHA-256 前 12 桁)`
  - **未完了時**: `## 残タスク` セクション全文（前後空白除去後）の SHA-256 前 12 桁
- 2 ターン連続で同じ signature → 盲目的に resume せずユーザーにエスカレート:

  ```
  同じエラーが 2 ターン続きました。
  $ <failing_cmd> が以下のとおり落ちています:
  <output 末尾>

  介入が必要そうです。続行 / 中断 / 修正方針指示、どれにしますか？
  ```

## ハング / OOM

bg 実行中、以下が揃ったらハング:

| 指標 | ハング判定値 |
|---|---|
| `wc -c /tmp/codex-output-<scope>.log` | 0 バイトのまま起動から 3 分以上 |
| `ps -p <PID> -o cputime` | `00:00:00` 継続（通常は API レスポンス受信時に数秒の CPU 消費が出る） |
| `git status -s` | 空のまま（ファイルを 1 つも touch していない） |

対処: TaskStop で kill → 上記コマンド形式（ファイル + stdin + 直接 redirect）で再投入 → なお再現するなら `codex --version` / `codex exec --help` でバイナリ自体を確認。

OOM Killer に殺された場合の症状は、プロセスが消えているのに出力ログが `## 完了状況` も `tokens used` も無いまま途絶えていること（調査トレースだけで終わる）。codex（Node.js）は数百 MB〜1 GB+ を消費するので、起動前に `free -h` を見て他の重いプロセスと同時に走らせない。OOM 後は `codex exec resume --last` で再開できる。

## 注意事項

- `--skip-git-repo-check` は対象 dir が git 管理外でも動かすために常時付与（git リポジトリ内では無視される）。
- **完了後の引き継ぎ**: 責務は「実装完了 + 検証 pass」まで。続けて「コミットして」「PR 作成して」と指示されたら Claude が `commit` スキルや `gh pr create` で進める。codex に commit を禁じるのは、diff 確認・関連テスト追加・pre-commit hooks 通過を Claude 側で制御するため。
- ユーザー自身が codex を対話で使いたい場合は本スキルではなく `codex` を直接起動してもらう。
- **plan を grill / cross-review で詰めてから渡すとほぼ 1 イテレーションで完走する**。ループが回り始めたら plan 側の不備を疑う。
- **spec PASS は本番パスの安全性を保証しない**。rescue / retry / 状態遷移の境界バグ（4xx まで retry 対象、retry 由来の二重起動、stale task への parenting 等）は spec 通過後の diff cross-review で検出される。実装完了 → diff cross-review はスキップしない。

## 関連スキル

- **`codex-cross-review`**: 実装ではなく **レビュー** を codex に任せたいとき。典型併用フロー: cross-review で plan の致命点を潰す → 確定 plan を本スキルで実装 → 完了後の diff を再度 cross-review。
- **`codex-pr-review-loop`**: PR 提出後の GitHub Codex bot レビュー対応ループ。本スキル → commit / PR 作成 → こちらに引き継ぐ。
