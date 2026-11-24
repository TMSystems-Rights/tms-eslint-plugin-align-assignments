/**
 * 整列ルールを、ESLint の Flat Config から読み込めるプラグインとして公開する
 * ルールの中身は lib/rules/align-assignments.cjs が持ち、このファイルは名前と推奨設定を付けて束ねるだけ
 * ESM の import と CommonJS の require のどちらからも、同じオブジェクトを返す
 * @file
 */
'use strict';

/** 代入の = を揃えるルール。meta と create を持つ ESLint のルールオブジェクト */
const ALIGN_ASSIGNMENTS = require('./lib/rules/align-assignments.cjs');

/**
 * 公開するプラグイン
 * ESLint がキー名（meta、configs、rules）で読みに来るため、キー名は変えない。configs は下で推奨設定を足す
 */
const PLUGIN = {
	// プラグインの名前とバージョン。ESLint がキャッシュと表示に使う
	meta: {
		// npm のパッケージ名
		name: '@tms/eslint-plugin-align-assignments',
		// プラグインのバージョン
		version: '1.0.1',
		// 設定でルール名の接頭辞に使う名前
		namespace: 'align-assignments'
	},
	// 共有設定。推奨設定はプラグイン自身を参照するため、PLUGIN を作った後に足す
	configs: {},
	// ルール名と、そのルールの組
	rules: {
		'align-assignments': ALIGN_ASSIGNMENTS
	}
};

// 推奨設定。プラグインを読み込み、整列ルールをエラーにする
PLUGIN.configs['flat/recommended'] = {
	// 設定の名前。ESLint の設定の調査ツールに出る
	name: '@tms/align-assignments/flat/recommended',
	// 接頭辞 align-assignments でこのプラグインを読み込む
	plugins: {
		'align-assignments': PLUGIN
	},
	// 有効にするルール
	rules: {
		'align-assignments/align-assignments': 'error'
	}
};

module.exports = PLUGIN;
