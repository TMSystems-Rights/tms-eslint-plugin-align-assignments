/**
 * 整列ルールを ESLint 9 と ESLint 10 の両方で動かし、自動修正の結果を確かめる
 * 各ケースは、入力のコードを Linter の verifyAndFix に渡し、修正後のコードと残った報告の数を比べる
 * ファイルは読み書きせず、入力と期待値はすべてこのファイルの文字列で持つ
 * @file
 */
import ASSERT from 'node:assert/strict';
import { createRequire } from 'node:module';
import TEST from 'node:test';

import { Linter as Linter9 } from 'eslint';
import { Linter as Linter10 } from 'eslint10';

import PLUGIN from '../index.cjs';

/** CommonJS の require。ESM の import と同じプラグインが返るかを確かめるために使う */
const REQUIRE = createRequire(import.meta.url);
/**
 * 確かめる ESLint のバージョンと、その Linter のクラス
 * ESLint 10 は devDependencies に別名 eslint10 で入れている
 */
const ESLINT_VERSIONS = [
	// ESLint 9
	{
		// テスト名の先頭に付ける名前
		name: 'ESLint 9',
		// 検査に使う Linter のクラス
		Linter: Linter9
	},
	// ESLint 10
	{
		// テスト名の先頭に付ける名前
		name: 'ESLint 10',
		// 検査に使う Linter のクラス
		Linter: Linter10
	}
];

/**
 * 1 つの ESLint の実装で、整列ルールだけを有効にしてコードを検査し、自動修正する
 * @param {typeof Linter9} LinterConstructor ESLint の Linter のクラス
 * @param {string} code 検査するコード。行は \n で区切る
 * @param {object} [ruleOptions] ルールのオプション。省略したときはオプション無しで動かす
 * @returns {import('eslint').Linter.FixReport} 修正後のコード（output）と、修正しきれずに残った報告（messages）
 */
function VerifyAndFix(LinterConstructor, code, ruleOptions) {
	// 検査に使う Linter。呼ぶたびに作り、ケースどうしで状態を持ち越さない
	const LINTER = new LinterConstructor();
	// 整列ルールの設定。オプションがあるときだけ配列で渡す
	const RULE = ruleOptions ? ['error', ruleOptions] : 'error';
	// Linter へ渡す Flat Config。整列ルール以外は有効にしない
	const CONFIG = {
		// 入力のコードを ES2022 のモジュールとして読む
		languageOptions: {
			// 解釈する ECMAScript のバージョン
			ecmaVersion: 2022,
			// import / export を許す読み方
			sourceType: 'module'
		},
		// 検査するプラグイン
		plugins: {
			'align-assignments': PLUGIN
		},
		// 有効にするのは整列ルールだけ
		rules: {
			'align-assignments/align-assignments': RULE
		}
	};

	return LINTER.verifyAndFix(code, CONFIG);
}

TEST('ESM importとCommonJS requireが同じプラグインAPIを公開する', () => {
	// require で読み込んだプラグイン。import で読み込んだものと同じオブジェクトのはず
	const REQUIRED_PLUGIN = REQUIRE('../index.cjs');

	ASSERT.equal(REQUIRED_PLUGIN, PLUGIN);
	ASSERT.equal(PLUGIN.meta.name, '@tms/eslint-plugin-align-assignments');
	ASSERT.equal(typeof PLUGIN.rules['align-assignments'].create, 'function');
	ASSERT.equal(PLUGIN.configs['flat/recommended'].rules['align-assignments/align-assignments'], 'error');
});

