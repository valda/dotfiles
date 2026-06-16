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

Codex CLI（OpenAI）に plan を渡し、YOLO モード (`--dangerously-bypass-approvals-and-sandbox`) で実装を進めさせるスキル。Claude は外側でループを回し、codex の完了申告を **実走検証で二重チェック** する。

`/goal` 相当の Ralph loop は `codex exec` の CLI フラグに存在しない（`/goal` は TUI スラッシュコマンドのみ）。そのためループ制御は Claude 側が担う。これは `codex-cross-review` のモード3（収束ループ）と同じ構造を実装フェーズに転用したもの。

出力のやり取りは `codex-cross-review` と同様、**codex の標準出力をそのまま読む**。一時ファイルや JSON スキーマ強制は使わず、自由形式の自然文を Claude が解釈する。

## ⚠️ 警告: YOLO の影響範囲

このスキルは codex に以下を許可する:

- 対象 dir を含む **全ディスクへの書き込み**
- 任意の **ネットワーク実行**
- 全 **承認プロンプトのスキップ**

**信頼している作業ディレクトリでのみ使うこと**。起動前に `git status` を確認し、未コミット変更があれば内容を判断する（実装対象の plan / docs 自体なら無視して進めて良い、無関係な変更なら退避してから進める）。詳細は「実行手順」の事前チェックを参照。

## コマンド形式

プロンプトは Write tool で一時ファイルに書き出し、**stdin から読ませる**。出力は直接ログファイルへ redirect する（`| tail` 等のパイプを経由させない）。

### 初回

Write で `/tmp/codex-prompt-<scope>.txt` を作成してから:

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  -C <project_dir> \
  - < /tmp/codex-prompt-<scope>.txt > /tmp/codex-output-<scope>.log 2>&1
```

- `-` を PROMPT 引数にすると codex は stdin からプロンプトを読む（`codex exec --help` 仕様）
- ログファイルは bg 中も逐次書き込まれるので `tail -100 /tmp/codex-output-<scope>.log` で随時進捗確認できる

### 継続（resume）

Write で `/tmp/codex-resume-<scope>.txt` を作成してから:

```bash
codex exec resume --last \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  - < /tmp/codex-resume-<scope>.txt > /tmp/codex-output-<scope>-resume.log 2>&1
```

`-C, --cd` と `-s, --sandbox` は `resume` サブコマンドには存在しない（元セッションを引き継ぐ）。YOLO フラグは resume 側でも明示的に渡す必要がある。

### 引数渡しが禁止な理由

`codex exec ... "$(cat <<'PROMPT' ... PROMPT)"` の形式で長文プロンプトを引数に渡すと、bg 起動時に codex が CPU 0% のまま無限ハングすることがある。原因は heredoc 内の `\"` の二重エスケープと、stdin/tty 関連の初期化の組み合わせ。ファイル + stdin 経由ならどちらも回避できる。

### tail パイプが禁止な理由

`codex exec ... 2>&1 | tail -N` だと、`tail` が EOF まで全入力をバッファして最後に flush するため、codex 実行中は出力ファイルが 0 バイトのまま観察不能になる。中間状態が見えないと「正常進行中」と「ハング」の判別ができない。直接 redirect すれば逐次書き込まれる。

### sleep チェーンが禁止な理由

`sleep 60 && wc -c ...` / `sleep 90; tail ...` のような sleep 起点のポーリングは Claude Code ハーネスが `Blocked:` でブロックする。進捗待ちは **bg 起動 + タスク完了通知** が基本。途中観察したいときだけ sleep なしの単発 `wc -c` / `tail` を打つ。完了待ちに Monitor と ScheduleWakeup を併用しない（wakeup が重複発火して無駄ターンを消費する）。起動直後の tail はプロンプトエコー段階のことが多く、進捗確認として意味がない。

## 出力フォーマット

codex には自由形式の Markdown で返させるが、Claude が後段で拾いやすいよう **以下の見出しを含めてもらう** ことを必須指示に入れる。JSON スキーマ強制はしない（見出し順序や装飾が多少崩れても Claude が読んで意味で抽出する）。

