# Discord モード

ユーザーが Discord 経由を明示したときだけ使う。権限・情報の扱い・往復上限・報告は SKILL.md の「共通ルール」に従う。CLI と違い会話がユーザーにも見えるが、報告は省略しない。

## 定数

| 項目 | 値 |
|---|---|
| Hermes bot user_id | `1491942796427530280` |
| `#hermes` channel | `1491973769726791812`（既定の投稿先） |
| メンション形式 | `<@1491942796427530280>`（`@Hermes Agent` のような文字列はメンションにならない） |

- 投稿先は特に指示がなければ `#hermes`。ユーザーがスレッドや別チャンネルを指定したらそれに従う。
- `#general`（人間同士の会話）、`#news`（配信専用）、`#clawd`（Claude Code 宛）には議論を持ち込まない。
- `#hermes` は `require_mention: true`。本文冒頭にメンションが無いと Hermes は inbound として拾わない。
- `#hermes` では Auto Thread が立たないので、Hermes の返信もチャンネル本体に流れる。

## ツール

Deferred なので最初にまとめて load する。

```
ToolSearch(query="select:mcp__plugin_discord_discord__reply,mcp__plugin_discord_discord__fetch_messages,mcp__plugin_discord_discord__react", max_results=3)
```

- `reply(chat_id, text, [reply_to], [files])` — 投稿。返る `message_id` を控える
- `fetch_messages(channel, limit)` — 直近メッセージを oldest-first で返す。bot に search API は無く、これが唯一の参照手段
- `react(chat_id, message_id, emoji)` — 同意は `✅`、要検討の指摘は `👀` など
- `edit_message` は Hermes の inbound にならない。間違えたら新規 `reply` で出し直す

## 投稿

- 2000 文字制限。長文は要点化するか分割する。
- 論点に短い識別子（F1, F2, ...）を付けると往復で引用しやすい。
- ファイルはフルパス（`~/hermes-ops/...`）で示す。Hermes も同じ host のファイルを読める。
- 相談中は SKILL.md と同じく「提案のみ」の制約を本文に入れる。「discord で指示して」で実行を頼む場合も、承認された対象・許可操作・禁止操作を明示する。
- 締めに確認したいことを明示的に質問する。

## ポーリング

Hermes の応答は通常 30 秒〜3 分。tool log（📚 skill_view / 🔎 search_files / 📖 read_file など絵文字で始まる行）が先に流れ、その後に本文が来ることが多い。

1. `reply` で投稿する。
2. `Bash(command="sleep 60", run_in_background=true)` で待つ。前景 sleep は harness にブロックされる。
3. 完了通知が来たら `fetch_messages(channel, limit=10)` で確認する。
   - tool log だけ → 調査中。間隔を伸ばして（90 → 120 → 180 秒）再確認する
   - `(1/2)` `(2/2)` のような分割返信 → 全部揃うまで待つ
   - 本文が揃った → 内容を検討し、同意・指摘・追加質問・反論を返す
4. 応答がまったく来なければ、再投稿でリマインドしない（チャンネル汚染になる）。`systemctl --user status hermes-gateway` を確認するか、ユーザーに状況を報告する。
