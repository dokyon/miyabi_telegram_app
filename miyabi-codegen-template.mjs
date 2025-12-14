#!/usr/bin/env node
/**
 * Miyabi CodeGenAgent 汎用テンプレート
 *
 * 使い方:
 * 1. ISSUE_NUMBER 環境変数でIssue番号を指定
 * 2. REQUIREMENTS 環境変数で要件を指定（オプション）
 * 3. node miyabi-codegen-template.mjs
 *
 * 例:
 * ISSUE_NUMBER=5 REQUIREMENTS="ユーザー認証機能を実装" node miyabi-codegen-template.mjs
 */

import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// 環境変数から設定を取得
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || process.argv[2];
const REQUIREMENTS = process.env.REQUIREMENTS;
const REPOSITORY = process.env.REPOSITORY || 'dokyon/miyabi_telegram_app';
const [OWNER, REPO] = REPOSITORY.split('/');
const LANGUAGE = process.env.LANGUAGE || 'typescript';

if (!ISSUE_NUMBER) {
  console.error('❌ ISSUE_NUMBER が指定されていません');
  console.error('使用例: ISSUE_NUMBER=5 node miyabi-codegen-template.mjs');
  console.error('または: node miyabi-codegen-template.mjs 5');
  process.exit(1);
}

console.log(`\n🎯 Issue #${ISSUE_NUMBER} のコード生成を開始します...\n`);

// GitHub IssueからRequirementsを取得（REQUIREMENTSが指定されていない場合）
let requirements = REQUIREMENTS;

if (!requirements) {
  try {
    console.log('📥 GitHub Issueから要件を取得中...\n');
    const issueBody = execSync(
      `gh issue view ${ISSUE_NUMBER} --json body --jq .body`,
      { encoding: 'utf-8' }
    ).trim();
    requirements = issueBody;
    console.log('✅ Issue内容を取得しました\n');
  } catch (error) {
    console.error('❌ Issueの取得に失敗しました:', error.message);
    process.exit(1);
  }
}

// npx cache pathを取得
const npxCachePath = join(homedir(), '.npm/_npx/1fc34a57fdb9f58a/node_modules');

// CodeGenAgentをインポート
const { CodeGenAgent } = await import(
  join(npxCachePath, 'miyabi-agent-sdk/dist/agents/CodeGenAgent.js')
);

// Agent設定
const agent = new CodeGenAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  useClaudeCode: false, // AnthropicClientを使用（ClaudeCodeClientのバグを回避）
});

// タスク定義
const input = {
  taskId: `issue-${ISSUE_NUMBER}`,
  requirements: requirements,
  context: {
    repository: REPO,
    owner: OWNER,
    baseBranch: 'main',
    relatedFiles: [],
  },
  language: LANGUAGE,
  useRealAPI: true,
};

console.log('🤖 CodeGenAgent starting with AnthropicClient...\n');
console.log('📋 要件:\n');
console.log(requirements.substring(0, 200) + '...\n');

// コード生成実行
const result = await agent.generate(input);

if (result.success) {
  console.log('\n✅ コード生成成功!\n');
  console.log('生成ファイル:');
  result.data.files.forEach(file => {
    console.log(`  - ${file.path}`);
  });

  console.log(`\n📊 品質スコア: ${result.data.qualityScore}/100`);
  console.log(`💰 コスト: $${result.data.cost?.toFixed(4)}`);

  // PRAgent用に出力を保存
  const { saveCodeGenOutput } = await import(
    join(npxCachePath, 'miyabi/dist/utils/storage.js')
  );
  saveCodeGenOutput(OWNER, REPO, parseInt(ISSUE_NUMBER), result.data);
  console.log(`\n💾 出力を保存: ~/.miyabi/storage/${OWNER}-${REPO}/issue-${ISSUE_NUMBER}/`);

  // ファイルをディスクに書き込み
  const fs = await import('fs');
  const path = await import('path');

  console.log('\n📝 ファイルを書き込み中...\n');

  for (const file of result.data.files) {
    const filePath = path.default.join(process.cwd(), file.path);
    const dir = path.default.dirname(filePath);

    if (!fs.default.existsSync(dir)) {
      fs.default.mkdirSync(dir, { recursive: true });
    }

    fs.default.writeFileSync(filePath, file.content, 'utf-8');
    console.log(`✓ ${file.path}`);
  }

  // テストファイルを書き込み
  if (result.data.tests) {
    for (const test of result.data.tests) {
      const filePath = path.default.join(process.cwd(), test.path);
      const dir = path.default.dirname(filePath);

      if (!fs.default.existsSync(dir)) {
        fs.default.mkdirSync(dir, { recursive: true });
      }

      fs.default.writeFileSync(filePath, test.content, 'utf-8');
      console.log(`✓ ${test.path}`);
    }
  }

  console.log('\n🎉 完了!\n');
  console.log('次のステップ:');
  console.log('1. git checkout -b feature/issue-' + ISSUE_NUMBER);
  console.log('2. git add .');
  console.log('3. git commit -m "feat: Implement Issue #' + ISSUE_NUMBER + '"');
  console.log('4. git push -u origin feature/issue-' + ISSUE_NUMBER);
  console.log('5. gh pr create --draft\n');

} else {
  console.error('\n❌ コード生成失敗:', result.error);
  process.exit(1);
}