for (const { name: NAME, Linter: LINTER } of ESLINT_VERSIONS) {
	TEST(`${NAME}: 隣接する代入文を揃える`, () => {
		// 名前の長さが違う 2 つの宣言を修正した結果
		const RESULT = VerifyAndFix(LINTER, ["const hoge = 'hoge';", "const hogeHoge = 'hogehoge';"].join('\n'));

		ASSERT.equal(RESULT.output, ["const hoge     = 'hoge';", "const hogeHoge = 'hogehoge';"].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: 識別子短縮後に以前の整列位置を引き継がない`, () => {
		// 長い名前に合わせた空白が残っている宣言を修正した結果。空白は 1 つに戻るはず
		const RESULT = VerifyAndFix(LINTER, ["const aa    = 'aa';", "const bb = 'bb';"].join('\n'));

		ASSERT.equal(RESULT.output, ["const aa = 'aa';", "const bb = 'bb';"].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: コメント行を透過して代入文を揃える`, () => {
		// 間に行コメントが 1 行ある 2 つの宣言を修正した結果
		const RESULT = VerifyAndFix(LINTER, ["const hoge = 'hoge';", '// コメント', "const hogeHoge = 'hogehoge';"].join('\n'));

		ASSERT.equal(RESULT.output, ["const hoge     = 'hoge';", '// コメント', "const hogeHoge = 'hogehoge';"].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: JSDocコメントを挟むexport付き変数宣言を揃える`, () => {
		// JSDoc を挟んだ 3 つの export const を修正した結果
		const RESULT = VerifyAndFix(LINTER, ['/** ウィンドウ最小幅 */', 'export const MIN_WINDOW_WIDTH = 900;', '/** ウィンドウ最小高さ */', 'export const MIN_WINDOW_HEIGHT = 560;', '/** カスタムタイトルバー高さ */', 'export const TITLE_BAR_OVERLAY_HEIGHT = 48;'].join('\n'));

		ASSERT.equal(RESULT.output, ['/** ウィンドウ最小幅 */', 'export const MIN_WINDOW_WIDTH         = 900;', '/** ウィンドウ最小高さ */', 'export const MIN_WINDOW_HEIGHT        = 560;', '/** カスタムタイトルバー高さ */', 'export const TITLE_BAR_OVERLAY_HEIGHT = 48;'].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: 連続する行コメントとブロックコメントを透過する`, () => {
		// 行コメントと複数行のブロックコメントを挟んだ、代入と複合代入を修正した結果
		const RESULT = VerifyAndFix(LINTER, ['let a = 1;', '// 1つ目', '/*', ' * 2つ目', ' */', 'longName += 2;'].join('\n'));

		ASSERT.equal(RESULT.output, ['let a     = 1;', '// 1つ目', '/*', ' * 2つ目', ' */', 'longName += 2;'].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: 分割代入演算子と分割代入の既定値を区別する`, () => {
		// 既定値の = を持つ分割代入と、通常の宣言を修正した結果
		const RESULT = VerifyAndFix(LINTER, ["const { short = 'fallback' } = source;", '// コメント', 'const longName = other;'].join('\n'));
		// 修正後のコードの行。1 行目と 3 行目の最後の = の位置を比べる
		const LINES = RESULT.output.split('\n');

		ASSERT.equal(LINES[0], "const { short = 'fallback' } = source;");
		ASSERT.equal(LINES[0].lastIndexOf('='), LINES[2].lastIndexOf('='));
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: 空行があればコメントの前後を別グループにする`, () => {
		// 入力のコード。コメントの後に空行があるため、揃えずにそのまま残るはず
		const SOURCE = ["const hoge = 'hoge';", '// コメント', '', "const hogeHoge = 'hogehoge';"].join('\n');
		// 入力を修正した結果
		const RESULT = VerifyAndFix(LINTER, SOURCE);

		ASSERT.equal(RESULT.output, SOURCE);
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: コメント以外の文があれば別グループにする`, () => {
		// 入力のコード。間に関数呼び出しの文があるため、揃えずにそのまま残るはず
		const SOURCE = ['let a = 1;', 'doSomething(); // コメントがあっても別の文は透過しない', 'longName = 2;'].join('\n');
		// 入力を修正した結果
		const RESULT = VerifyAndFix(LINTER, SOURCE);

		ASSERT.equal(RESULT.output, SOURCE);
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: 異なるブロックの代入文を同じグループにしない`, () => {
		// 入力のコード。1 つ目の代入は if のブロックの中にあるため、揃えずにそのまま残るはず
		const SOURCE = ['if (condition) {', '\ta = 1;', '}', 'longName = 2;'].join('\n');
		// 入力を修正した結果
		const RESULT = VerifyAndFix(LINTER, SOURCE);

		ASSERT.equal(RESULT.output, SOURCE);
		ASSERT.equal(RESULT.messages.length, 0);
	});

	TEST(`${NAME}: requiresOnlyではrequire宣言だけを整列する`, () => {
		// require の宣言 2 つと、require でない宣言 1 つを、requiresOnly で修正した結果
		const RESULT = VerifyAndFix(LINTER, ["const short = require('short');", '// コメント', "const considerablyLonger = require('long');", 'const local = 1;'].join('\n'), { requiresOnly: true });

		ASSERT.equal(RESULT.output, ["const short              = require('short');", '// コメント', "const considerablyLonger = require('long');", 'const local = 1;'].join('\n'));
		ASSERT.equal(RESULT.messages.length, 0);
	});
}
