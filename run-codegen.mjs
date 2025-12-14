#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';

const npxCachePath = join(homedir(), '.npm/_npx/1fc34a57fdb9f58a/node_modules');
const { CodeGenAgent } = await import(join(npxCachePath, 'miyabi-agent-sdk/dist/agents/CodeGenAgent.js'));

const agent = new CodeGenAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  useClaudeCode: false, // Use AnthropicClient instead
});

const input = {
  taskId: 'issue-1',
  requirements: `Telegram WebAppで動作するオンライン対戦○×ゲーム（Tic-Tac-Toe）を実装する。

機能要件:
- Telegram WebApp SDK統合とユーザー認証
- Socket.ioによるリアルタイム通信
- ゲームルーム作成・参加機能
- ランダムマッチング機能
- 3×3グリッドの○×ゲーム
- 勝敗判定ロジック
- プレイヤー戦績管理
- リマッチ機能

技術スタック:
- TypeScript（Strict mode）
- Socket.io Server & Client
- Express
- SQLite`,
  context: {
    repository: 'miyabi_telegram_app',
    owner: 'dokyon',
    baseBranch: 'main',
    relatedFiles: [],
  },
  language: 'typescript',
  useRealAPI: true,
};

console.log('🤖 CodeGenAgent starting with AnthropicClient...\n');

const result = await agent.generate(input);

if (result.success) {
  console.log('\n✅ Code generation succeeded!\n');
  console.log('Generated files:');
  result.data.files.forEach(file => {
    console.log(`  - ${file.path}`);
  });

  console.log('\n📊 Quality Score:', result.data.qualityScore);
  console.log('💰 Cost: $', result.data.cost?.toFixed(4));

  // Save output for PRAgent
  const { saveCodeGenOutput } = await import(join(npxCachePath, 'miyabi/dist/utils/storage.js'));
  saveCodeGenOutput('dokyon', 'miyabi_telegram_app', 1, result.data);

  // Write files to disk
  const fs = await import('fs');
  const path = await import('path');

  for (const file of result.data.files) {
    const filePath = path.default.join(process.cwd(), file.path);
    const dir = path.default.dirname(filePath);

    if (!fs.default.existsSync(dir)) {
      fs.default.mkdirSync(dir, { recursive: true });
    }

    fs.default.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`✓ Written: ${file.path}`);
  }

  // Write test files
  if (result.data.tests) {
    for (const test of result.data.tests) {
      const filePath = path.default.join(process.cwd(), test.path);
      const dir = path.default.dirname(filePath);

      if (!fs.default.existsSync(dir)) {
        fs.default.mkdirSync(dir, { recursive: true });
      }

      fs.default.writeFileSync(filePath, test.content, 'utf-8');
      console.log(`✓ Written: ${test.path}`);
    }
  }

} else {
  console.error('\n❌ Code generation failed:', result.error);
  process.exit(1);
}
