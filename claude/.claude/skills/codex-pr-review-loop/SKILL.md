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

PR 提出後の Codex 自動レビュー対応を収束まで自動運転するスキル。`codex-cross-review` の収束ループ構造を GitHub 上の Codex bot レビューに転用したもの。

**前提**: 対象リポジトリに Codex の GitHub レビュー連携が設定されていること（PR open / draft 解除 / `@codex review` コメントでレビューが走り、指摘があれば inline comment、無ければ 👍 reaction が付く）。

## 全体フロー

```
PR 提出（または既存 PR 指定）
  └→ [ポーリング] 2 分毎に新規指摘 or 収束サインをチェック（bg ループ）
       ├─ 👍 reaction 検知 → 収束。対応サマリを報告して終了
       ├─ 新規指摘あり → トリアージ（採用判定）
       │    ├─ 採用 → 修正コミット + push + PR に対応コメント → CI 確認 → ポーリング再開
       │    └─ 不採用 → 反証コメントを PR に投稿 → ポーリング再開
       └─ タイムアウト → 状況を報告してユーザーに判断を仰ぐ
```

## Codex bot の挙動（判定の前提）

- 新しいコミットを push するか `@codex review` する毎に、HEAD コミットを対象とする review（state=COMMENTED）が 1 つ発行される。review body には「Reviewed commit: `<sha>`」が入る。
- 指摘の出力先は 2 通り（Codex は片方 / 両方で出す）:
  - (a) **inline comment**（`pulls/comments`、`pull_request_review_id` で review に紐づく）
  - (b) **review body 本文**（`pulls/reviews` の `body` フィールド内に `![P<N> Badge]` マーカー付きで直書き）
  
  inline ゼロでも body に指摘があるケースがある。
- 指摘なしのとき:
  - inline comment ゼロ + review body に P バッジなし
  - PR 本文に 👍 reaction が付く
  - HEAD sha を対象とする review が発行されないこともある（👍 だけ来るパターン）
- **判定マーカーは `P[0-9] Badge` のみで十分**。`💡 Codex Review` ヘッダは指摘なしの review にも入る定型のため、これで判定すると誤検知する。

判定は **「PR 本文の bot 👍 reaction」**、**「HEAD sha の bot review に inline comment」**、**「review body の P バッジマーカー」** の 3 つを併走で見る。

## 注意点

- `gh api pulls/<PR>/comments` はデフォルト 30 件/ページ。**必ず `--paginate` を付ける**（付けないと新しい指摘を取りこぼして TIMEOUT/収束と誤判定する）。
- 👍 は **PR 本文の issue reaction**（`issues/<PR>/reactions`）に付く。review レベルや各 comment ではない。

## 手順

### 1. PR 特定と初期スナップショット

- PR 番号: 引数で指定されなければ `gh pr view --json number -q .number`
- `{owner}/{repo}`: `gh repo view --json nameWithOwner -q .nameWithOwner`
- 現在の HEAD: `gh pr view <PR> --json headRefOid -q .headRefOid`（**必ず変数取得、手打ち禁止**。タイプミスで別 sha を照合し、来ているレビューを取りこぼす。短縮は `${HEAD:0:10}`）

### 2. ポーリング（2 分毎、バックグラウンド）

foreground の `sleep` はブロックされるため、判定込みのポーリングループを 1 本の bg Bash として起動し（`run_in_background: true`、timeout 2400000 程度）、完了通知で Claude が再開する。HEAD sha はスクリプト内で取得し手打ちしない:

```bash
REPO="<owner/repo>"
PR=<PR番号>
BOT="chatgpt-codex-connector[bot]"
HEAD=$(gh pr view "$PR" --json headRefOid -q .headRefOid); H10=${HEAD:0:10}
for i in $(seq 1 18); do  # 2分 × 18 = 最大36分
  # (A) 収束チェック: PR 本文に bot の 👍
  if gh api "repos/$REPO/issues/$PR/reactions" \
       --jq ".[] | select(.user.login==\"$BOT\" and .content==\"+1\")" 2>/dev/null | grep -q .; then
    echo "CONVERGED: PR本文に👍"; exit 0
  fi
  # (B) 新規指摘チェック: HEAD コミットを対象とする bot review の inline / body 両方を検査
  RID=$(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
    --jq "[.[] | select(.user.login==\"$BOT\" and (.body | contains(\"$H10\")))] | last | .id // empty")
  if [ -n "$RID" ]; then
    NEW=$(gh api "repos/$REPO/pulls/$PR/comments" --paginate \
      --jq "[.[] | select(.pull_request_review_id==$RID)] | .[].id")
    BODY_HAS_FINDING=$(gh api "repos/$REPO/pulls/$PR/reviews/$RID" \
      --jq '.body | test("P[0-9] Badge")' 2>/dev/null)
    if [ -n "$NEW" ] || [ "$BODY_HAS_FINDING" = "true" ]; then
      echo "NEW_FINDINGS: review=$RID inline=[$NEW] body_has_finding=$BODY_HAS_FINDING"
      exit 0
    fi
    echo "CONVERGED: HEAD $H10 のレビューに指摘なし（review $RID）"; exit 0
  fi
  sleep 120
done
echo "TIMEOUT"; exit 0
```

