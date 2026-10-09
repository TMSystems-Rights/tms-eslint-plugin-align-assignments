import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import { Linter as Linter9 } from 'eslint';
import { Linter as Linter10 } from 'eslint10';

import plugin from '../index.cjs';

const require        = createRequire(import.meta.url);
const eslintVersions = [
	{ name: 'ESLint 9', Linter: Linter9 },
	{ name: 'ESLint 10', Linter: Linter10 }
];

/**
 * Verify and fix source code using one ESLint implementation.
 *
 * @param {typeof Linter9} LinterConstructor ESLint Linter constructor
 * @param {string} code Source code under test
 * @param {object} [ruleOptions] Rule options
 * @returns {import('eslint').Linter.FixReport} ESLint fix report
 */
function verifyAndFix(LinterConstructor, code, ruleOptions) {
	const linter = new LinterConstructor();
	const rule   = ruleOptions
		? ['error', ruleOptions]
		: 'error';
	const config = {
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module'
		},
		plugins: {
			'align-assignments': plugin
		},
		rules: {
			'align-assignments/align-assignments': rule
		}
	};

	return linter.verifyAndFix(code, config);
}

test('ESM importとCommonJS requireが同じプラグインAPIを公開する', () => {
	const requiredPlugin = require('../index.cjs');

	assert.equal(requiredPlugin, plugin);
	assert.equal(plugin.meta.name, '@tms/eslint-plugin-align-assignments');
	assert.equal(typeof plugin.rules['align-assignments'].create, 'function');
	assert.equal(
		plugin.configs['flat/recommended'].rules['align-assignments/align-assignments'],
		'error'
	);
});

for (const { name, Linter } of eslintVersions) {
	test(`${name}: 隣接する代入文を揃える`, () => {
		const result = verifyAndFix(Linter, [
			"const hoge = 'hoge';",
			"const hogeHoge = 'hogehoge';"
		].join('\n'));

		assert.equal(result.output, [
			"const hoge     = 'hoge';",
			"const hogeHoge = 'hogehoge';"
		].join('\n'));
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: コメント行を透過して代入文を揃える`, () => {
		const result = verifyAndFix(Linter, [
			"const hoge = 'hoge';",
			'// コメント',
			"const hogeHoge = 'hogehoge';"
		].join('\n'));

		assert.equal(result.output, [
			"const hoge     = 'hoge';",
			'// コメント',
			"const hogeHoge = 'hogehoge';"
		].join('\n'));
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: 連続する行コメントとブロックコメントを透過する`, () => {
		const result = verifyAndFix(Linter, [
			'let a = 1;',
			'// 1つ目',
			'/*',
			' * 2つ目',
			' */',
			'longName += 2;'
		].join('\n'));

		assert.equal(result.output, [
			'let a     = 1;',
			'// 1つ目',
			'/*',
			' * 2つ目',
			' */',
			'longName += 2;'
		].join('\n'));
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: 分割代入演算子と分割代入の既定値を区別する`, () => {
		const result = verifyAndFix(Linter, [
			"const { short = 'fallback' } = source;",
			'// コメント',
			'const longName = other;'
		].join('\n'));
		const lines  = result.output.split('\n');

		assert.equal(lines[0], "const { short = 'fallback' } = source;");
		assert.equal(lines[0].lastIndexOf('='), lines[2].lastIndexOf('='));
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: 空行があればコメントの前後を別グループにする`, () => {
		const source = [
			"const hoge = 'hoge';",
			'// コメント',
			'',
			"const hogeHoge = 'hogehoge';"
		].join('\n');
		const result = verifyAndFix(Linter, source);

		assert.equal(result.output, source);
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: コメント以外の文があれば別グループにする`, () => {
		const source = [
			'let a = 1;',
			'doSomething(); // コメントがあっても別の文は透過しない',
			'longName = 2;'
		].join('\n');
		const result = verifyAndFix(Linter, source);

		assert.equal(result.output, source);
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: 異なるブロックの代入文を同じグループにしない`, () => {
		const source = [
			'if (condition) {',
			'\ta = 1;',
			'}',
			'longName = 2;'
		].join('\n');
		const result = verifyAndFix(Linter, source);

		assert.equal(result.output, source);
		assert.equal(result.messages.length, 0);
	});

	test(`${name}: requiresOnlyではrequire宣言だけを整列する`, () => {
		const result = verifyAndFix(Linter, [
			"const short = require('short');",
			'// コメント',
			"const considerablyLonger = require('long');",
			'const local = 1;'
		].join('\n'), { requiresOnly: true });

		assert.equal(result.output, [
			"const short              = require('short');",
			'// コメント',
			"const considerablyLonger = require('long');",
			'const local = 1;'
		].join('\n'));
		assert.equal(result.messages.length, 0);
	});
}
