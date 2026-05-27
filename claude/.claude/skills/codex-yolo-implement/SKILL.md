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

このスキルは codex に対して以下を許可する:

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

## 出力フォーマット

codex には自由形式の Markdown で返させるが、Claude が後段で拾いやすいよう **以下の見出しを含めてもらう** ことを必須指示に入れる。JSON スキーマ強制はしない（見出し順序や装飾が多少崩れても Claude が読んで意味で抽出する）。

- `## 実装結果` — このターンの作業内容（変更ファイル、加えた変更の概要）
- `## 完了状況` — 一行目に **`完了`** または **`未完了`** のいずれか一語を必ず書き、続けて根拠を一文
- `## 検証コマンド` — `完了` のとき、Claude が再現可能な bash コマンドを箇条書きで（テスト・lint・型チェックなど）
- `## 残タスク` — `未完了` のとき、残作業を箇条書きで

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

- **対象 plan**: 絶対パスをプロンプトに直接記述。codex は OS のファイルシステム経由で読むため、**未コミットの plan ファイルでも問題なく参照できる**（git history 経由ではない）
- **参考ファイル**: `(ref: /path/to/file)` で補足コンテキストを渡す

例: `"次の plan を実装してください: /tmp/plans/feature-x.md (ref: /home/valda/wc/myapp/CLAUDE.md) ..."`

## ループ制御

### 完了判定（二重チェック）

1. codex の応答から `## 完了状況` セクションを読み、一行目が `完了` であること
2. Claude が **対象 dir に cd した上で** `## 検証コマンド` の各コマンドを Bash で実走:
   ```bash
   cd <project_dir> && <検証コマンド>
   ```
   独立コマンド（テスト・lint・brakeman・diff check など互いに副作用がないもの）は **Bash の並列呼び出しで同時に走らせる**。順次実行は無駄に時間がかかるだけで価値がない。
3. 全 pass で本当に完了。1 つでも失敗したら検証失敗テンプレートで resume。

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

「`完了` を撤回し」の文言は **必須**。これがないと codex が「ほぼ完了」のまま小修正で押し切ろうとし、`完了` を返し続ける（実機で同等の挙動を `done` フラグで確認済み: 撤回を明示すると素直に切り替わる）。

### 上限と停滞検出

- `max_iterations = 10`（デフォルト）
- 各ターン後に `error_signature` を計算し、直前と比較:
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

2. **事前チェック**: 対象 dir で `git status -s` を実行し、未コミット変更を分類:
   - **今 codex に実装させる対象の plan / 関連 docs のみ**: そのまま進めて良い（codex は絶対パスで未コミットファイルも読める）。
   - **無関係な変更が紛れている**: ユーザーに続行可否を確認。stash / 別ブランチに退避してから進める。

3. **実装ブランチを切る**: `git checkout -b <feat|fix>/<scope>` で feature ブランチを先に作る。理由:
   - main を保護（codex 失敗 / 検証失敗で中断しても main は無傷）
   - 検証 pass 後にそのまま push + PR 作成へ自然に繋がる

   未コミット変更（plan doc 等）を残したまま `git checkout -b` すれば、変更はそのまま新ブランチに乗る。

4. **プロンプトファイル作成 → 初回実行**:
   - Write tool で `/tmp/codex-prompt-<scope>.txt` にプロンプト本文を書き出す（必須指示 3 つを含む）
   - Bash で `codex exec ... - < /tmp/codex-prompt-<scope>.txt > /tmp/codex-output-<scope>.log 2>&1` を **bg で起動**（`run_in_background: true`、`timeout: 900000`）
   - **絶対に `| tail -N` パイプを経由させない**（中間観察が不能になる）
   - **必ず stdin 経由（`- < /tmp/...`）でプロンプトを渡す**。引数で `"$(cat <<'PROMPT' ... PROMPT)"` は使わない（ハングする実例あり）

   `codex exec` は plan の規模次第で数分〜15 分以上かかる。

   進捗確認:
   - 中間進捗: `tail -100 /tmp/codex-output-<scope>.log`（直接 redirect しているので逐次書き込まれる）
   - worktree 変更: `git status -s | wc -l`
   - プロセス状態: `ps -p <PID> -o etime,cputime,stat`

   タスク完了通知（`status: completed`, exit code 0）を受け取ったら、`tail -150 /tmp/codex-output-<scope>.log` で末尾を読む（`## 実装結果` 以降の見出しは出力末尾近くに来る）。

### ハング検知と対処

bg 実行中、以下の指標が揃ったらハング:

| 指標 | ハング判定値 |
|---|---|
| `wc -c /tmp/codex-output-<scope>.log` | 0 バイトのまま起動から 3 分以上 |
| `ps -p <PID> -o cputime` | `00:00:00` が継続（通常は API レスポンス受信時に数秒の CPU 消費が出る） |
| `git status -s` | 空のまま（codex がファイルを 1 つも touch していない） |

対処:

1. **TaskStop** でプロセス kill
2. プロンプトファイル + 出力 redirect 方式で再投入（上記コマンド形式）
3. 再投入後もハングするなら `codex --version` / `codex exec --help` で codex バイナリ自体の動作確認

5. codex の出力（stdout or output file）を読み、見出しごとに抽出:
   - `## 完了状況` 一行目が `完了` & `## 検証コマンド` あり:
     - 各 cmd を `cd <project_dir> && <cmd>` で Bash 実行（独立コマンドは並列）
     - 全 pass → 完了報告（`git diff --stat` の概略も添える）
     - 失敗 → 検証失敗テンプレートで resume
   - `## 完了状況` 一行目が `未完了`:
     - 残タスクテンプレートで resume
   - 出力規約から外れている:
     - 規約再提示テンプレートで resume

6. 各 resume 前に `error_signature` を計算し、直前と比較。2 連続一致 → エスカレート。

7. `iteration > max_iterations` → 上限到達としてユーザーに報告。

## 注意事項

- **検証コマンドの cwd は対象 dir 固定**。Claude の Bash デフォルト cwd で走らせない。
- **進捗停滞時は盲目的に resume しない**。同じエラーが 2 ターン続いたらユーザーに判断を仰ぐ。
- `--skip-git-repo-check` は対象 dir が git 管理外でも動かすために常時付与。git リポジトリ内では無視されるだけ。
- 完了後、`cd <project_dir> && git diff --stat` の概略をユーザーに見せて検証を促す。コミットは必須指示 3 によりユーザーが手動で行う前提。
- **完了後の引き継ぎ**: スキルの責務は「実装完了 + 検証 pass まで」で完結する。続けてユーザーが「コミットして」「PR 作成して」と指示した場合、Claude は同セッションで `commit` スキル（pre-commit checklist 込み）や `gh pr create` で進める。codex に `git commit` を禁じる理由は、Claude 側で diff 確認 / 関連テスト追加実行 / pre-commit hooks 通過を制御するため。
- このスキルは Claude が「実装エージェント」として codex を駆動するためのもの。ユーザー自身が codex を対話で使いたい場合はこのスキルではなく `codex` を直接起動してもらう。

## 関連スキル

- **`codex-cross-review`**: 実装ではなく **レビュー** を codex に任せたいとき。コード・plan・spec のクロスレビューを `codex exec --sandbox read-only` で行う。本スキルはその「モード3（収束ループ）」を実装フェーズに転用した姉妹スキル。典型的な併用フロー: cross-review で plan の致命点を潰す → 確定 plan を本スキルで実装させる → 完了後の diff を再度 cross-review にかける。

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
