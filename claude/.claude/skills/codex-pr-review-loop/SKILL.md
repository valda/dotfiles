---
name: codex-pr-review-loop
description: |
  PR 提出後、GitHub の Codex 自動レビュー（chatgpt-codex-connector[bot]）を
  2 分毎にポーリングで待ち、指摘の採用判定 → 修正 or 反証コメント → 再レビュー待ち、
  を収束（bot が PR 本文に 👍 reaction を付ける）まで繰り返すワークフロー。
  トリガー: "PRレビューループ", "codexレビューを待って対応", "PR review loop",
           "レビュー収束まで回して", "babysit PR", "PRの面倒を見て"
---

# codex-pr-review-loop

PR 提出後の Codex 自動レビュー対応を収束まで自動運転するスキル。対象リポジトリに Codex の GitHub レビュー連携が入っていることが前提。

## 全体フロー

```
PR 提出（または既存 PR 指定）
  └→ [ポーリング] 2 分毎に新規指摘 or 収束サインをチェック（bg ループ）
       ├─ 👍 reaction 検知 → 収束。対応サマリを報告して終了
       ├─ 新規指摘あり → トリアージ（採用判定）
       │    ├─ 採用 → 修正コミット + push → ポーリング再開（対応コメントは投稿しない）
       │    └─ 不採用 → 反証コメントを PR に投稿 → ポーリング再開
       └─ タイムアウト → 状況を報告してユーザーに判断を仰ぐ
```

ループは 2 種類あり、上限の数値もそれぞれ別物。

- **ポーリング周回**: `codex-poll.sh` 内の 2 分毎チェック。上限 `MAX_CYCLES`（default 18 = 36 分）。
- **対応サイクル**: 指摘検知 → 修正/反証 → ポーリング再起動 の外側ループ。上限 10 サイクル（後述「注意事項」）。

## Codex bot の挙動（判定の前提）

- push または `@codex review` 毎に HEAD 対象の review（state=COMMENTED, body 冒頭に「Reviewed commit: `<sha>`」）が 1 つ発行される。
- 指摘の出力先は 2 通り（片方 / 両方）:
  - (a) **inline comment**（`pulls/comments`、`pull_request_review_id` で review に紐づく）
  - (b) **review body 直書き**（`pulls/reviews.body` 内に `![P<N> Badge]` マーカー付き）
- 指摘なし → inline ゼロ + body に P バッジなし + **PR 本文（issue reaction）に 👍**。HEAD 対象の review が発行されず 👍 だけ来るケースもある。
- 判定マーカーは `P[0-9] Badge` のみ。`💡 Codex Review` ヘッダは指摘なし review にも入る定型なので使わない。
- 判定要素は「PR 本文 👍」「HEAD sha 対象 review の inline comment」「review body の P バッジ」の 3 つで、スクリプトが全てチェックする。

## 手順

### 1. PR 特定と初期スナップショット

- PR 番号: 引数で指定されなければ `gh pr view --json number -q .number`
- `{owner}/{repo}`: `gh repo view --json nameWithOwner -q .nameWithOwner`
- 現在の HEAD: `gh pr view <PR> --json headRefOid -q .headRefOid`（手打ちせず変数取得。タイプミスで別 sha を照合すると来ているレビューを取りこぼす。短縮は `${HEAD:0:10}`）

### 2. ポーリング（2 分毎、バックグラウンド）

ポーリングループ本体は [`scripts/codex-poll.sh`](scripts/codex-poll.sh)。Codex bot のレビューは push 後 1〜3 分、CI は 10〜15 分かかるので、review state と CI state を独立に追跡し、`CONVERGED` は **review converged AND CI passed** が揃ったときのみ出す（直列待ちや片方だけでの早期 exit は後追いの fail を見逃す）。