- `NEW_FINDINGS: ...` → 手順 3 へ
- `CONVERGED` → 手順 5 へ
- `TIMEOUT` → HEAD review も本文 👍 も無い。`@codex review` で明示依頼してポーリング再起動。**本当に何も無いときだけ**ユーザーに判断を仰ぐ（review 不発で 👍 だけ来ているケースがあるため、必ず本文 reaction を再確認する）。

**重要**:

- 1 サイクルで指摘を直して push する毎に HEAD sha が変わる。ポーリングは毎回スクリプト先頭で HEAD を取り直す。前 sha のレビューを収束と誤認しない。
- push トリガーの自動レビューは不確実。だが **`@codex review` を投げる前に必ず本文 reaction を確認する**。既に 👍 が付いている収束済み PR に `@codex review` を投げると bot が再処理に入り 👀(eyes) を付けて既存の 👍 を上書きし、収束済みを再処理に戻して 1 サイクル無駄になる。手順:
  - (1) push → CI green 確認 → 本文 reaction を見る。既に `+1` なら CONVERGED として終了
  - (2) `+1` も HEAD review も無いときだけ `@codex review` を投げてポーリング再起動

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
3. **可能な限り回帰テストを足す**（指摘されたシナリオを再現するテスト）
4. Conventional Commits（日本語）でコミットして push
5. PR に対応コメントを投稿: コミット hash、何をどう直したか、検証結果（spec 件数等）を明記

**不採用時**

- PR コメントに反証・理由を投稿（必要なら bot の該当コメントに 👎 reaction）

**push 後**: `gh pr checks <PR> --watch` も bg 方式で確認。CI fail なら原因を特定して修正してから次サイクルへ。CI green 確認後、**まず PR 本文の `+1` reaction を確認**（push トリガーの自動レビューが既に収束していることがある）。既に 👍 なら終了、無ければ `@codex review` を投げて手順 2 のポーリングを再起動する。

### 5. 収束時の報告

- 採用 n 件（コミット一覧と要旨）/ 不採用 n 件（理由）/ エスカレート n 件
- CI 最終状態

## 注意事項

- **ループ上限**: 10 サイクルで打ち切ってユーザーに報告（暴走防止）。「同じ系統の指摘が自分の修正の穴を生んで連鎖する」場合は上限前でもユーザーに状況を共有し、設計の一段見直し / 現状マージ＋残りを別 Issue 化 / 続行 のいずれかを相談する（非同期ジョブ完了が POST 応答より先に来る「高速完了レース」のように、pending→files→flag と層を変えて連鎖するケースがある）。
- **CI 失敗が CI 環境起因に見える場合**（ローカル green / CI のみ fail）は、node バージョン・CPU 数（ubuntu-latest は 2 vCPU）に加え **lock 通りの依存解決** を docker で再現してから直す。`yarn install --frozen-lockfile --force` で lock 版に揃える（ローカル node_modules だけ新しい版に上がって CI と乖離する罠がある）:

  ```bash
  docker run --rm --cpus=2 -v "$PWD":/app -e HOME=/work node:20 sh -c \
    "git config --global --add safe.directory '*' && git clone -q /src /work/repo && \
     cd /work/repo && yarn install --frozen-lockfile --cache-folder /work/.yc && yarn test"
  ```

  タイミング依存に見えても確定的バグのことがあるので、まず lock 版で再現を取る。
- bot の指摘コメントには「Useful? React with 👍 / 👎」が付く。誤検知には 👎 でフィードバック:

  ```bash
  gh api -X POST repos/{owner}/{repo}/pulls/comments/<id>/reactions -f content=-1
  ```

