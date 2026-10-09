# @tms/eslint-plugin-align-assignments

`eslint-plugin-align-assignments`の動作をTMS向けに拡張したESLint Flat Config用プラグインです。

連続する代入文の`=`を揃えつつ、間にコメント行だけがある場合は同じグループとして扱います。空行、コメント以外の文、異なるブロックはグループ境界になります。

通常の変数宣言だけでなく、トップレベルの`export const`も同じ規則で整列します。

```javascript
const shortName = 'value';
// このコメント行を透過して整列する
const considerablyLongerName = 'another value';

// 空行があるため、ここからは別グループ
const other = 'value';
```

## インストール

```shell
npm install --save-dev @tms/eslint-plugin-align-assignments
```

## Flat Config

既存のルール名を維持して設定できます。

```javascript
import alignAssignments from '@tms/eslint-plugin-align-assignments';

export default [
	{
		plugins: {
			'align-assignments': alignAssignments
		},
		rules: {
			'align-assignments/align-assignments': 'error'
		}
	}
];
```

組み込みの推奨設定も利用できます。

```javascript
import alignAssignments from '@tms/eslint-plugin-align-assignments';

export default [
	alignAssignments.configs['flat/recommended']
];
```

CommonJSの設定では`require()`を利用できます。

```javascript
const alignAssignments = require('@tms/eslint-plugin-align-assignments');
```

## オプション

`requiresOnly: true`を指定すると、`require()`を含む宣言だけを整列します。

```javascript
rules: {
	'align-assignments/align-assignments': ['error', { requiresOnly: true }]
}
```

## 対応環境

- Node.js 18.18以降
- ESLint 9または10

## ライセンス

MIT License。元プラグインに関する表記は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