起動例:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) \
PR=$(gh pr view --json number -q .number) \
bash ~/.claude/skills/codex-pr-review-loop/scripts/codex-poll.sh
```

環境変数: `REPO` / `PR`（必須）、`BOT`（default `chatgpt-codex-connector[bot]`）、`MAX_CYCLES`（default 18）、`INTERVAL`（default 120 秒）、`NUDGE_AFTER`（default 3 周回）、`SEEN_RID`（反証済み review id）。スクリプトは全 `gh` 呼び出しに `--repo "$REPO"` を渡すのでリポジトリ dir 外からも起動できる（上の例で `REPO` / `PR` を導出する 2 行だけは repo dir 内で実行するか、値を直接書く）。Claude からは `run_in_background: true` + timeout 2400000ms 程度で起動。`bash <path>` で明示起動する（`sh` 経由だと dash で `${HEAD:0:10}` が `Bad substitution`）。

**`SEEN_RID` で反証ループを防ぐ**: `NEW_FINDINGS: review=<RID> ...` を返した review に対して、コミット無しで反証コメントだけ投げて再起動する場合は `SEEN_RID=<RID>` を渡す。同 RID の findings は「再評価待ち」として pending 扱いになる。指定しないと HEAD が変わらず RID も変わらないため、対応済み findings を毎サイクル再検知してサイクル 1 で即 exit するループから抜けられない。修正 push した場合は RID が変わるので不要。

**自動 nudge**: push 後の自動再レビューは bot 側の仕様で不確実で、push しても 1 度もレビューが走らないことがある。`review=pending` が `NUDGE_AFTER` 周回続いたら、スクリプトが自動で 1 度だけ `@codex review` を投稿する（ログに `NUDGE: posting @codex review`）。投稿前に PR 本文の reaction を確認し、`👍` / `👀` / `👎` のいずれかが既にあれば触らない（既存 👍 に投げると bot が再処理して 👀 で 👍 を上書きする）。明示トリガはこの自動 nudge と、後述 TIMEOUT 経路での手動投稿の 2 つ。

終端ステータス:

- `NEW_FINDINGS: ...` → 手順 3 へ。CI 完了は待たずに修正に入る（次 push で CI 再実行されるため現 HEAD の CI 結果は無価値）。
- `CONVERGED` → 手順 5 へ（review + CI 両 green 確認済み）。
- `CI_FAILED` → CI 失敗ジョブを特定して修正、修正後にループ再起動。
- `TIMEOUT` → nudge 後も bot が反応しなかったケース。review pending なら本文 reaction を再確認 → 無ければ手動で `@codex review` を投げてループ再起動。何も無ければユーザーに判断を仰ぐ。
- exit 3（ステータス行なし）→ 起動時に HEAD sha を取れていない。`REPO` / `PR` の値と `gh auth status` を確認する。

### 3. トリアージ（採用判定）

新規指摘の本文を取得し、1 件ずつ判定:

```bash
# (a) inline comment
gh api repos/{owner}/{repo}/pulls/comments/<id> --jq '{path, body}'

