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

PR 提出後の Codex 自動レビュー対応を収束まで自動運転するスキル。`codex-cross-review` の収束ループ構造を GitHub 上の Codex bot レビューに転用したもの。前提として対象リポジトリに Codex の GitHub レビュー連携が入っていること。

## 全体フロー

```
PR 提出（または既存 PR 指定）
  └→ [ポーリング] 2 分毎に新規指摘 or 収束サインをチェック（bg ループ）
       ├─ 👍 reaction 検知 → 収束。対応サマリを報告して終了
       ├─ 新規指摘あり → トリアージ（採用判定）
       │    ├─ 採用 → 修正コミット + push + PR に対応コメント → ポーリング再開
       │    └─ 不採用 → 反証コメントを PR に投稿 → ポーリング再開
       └─ タイムアウト → 状況を報告してユーザーに判断を仰ぐ
```

## Codex bot の挙動（判定の前提）

- push または `@codex review` 毎に HEAD 対象の review（state=COMMENTED, body 冒頭に「Reviewed commit: `<sha>`」）が 1 つ発行される。
- 指摘の出力先は 2 通り（片方 / 両方）:
  - (a) **inline comment**（`pulls/comments`、`pull_request_review_id` で review に紐づく）
  - (b) **review body 直書き**（`pulls/reviews.body` 内に `![P<N> Badge]` マーカー付き）
- 指摘なし → inline ゼロ + body に P バッジなし + **PR 本文（issue reaction）に 👍**。HEAD 対象の review が発行されず 👍 だけ来るケースもある。
- 判定マーカーは `P[0-9] Badge` のみ。`💡 Codex Review` ヘッダは指摘なし review にも入る定型なので使わない。
- 判定要素は「PR 本文 👍」「HEAD sha 対象 review の inline comment」「review body の P バッジ」の 3 つで、スクリプトが全てチェックする（`pulls/comments` は `--paginate` 付き）。

## 手順

### 1. PR 特定と初期スナップショット

- PR 番号: 引数で指定されなければ `gh pr view --json number -q .number`
- `{owner}/{repo}`: `gh repo view --json nameWithOwner -q .nameWithOwner`
- 現在の HEAD: `gh pr view <PR> --json headRefOid -q .headRefOid`（**必ず変数取得、手打ち禁止**。タイプミスで別 sha を照合し、来ているレビューを取りこぼす。短縮は `${HEAD:0:10}`）

### 2. ポーリング（2 分毎、バックグラウンド）

ポーリングループ本体は [`scripts/codex-poll.sh`](scripts/codex-poll.sh)。Codex bot のレビューは push 後 1〜3 分、CI は 10〜15 分かかるので、review state と CI state を独立に追跡し、`CONVERGED` は **review converged AND CI passed** が揃ったときのみ出す（直列待ちや片方だけでの早期 exit は後追いの fail を見逃す）。

