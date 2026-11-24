/**
 * このリポジトリのソースとテストへ、ESLint の推奨ルールと自分自身の整列ルールを適用する
 * 整列ルールは公開前の index.cjs をそのまま読み込むため、ルールを直すとこのリポジトリの検査にもすぐ効く
 * @file
 */
import JS from '@eslint/js';

import ALIGN_ASSIGNMENTS from './index.cjs';

export default [
	// 検査しない生成物と依存パッケージ
	{
		ignores: ['coverage/**', 'node_modules/**']
	},
	JS.configs.recommended,
	// .cjs と .mjs に、整列ルール、タブの字下げ、セミコロンを求める設定
	{
		// 対象にするファイル。CommonJS と ES modules の両方
		files: ['**/*.cjs', '**/*.mjs'],
		// 構文の解釈。.cjs も ES2022 のモジュールとして読み、module と require をグローバルとして許す
		languageOptions: {
			// 解釈する ECMAScript のバージョン
			ecmaVersion: 2022,
			// import / export を許す読み方
			sourceType: 'module',
			// 未定義のエラーにしないグローバル。どちらも書き換えない
			globals: {
				// CommonJS の module.exports に使う
				module: 'readonly',
				// CommonJS の require に使う
				require: 'readonly'
			}
		},
		// ルール名の接頭辞と、読み込むプラグイン
		plugins: {
			'align-assignments': ALIGN_ASSIGNMENTS
		},
		// 適用するルールと重さ
		rules: {
			// 連続する代入の = を揃える。このリポジトリが作るルール
			'align-assignments/align-assignments': 'error',
			// 字下げはタブ。switch の case は 1 段下げる
			indent: ['error', 'tab', { SwitchCase: 1 }],
			// 文末のセミコロンを必ず付ける
			semi: ['error', 'always']
		}
	}
];