- `## 実装結果` — このターンの作業内容（変更ファイル、加えた変更の概要）
- `## 完了状況` — 一行目に **`完了`** または **`未完了`** のいずれか一語を必ず書き、続けて根拠を一文
- `## 検証コマンド` — `完了` のとき、Claude が再現可能な bash コマンドを箇条書き（テスト・lint・型チェックなど）
- `## 残タスク` — `未完了` のとき、残作業を箇条書き

## プロンプトのルール

**必須指示**: codex に渡す **初回** プロンプトに以下をすべて含めること。

1. **出力規約**:
   > 最終メッセージは以下の見出しを含む Markdown で返してください:
   > - `## 実装結果` — 今ターンの作業概要
   > - `## 完了状況` — 一行目に `完了` または `未完了` のいずれか一語を必ず書き、続けて根拠を一文
   > - `## 検証コマンド` — `完了` の場合、Claude が再現可能な bash コマンドを箇条書き（テスト・lint・型チェックなど）
   > - `## 残タスク` — `未完了` の場合、残作業を箇条書き

2. **確認・質問不要**:
   > 確認や質問は不要です。不明点があっても妥当なデフォルトを採用し、`## 実装結果` にその根拠を一文で追記してください。

3. **git commit 禁止**:
   > `git commit` / `git push` は実行しないでください。変更は作業ツリーに残すだけで構いません（コミットはユーザーが検証後に手動で行います）。

### ファイル参照のパターン

`codex-cross-review` と同じ規則:

- **対象 plan**: 絶対パスをプロンプトに直接記述（codex は `-C` で cwd を変えるため相対パスは不可）。codex は OS のファイルシステム経由で読むため、**未コミットの plan ファイルでも問題なく参照できる**（git history 経由ではない）。
- **参考ファイル**: `(ref: /path/to/file) ← 一言で理由` で補足コンテキストを渡す。理由付き（「key 規約・orphan ガードを踏襲」等）の方が codex の参照精度が上がる。

例: `"次の plan を実装してください: /tmp/plans/feature-x.md (ref: /home/valda/wc/myapp/CLAUDE.md) ..."`

### 推奨プロンプト追加要素

YOLO 1 イテレーション完走に寄与する要素:

- **スコープ厳守の明示**: 「変更は上記 N ファイル + 対応する spec のみ。新規の設定キー・抽象化・ブランド分岐は追加しない」— scope 膨張を抑止
- **設計上の罠の焼き込み**: plan レビューで洗い出した「codex が踏みがちなバグ」を具体的なコード例付きで箇条書き（例: 「`-ss` は input 側 seek として渡す」「purge は成功パス末尾でのみ」）
- **テスト方針の明示**: 重い外部コマンド（ffmpeg 等）は「stub すること（実バイナリを走らせない）」と明記。これがないと不安定なテストを書く
- **雛形コミット参照**: 既存パターンの横展開なら「実装パターンの雛形はコミット `<sha>`。着手前に必ず `git show <sha>` を読んでください」— 一次ソース参照の方が正確に伝わる
- **完了条件のコマンド列挙**: `bin/rubocop -A` / `bin/erb_lint` / `bin/rspec <対象spec>` 等を「実装の最後に必ず通すこと」として箇条書き。codex が自前で検証を回すようになる
- **プロジェクト規約ファイル**: CLAUDE.md に加え、関連する `.claude/rules/*.md`（Svelte 規約等）も `(ref:)` で渡す。codex はリポジトリ規約（docs/log.md は新しい日付が先頭、等）を知らないため、規約依存の編集をさせるなら明示が必須

## ループ制御

### 完了判定（二重チェック）