- 1 つの指摘対応で push すると再レビューが走り新しい指摘が来ることがある。複数指摘が同時に来ているときはまとめて対応してから push するとサイクルが少なく済む。
- 自分の修正でバグを入れた指摘は素直に直す。同じ箇所で「直す→別の穴」を 2 回繰り返したら設計を疑い、対症療法でなく構造を見直す。
- ユーザーから新しい指示・割り込みがあればループより優先する。

## Codex bot が見落としやすい / 見つけやすい指摘パターン

提出前 cross-review（`codex-cross-review`）のプロンプトに以下の観点を明示しておくと、PR 提出後のサイクル数を削減できる。

### A. 環境横断の整合性（複数 env を持つプロジェクト）

新しい IAM / secret / config / モジュール呼び出しを 1 環境（例: production）に追加したとき、**他環境（staging/dev）でも同じ前提が成立するか**を bot は厳しくチェックする。落とし穴:

- 同じ SA name を別環境で使い回したが、別環境では terraform モジュールが SA 未指定（= default Compute SA）で起動 → IAM が wrong principal で 403
- credentials / `config/x/{env}.yml` を片方の env にだけ追加し、もう一方で起動時 raise
- terraform モジュールのデフォルト値（`default = ""` で empty なら default SA 等）の挙動を呼び出し側が認識していない

→ プロンプトに「**対応する staging/dev の terraform/設定も読み、member や前提が現実と一致しているか確認して**」を入れる。

### B. データ集計のセマンティクス

SQL / BigQuery / 集計クエリで、**列の意味と集計軸の選択**は bot が実データ感覚で指摘する。

- ユーザーの心象に近い軸とテクニカルに楽な軸がずれる（billing export で `_PARTITIONDATE`（export 日）と `invoice.month`（請求月）は別物、後者が Google Cloud Console と一致）
- `cost` のような主指標に副次的な調整列（credits、discounts、refunds）が併存し、両方足さないと外部の正本と一致しない
- 集計関数（SUM/AVG/COUNT）が NULL を返すケース（対象行ゼロ）の取り扱い忘れ → ダウンストリームで例外
- タイムゾーン: ストレージ層は UTC、ユーザー視点は JST、月境界・日境界がずれる

→ プロンプトに「**集計列の意味と軸の選択が外部正本（管理コンソール / 請求書 / 公式ダッシュ）と一致するか確認して**」を入れる。

### C. キャッシュの reporting scope

時刻に依存するデータ（「今月の」「今日の」「過去 30 日の」）をキャッシュするとき、**固定キー + TTL だけでは境界をまたいだリクエストが古い reporting context で表示される**。月境界（5/31 23:30 にキャッシュ → 6/1 00:30 表示が依然「5月の当月コスト」）/ 日境界 / 四半期境界 / TZ 不一致。

→ プロンプトに「**キャッシュキーに reporting date / month など時間境界の scope を含めているか確認して**」を入れる。

### D. 例外スコープが広すぎる

外側の `rescue` が複数 subsystem の例外を一括で吸収していて、デバッグメッセージが misleading になるケース。

- 認証 / メタデータ取得の例外と、データ取得 API の例外が同じ rescue → 後者が起きたとき「認証失敗」と誤表示
- Net::ReadTimeout 等の汎用 Net 例外を「特定の subsystem 専用」と思い込んで広く rescue

→ プロンプトに「**rescue が複数 subsystem の例外を吸収していないか、エラー表示が正しい subsystem を指し示すか確認して**」を入れる。

### E. リポジトリ衛生

bot は **誤コミットされたランタイム成果物**（`dump.rdb` / `*.log` / `.DS_Store` / IDE 設定 / セッションダンプ）を高確率で検知する。`git add -A` 利用時に発生しやすい。

→ プロンプトに「**`git diff --stat` の中にランタイム由来の成果物・dump・ログ・テンポラリが紛れていないか確認して**」を入れる。`.gitignore` 整備も同時に。

### F. bot が見つけにくい点（cross-review / advisor が補う領域）

- スコープ判断（スコープ膨張 / YAGNI 違反）→ bot は scope 守る側でなく拡張提案側
- ドキュメント・PR 説明文の正確性
- 「同じ問題が他にも N 箇所ある」横断パターン（指摘は 1 箇所への point fix）
- 設計の代替案（bot は現状の前提を所与として直す）

これらは grill / cross-review / advisor 側で詰める。

## 関連スキル

- **codex-yolo-implement**: 採用指摘の修正が大きいときの実装委譲先
- **codex-cross-review**: GitHub 連携が無いリポジトリ・コミット前のローカルレビューはこちら
- **commit**: pre-commit checklist 込みのコミット