起動例:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) \
PR=$(gh pr view --json number -q .number) \
bash ~/.claude/skills/codex-pr-review-loop/scripts/codex-poll.sh
```

環境変数: `REPO` / `PR`（必須）、`BOT`（default `chatgpt-codex-connector[bot]`）、`MAX_CYCLES`（default 18 = 36 分）、`INTERVAL`（default 120 秒）、`NUDGE_AFTER`（default 3 周回 = 6 分。pending が続いたら自動で `@codex review` を投げて bot を起こす閾値）、`SEEN_RID`（反証済み review id。後述）。Claude からは `run_in_background: true` + timeout 2400000ms 程度で起動。`bash <path>` で明示起動する（`sh` 経由だと dash で `${HEAD:0:10}` が `Bad substitution`）。

**`SEEN_RID` で反証ループを防ぐ**: `NEW_FINDINGS: review=<RID> inline=[...]` を返した review に対して **反証コメントだけ投げて**（コミットや push なし）ポーリングを再起動する場合は、必ず前回の RID を `SEEN_RID=<RID>` で渡す。同 RID の findings は「再評価待ち」として pending 扱いになり、新 RID 発行 or 👍 reaction が来るまでループを継続できる。指定しないと、対応済み findings を毎サイクルで再検知してサイクル 1 で即 `NEW_FINDINGS` exit するループから抜けられない（HEAD が変わらないので RID も変わらない）。修正コミットを push した場合は HEAD sha が変わって RID も別になるため `SEEN_RID` 不要。

終端ステータス:

- `NEW_FINDINGS: ...` → 手順 3 へ。CI 完了は待たずに修正に入る（次 push で CI 再実行されるため現 HEAD の CI 結果は無価値）。
- `CONVERGED` → 手順 5 へ（review + CI 両 green 確認済み）。
- `CI_FAILED` → CI 失敗ジョブを特定して修正、修正後にループ再起動。
- `TIMEOUT` → 最後の砦。nudge 後も bot が反応しない場合に到達。review pending なら本文 reaction を再確認 → 無ければ手動で `@codex review` を投げてループ再起動。何も無ければユーザーに判断を仰ぐ。

**自動 nudge（push trigger 不発の検知と回復）**:

push 後の自動再レビューは **不確実**（bot 側の仕様）。push しても 1 度もレビューが走らないケースが時々発生する。これを TIMEOUT 経路（36 分待ち）まで放置すると、貴重な実行時間が浪費される。

対策として、ポーリング中に `review=pending` が **`NUDGE_AFTER` 周回（default 3 = 6 分）** 続いたら、スクリプトが**自動で 1 度だけ** `@codex review` をコメント投稿して bot を起こす。投げる前に PR 本文の reaction を確認し、`👍` / `👀` / `👎` のいずれかが既にあれば触らない（既存 👍 への投げは bot が再処理して 👀 で 👍 を上書きする罠を回避、過去メモ参照）。一度投げたら同じセッション中は再投げしない（`NUDGED=true` で記録）。

これにより `@codex review` の明示トリガは:

- **自動 nudge**（NUDGE_AFTER 経過時、ポーリングが投げる）
- **TIMEOUT 経路**（nudge 後も反応がない最終手段、人間が判断）

の 2 経路になる。スクリプトログでは `NUDGE: posting @codex review` 行が出るので、ユーザーは何が起きたか追跡できる。

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
- 必ず自分でコードを読んで妥当性を検証する。bot の指摘を鵜呑みにしない。「指摘の射程より問題が広い／同質の問題が他にもある」と分かったら対症療法でなく根本側を直す

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
5. PR に対応コメントを投稿: コミット hash、何をどう直したか、検証結果（spec 件数等）を明記

**不採用時**

- PR コメントに反証・理由を投稿（必要なら bot の該当コメントに 👎 reaction）

push 後は直ちに手順 2 のポーリングループを bg 起動。

### 5. 収束時の報告

採用 n 件（コミット一覧と要旨）/ 不採用 n 件（理由）/ エスカレート n 件 / CI 最終状態。

## 注意事項

- ループ上限: 10 サイクルで打ち切ってユーザーに報告（暴走防止）。同系統の指摘が自分の修正の穴を生んで連鎖する場合（層を変えて指摘が再生産される等）は上限前でも状況を共有し、設計見直し / 現状マージ＋残りを別 Issue 化 / 続行 を相談する。
- 複数指摘が同時に来ているときはまとめて対応してから push するとサイクル数が減る。
- 同じ箇所で「直す→別の穴」を 2 回繰り返したら設計を疑い、対症療法でなく構造を見直す。
- ローカル green / CI のみ fail のときは node バージョン・CPU 数（ubuntu-latest は 2 vCPU）に加え **lock 通りの依存解決を docker で再現**してから直す（ローカル node_modules だけ新しい版に上がって CI と乖離する罠）:

  ```bash
  docker run --rm --cpus=2 -v "$PWD":/app -e HOME=/work node:20 sh -c \
    "git config --global --add safe.directory '*' && git clone -q /src /work/repo && \
     cd /work/repo && yarn install --frozen-lockfile --cache-folder /work/.yc && yarn test"
  ```

- bot の誤検知コメントには 👎 reaction を付けてフィードバック: `gh api -X POST repos/{owner}/{repo}/pulls/comments/<id>/reactions -f content=-1`
- ユーザーから新しい指示・割り込みがあればループより優先する。

## Codex bot が見落としやすい / 見つけやすい指摘パターン

提出前 cross-review（`codex-cross-review`）のプロンプトに以下の観点を明示しておくと、PR 提出後のサイクル数を削減できる。

**bot が見つけやすい（提出前に潰す）**

- **環境横断の整合性**: 1 環境に追加した IAM / secret / config / module 呼び出しが他環境（staging/dev）でも前提成立するか。terraform モジュールのデフォルト値挙動を呼び出し側が認識しているか。
- **データ集計のセマンティクス**: 集計列の意味と軸の選択が外部正本（管理コンソール / 請求書 / 公式ダッシュ）と一致するか。NULL ケース・TZ 境界（UTC vs JST の月/日境界）も。
- **時刻依存データのキャッシュ scope**: 「今月の / 今日の / 過去 N 日」をキャッシュするとき、キーに reporting date/month など時間境界の scope を含めているか（固定キー + TTL だけだと境界またぎで古い context が出る）。
- **例外スコープの広すぎる rescue**: 複数 subsystem の例外を 1 つの rescue が吸収しエラー表示が誤った subsystem を指していないか。
- **リポジトリ衛生**: `git diff --stat` にランタイム成果物・dump・ログ・テンポラリが紛れていないか（`git add -A` で混入しやすい）。`.gitignore` 整備も同時に。

**bot が見つけにくい（grill / cross-review / advisor で補う）**

- スコープ膨張 / YAGNI 違反（bot は拡張提案側）
- ドキュメント・PR 説明文の正確性
- 「同じ問題が他にも N 箇所ある」横断パターン（bot は 1 箇所の point fix）
- 設計の代替案（bot は現状の前提を所与とする）

## 関連スキル

- **codex-yolo-implement**: 採用指摘の修正が大きいときの実装委譲先
- **codex-cross-review**: GitHub 連携が無いリポジトリ・コミット前のローカルレビューはこちら
- **commit**: pre-commit checklist 込みのコミット