0. **codex プロセスの終了を `ps` で確認してから作業ツリーに触る**。完了申告（`tokens used` 出力）後も codex プロセスが生き残ることがあり、Claude の手編集をファイルごと書き戻すリスクがある。残っていれば TaskStop で止める。これが済むまで Edit / 手動修正をしない。
1. codex の応答から `## 完了状況` セクションを読み、一行目が `完了` であること
2. Claude が **対象 dir に cd した上で** `## 検証コマンド` の各コマンドを Bash で実走:
   ```bash
   cd <project_dir> && <検証コマンド>
   ```
   lint・brakeman・diff check など互いに副作用がないものは **Bash の並列呼び出しで同時に走らせる**。ただし **同一テスト DB を共有する rspec を複数並列で起動しない**（DB 競合で偽陽性の失敗が出る）。rspec は 1 プロセスに直列でまとめる。
3. **コマンド実走だけでなく diff 自体も読む**。「codex 完了申告 + テスト pass」をすり抜けるパターン:
   - i18n locale のパリティ欠落（既存キー群に新規分だけ抜け）
   - `docs/log.md` の挿入位置規約違反
   - importer 呼び出し側での引数渡し漏れ
   
   locale ファイルを触らせた場合は `bin/rspec spec/i18n_spec.rb` を検証に追加する。リポジトリ規約面（ファイル末尾改行、ログの並び順等）は Claude が目視で拾う。
4. 全 pass で本当に完了。1 つでも失敗したら検証失敗テンプレートで resume。

出力が規約から外れて `## 完了状況` が読み取れない / `完了` も `未完了` も書かれていない場合は、規約を再提示して resume。

**注意**: 検証コマンドの cwd は対象プロジェクト dir 固定。Claude 自身の cwd（多くの場合 `/home/valda/.claude`）で走らせない。

### 継続プロンプト（テンプレート）

**`未完了` の場合**:

```
残タスク（あなたが先ほど返したもの）:
- <残タスク[0]>
- <残タスク[1]>
...

続けて plan を完了させてください。完了したと判断したら `## 完了状況: 完了` と `## 検証コマンド` を含めて返してください。
```

**検証失敗の場合**:

```
あなたは `## 完了状況: 完了` を返しましたが、検証コマンドが以下のとおり失敗しました:

$ <failing_cmd>
<output 末尾 500B>

`完了` を撤回し（`## 完了状況: 未完了` として）、原因を修正したうえで再度返してください。
```

「`完了` を撤回し」の文言は **必須**。これがないと codex が「ほぼ完了」のまま小修正で押し切ろうとし、`完了` を返し続ける。

resume プロンプト冒頭には **前回指摘・前回作業の 1 行要約** を入れる（例: 「前回指摘（rescue が 4xx まで retry 対象になっていた）に対応した修正を依頼します」）。codex の文脈復帰精度が目に見えて上がる。

### 上限と停滞検出

- `max_iterations = 10`（デフォルト）
- 各ターン後に `error_signature` を計算し直前と比較:
  - **検証失敗時**: `(failing_cmd, output 末尾 500B の SHA-256 前 12 桁)`
  - **未完了時**: `## 残タスク` セクションのテキスト全体（前後空白除去後）の SHA-256 前 12 桁
- 2 ターン連続で同じ signature → ループを抜けてユーザーにエスカレート:

  ```
  同じエラーが 2 ターン続きました。
  $ <failing_cmd> が以下のとおり落ちています:
  <output 末尾>

  介入が必要そうです。続行 / 中断 / 修正方針指示、どれにしますか？
  ```

`max_iterations` 到達時も同様にユーザーに上限到達を報告して中断。

## 実行手順

1. ユーザーから依頼を受け取る。最低限以下を特定:
   - plan ファイルの絶対パス（または plan 本文）
   - 対象プロジェクト dir（未指定なら現在の cwd）
   - 参考ファイル（任意）

2. **事前チェック**: 対象 dir で `git status -s` と `free -h` を実行（メモリ逼迫時は OOM リスク → 「OOM 検知と対処」参照）。未コミット変更を分類:
   - **今 codex に実装させる対象の plan / 関連 docs のみ**: そのまま進めて良い（codex は絶対パスで未コミットファイルも読める）
   - **無関係な変更が紛れている**: ユーザーに続行可否を確認。stash / 別ブランチに退避してから進める

