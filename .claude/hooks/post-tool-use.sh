#!/bin/bash
# Post-Tool-Use Hook
# ツール呼び出し完了後に実行されます

TOOL_NAME="$1"
TOOL_RESULT="$2"

# 統計情報の記録
STATS_FILE=".claude/stats/tool-usage.json"
mkdir -p ".claude/stats"

if [ ! -f "$STATS_FILE" ]; then
    echo '{}' > "$STATS_FILE"
fi

# ツール使用回数をカウント（簡易実装）
echo "✓ Tool completed: $TOOL_NAME"

# Bashコマンドが失敗した場合の通知
if [[ "$TOOL_NAME" == "Bash" ]] && [[ "$TOOL_RESULT" == *"error"* ]]; then
    echo "⚠️  Bashコマンドがエラーを返しました"
fi

exit 0
