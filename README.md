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

このパッケージはnpmレジストリには公開していません。GitHub Releaseで公開しているバージョン固定の`.tgz`を指定してインストールします。

```shell
npm install --save-dev "https://github.com/TMSystems-Rights/tms-eslint-plugin-align-assignments/releases/download/v1.0.3/tms-eslint-plugin-align-assignments-1.0.3.tgz"
```

更新時は[Releases](https://github.com/TMSystems-Rights/tms-eslint-plugin-align-assignments/releases)で新しいバージョンを確認し、URL内のバージョン番号とファイル名を変更してください。

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

`requiresOnly: true`を指定すると、変数宣言のうち、宣言文内に`require()`を含むものだけを整列対象にします。CommonJS形式の依存モジュール宣言だけを整列し、通常の変数宣言には手を加えたくない場合に利用できます。

```javascript
rules: {
	'align-assignments/align-assignments': ['error', { requiresOnly: true }]
}
```

たとえば、次のコードに自動修正を適用します。

```javascript
const fs = require('node:fs');
const path = require('node:path');

const port = 3000;
const developmentMode = true;
```

`require()`を含む宣言だけが整列され、通常の変数宣言は変更されません。

```javascript
const fs   = require('node:fs');
const path = require('node:path');

const port = 3000;
const developmentMode = true;
```

## 対応環境

- Node.js 18.18以降
- ESLint 9または10

## ライセンス

MIT License。元プラグインに関する表記は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