3. **実装ブランチを切る**: `git checkout -b <feat|fix>/<scope>` で feature ブランチを先に作る:
   - main を保護（codex 失敗 / 検証失敗で中断しても main は無傷）
   - 検証 pass 後にそのまま push + PR 作成へ自然に繋がる
   
   未コミット変更（plan doc 等）を残したまま `git checkout -b` すれば、変更はそのまま新ブランチに乗る。

4. **プロンプトファイル作成 → 初回実行**:
   - Write tool で `/tmp/codex-prompt-<scope>.txt` にプロンプト本文を書き出す（必須指示 3 つを含む）
   - Bash で `codex exec ... - < /tmp/codex-prompt-<scope>.txt > /tmp/codex-output-<scope>.log 2>&1` を **bg で起動**（`run_in_background: true`、`timeout: 900000`）
   - **絶対に `| tail -N` パイプを経由させない**（中間観察が不能になる）
   - **必ず stdin 経由（`- < /tmp/...`）でプロンプトを渡す**。引数渡しはハングする
   
   `codex exec` は plan の規模次第で数分〜15 分以上かかる。進捗待ちの基本は **タスク完了通知**。`sleep N && tail` 等のポーリングは組まない。途中観察したいときは単発で:
   - 中間進捗: `tail -100 /tmp/codex-output-<scope>.log`
   - worktree 変更: `git status -s | wc -l`
   - プロセス状態: `ps -p <PID> -o etime,cputime,stat`
   
   タスク完了通知（`status: completed`, exit code 0）を受け取ったら `tail -150 /tmp/codex-output-<scope>.log` で末尾を読む（`## 実装結果` 以降の見出しは出力末尾近くに来る）。

### ハング検知と対処

bg 実行中、以下が揃ったらハング:

| 指標 | ハング判定値 |
|---|---|
| `wc -c /tmp/codex-output-<scope>.log` | 0 バイトのまま起動から 3 分以上 |
| `ps -p <PID> -o cputime` | `00:00:00` 継続（通常は API レスポンス受信時に数秒の CPU 消費が出る） |
| `git status -s` | 空のまま（codex がファイルを 1 つも touch していない） |

対処:

1. **TaskStop** でプロセス kill
2. プロンプトファイル + 出力 redirect 方式で再投入（上記コマンド形式）
3. 再投入後もハングするなら `codex --version` / `codex exec --help` で codex バイナリ自体の動作確認

### OOM 検知と対処

codex（Node.js）は数百 MB〜1 GB+ のメモリを消費する。OOM Killer に殺された場合の症状:

- プロセスが消えているのに、出力ログが **`## 完了状況` も `tokens used` も無いまま途絶えている**（調査トレースだけで終わる）

対処と予防:

- 起動前に `free -h` でメモリ残量を確認。重いプロセス（別の codex、メモリ食いの常駐サービス）と同時に走らせない
- OOM 後は `codex exec resume --last` でセッションを引き継いで再開できる

5. **codex プロセスの終了を `ps` で確認**（残っていれば TaskStop。完了申告後の生き残りプロセスが手編集を上書きするリスク）。その後 codex の出力を読み、見出しごとに抽出:
   - `## 完了状況` 一行目が `完了` & `## 検証コマンド` あり:
     - 各 cmd を `cd <project_dir> && <cmd>` で Bash 実行（独立コマンドは並列、rspec 同士は直列）
     - 全 pass → 完了報告（`git diff --stat` の概略も添える）
     - 失敗 → 検証失敗テンプレートで resume
   - `## 完了状況` 一行目が `未完了`:
     - 残タスクテンプレートで resume
   - 出力規約から外れている:
     - 規約再提示テンプレートで resume

6. 各 resume 前に `error_signature` を計算し直前と比較。2 連続一致 → エスカレート。

7. `iteration > max_iterations` → 上限到達としてユーザーに報告。

## 注意事項