# (b) review body 直書き指摘
gh api repos/{owner}/{repo}/pulls/<PR>/reviews/<RID> --jq .body
```

review body 直書きは `path:line` が無いので、本文内の説明から対象ファイルを特定する。codex はバッジ後の **太字行**（`**Remove the committed Redis dump**` 等）を見出しに使うのでそこを起点に読む。

**採用**（修正コミットで対応）

- 正しさ・セキュリティ・データ損失・レース条件・仕様矛盾など実害のある指摘
- 再現シナリオが具体的でコードを読んで事実確認できたもの
- 自分でコードを読んで妥当性を検証する。「指摘の射程より問題が広い／同質の問題が他にもある」と分かったら対症療法でなく根本側を直す

**不採用**（反証コメントで対応）

- 誤検知: 根拠（file:line と実際の挙動）を添えて PR コメントで反証
- スコープ外: その旨をコメントし、必要なら別 Issue を起票してリンク
- スタイル・過剰最適化で観測根拠が無いもの

**エスカレート**（ユーザーに判断を仰ぐ）

- スコープを覆す提案、新規ファイル・抽象化・設定キーの追加を要する対応
- 採用判定に確信が持てないもの
- 同一指摘が 2 サイクル続く（堂々巡り）

### 4. 対応

**採用時**

1. 修正を実装（薄い修正は直接、大きい修正は `codex-yolo-implement` に委譲してよい）
2. pre-commit checklist（関連範囲の lint / spec。CLAUDE.md 参照）を通す
3. 可能な限り回帰テストを足す（指摘されたシナリオを再現するテスト）
4. Conventional Commits（日本語）でコミットして push

`@codex 指摘反映しました` 型の ack コメントは、push 自体が再レビュートリガなので通知として冗長なうえ、bot が返信を書くトークンを浪費する。修正意図はコミットメッセージに書けば伝わるので投稿しない。

**不採用時**

PR コメントに反証・理由を投稿（必要なら bot の該当コメントに 👎 reaction）。push しないケースでは Codex に意思表示する唯一の経路になる。

```bash
gh api -X POST repos/{owner}/{repo}/pulls/comments/<id>/reactions -f content=-1
```

push またはコメント投稿後は直ちに手順 2 のポーリングループを bg 起動する（反証のみで push していないときは `SEEN_RID=<RID>` を渡す）。

### 5. 収束時の報告

採用 n 件（コミット一覧と要旨）/ 不採用 n 件（理由）/ エスカレート n 件 / CI 最終状態。

## 注意事項

- 対応サイクルの上限は 10。到達したらユーザーに報告して打ち切る。同系統の指摘が自分の修正の穴を生んで連鎖する場合（層を変えて指摘が再生産される等）は上限前でも状況を共有し、設計見直し / 現状マージ＋残りを別 Issue 化 / 続行 を相談する。
- 同じ箇所で「直す→別の穴」を 2 回繰り返したら対症療法でなく構造を疑う。
- 複数指摘が同時に来ているときはまとめて対応してから push するとサイクル数が減る。
- ローカル green / CI のみ fail のときは node バージョン・CPU 数（ubuntu-latest は 2 vCPU）に加え、**lock 通りの依存解決を docker で再現**してから直す（ローカル node_modules だけ新しい版に上がって CI と乖離する罠）。yarn プロジェクトの例:

  ```bash
  docker run --rm --cpus=2 -v "$PWD":/src -e HOME=/work node:20 sh -c \
    "git config --global --add safe.directory '*' && git clone -q /src /work/repo && \
     cd /work/repo && yarn install --frozen-lockfile --cache-folder /work/.yc && yarn test"
  ```

## Codex bot の得手不得手

提出前 cross-review（`codex-cross-review`）のプロンプトに「bot が見つけにくい」観点を明示しておくと、提出後のサイクル数が減る。

**bot が見つけやすい（提出前に潰す）**

- 環境横断の整合性: 1 環境に足した IAM / secret / config / module 呼び出しが他環境でも前提成立するか
- 集計セマンティクス: 集計軸と列の意味が外部正本と一致するか。NULL ケース・TZ 境界（UTC vs JST の月/日境界）
- 時刻依存データのキャッシュ scope: 「今月の / 過去 N 日」をキャッシュするとき、キーに時間境界を含めているか（固定キー + TTL だけだと境界またぎで古い値が出る）
- 広すぎる rescue: 複数 subsystem の例外を 1 つの rescue が吸収し、エラー表示が誤った subsystem を指していないか
- リポジトリ衛生: `git diff --stat` にランタイム成果物・dump・ログが紛れていないか（`git add -A` で混入しやすい）

**bot が見つけにくい（grill / cross-review / advisor で補う）**

- スコープ膨張 / YAGNI 違反（bot は拡張提案側）
- ドキュメント・PR 説明文の正確性
- 「同じ問題が他にも N 箇所ある」横断パターン（bot は 1 箇所の point fix）
- 設計の代替案（bot は現状の前提を所与とする）

## 関連スキル

- **codex-yolo-implement**: 採用指摘の修正が大きいときの実装委譲先
- **codex-cross-review**: GitHub 連携が無いリポジトリ・コミット前のローカルレビューはこちら
- **commit**: pre-commit checklist 込みのコミット