- **検証コマンドの cwd は対象 dir 固定**。Claude の Bash デフォルト cwd で走らせない。
- **進捗停滞時は盲目的に resume しない**。同じエラーが 2 ターン続いたらユーザーに判断を仰ぐ。
- `--skip-git-repo-check` は対象 dir が git 管理外でも動かすために常時付与。git リポジトリ内では無視されるだけ。
- 完了後、`cd <project_dir> && git diff --stat` の概略をユーザーに見せて検証を促す。コミットは必須指示 3 によりユーザーが手動で行う前提。
- **完了後の引き継ぎ**: スキルの責務は「実装完了 + 検証 pass まで」で完結する。続けてユーザーが「コミットして」「PR 作成して」と指示した場合、Claude は同セッションで `commit` スキル（pre-commit checklist 込み）や `gh pr create` で進める。codex に `git commit` を禁じる理由は、Claude 側で diff 確認 / 関連テスト追加実行 / pre-commit hooks 通過を制御するため。
- このスキルは Claude が「実装エージェント」として codex を駆動するためのもの。ユーザー自身が codex を対話で使いたい場合は本スキルではなく `codex` を直接起動してもらう。

## 運用上の知見

- **plan を grill / cross-review で十分詰めてから渡すと、YOLO 実装はほぼ 1 イテレーションで完走する**。ループが回り始めたら plan 側の不備を疑う。
- **spec PASS は本番パスの安全性を保証しない**。rescue / retry / 状態遷移の境界バグ（4xx まで retry 対象、retry 由来の二重起動、stale task への parenting 等）は spec を通過した後の diff cross-review で検出される。実装完了 → diff cross-review はスキップしない。

## 関連スキル

- **`codex-cross-review`**: 実装ではなく **レビュー** を codex に任せたいとき。本スキルはその「モード3（収束ループ）」を実装フェーズに転用した姉妹スキル。典型併用フロー: cross-review で plan の致命点を潰す → 確定 plan を本スキルで実装させる → 完了後の diff を再度 cross-review。
- **`codex-pr-review-loop`**: PR 提出後の GitHub Codex bot レビュー対応ループ。本スキル → commit / PR 作成 → こちらに引き継ぐ流れが定着。

## 使用例

### plan ファイルからの実装

Write tool で `/tmp/codex-prompt-feature-x.txt` に以下を書き出す:

```
次の plan を実装してください: /tmp/plans/feature-x.md (ref: /home/valda/wc/myapp/CLAUDE.md)

最終メッセージは以下の見出しを含む Markdown で返してください:
- ## 実装結果 — 今ターンの作業概要
- ## 完了状況 — 一行目に '完了' または '未完了' のどちらかを必ず書き、続けて根拠を一文
- ## 検証コマンド — '完了' の場合、Claude が再現可能な bash コマンドを箇条書き（テスト・lint・型チェックなど）
- ## 残タスク — '未完了' の場合、残作業を箇条書き

確認や質問は不要です。不明点があっても妥当なデフォルトを採用し、## 実装結果 にその根拠を一文で追記してください。

git commit / git push は実行しないでください。変更は作業ツリーに残すだけで構いません。
```

その後 Bash で（bg + 直接 redirect、tail パイプ禁止）:

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  -C /home/valda/wc/myapp \
  - < /tmp/codex-prompt-feature-x.txt > /tmp/codex-output-feature-x.log 2>&1
```

### 検証失敗後の resume

Write tool で `/tmp/codex-resume-feature-x.txt` に以下を書き出す:

```
あなたは '## 完了状況: 完了' を返しましたが、検証コマンドが以下のとおり失敗しました:

$ bundle exec rspec spec/foo_spec.rb
F.....
Failures:
  1) FooSpec foo
     expected: 2
          got: 1

'完了' を撤回し（'## 完了状況: 未完了' として）、原因を修正したうえで再度返してください。
```

Bash で:

```bash
codex exec resume --last \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  - < /tmp/codex-resume-feature-x.txt > /tmp/codex-output-feature-x-resume.log 2>&1
```
