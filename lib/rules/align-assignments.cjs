/**
 * 連続する代入文の = の位置を揃える ESLint のルール
 * 間にコメント行だけがある代入文は同じグループとして扱い、空行、コメント以外の文、別のブロックでグループを分ける
 * 自動修正は = の前の空白だけを変え、それ以外の文字は変えない
 * @file
 */
'use strict';

/**
 * ESLint が読み込むルールオブジェクト
 * ESLint がキー名（meta、create）で読みに来るため、キー名は変えない
 */
module.exports = {
	// ルールの種類、説明、自動修正の範囲、オプション、メッセージ
	meta: {
		// 見た目だけを整えるルール。コードの意味は変えない
		type: 'layout',
		// ドキュメントに出す説明
		docs: {
			// ルールの 1 行説明。英語のまま公開している
			description: 'Align assignment operators across consecutive statements and intervening comment lines'
		},
		// 自動修正で変えるのは空白だけ
		fixable: 'whitespace',
		// オプションの形。オブジェクト 1 つで、requiresOnly だけを受ける
		schema: [
			// オプションのオブジェクト
			{
				// JSON Schema の型。オブジェクトだけを受ける
				type: 'object',
				// 受けるオプションの項目
				properties: {
					// true のとき、require( を含む変数宣言だけを整列の対象にする
					requiresOnly: { type: 'boolean' }
				},
				// properties に無い項目を指定したら、設定の誤りにする
				additionalProperties: false
			}
		],
		// メッセージの ID と本文
		messages: {
			// グループの = が揃っていないときの報告
			notAligned: 'This group of assignments is not aligned'
		}
	},

	/**
	 * 代入文をグループに分け、グループごとに = の位置を揃える
	 * コメントだけの行はグループに含め、空行とほかの文でグループを分ける
	 * ESLint が名前で呼ぶメソッドのため、名前は create のまま
	 * @param {import('eslint').Rule.RuleContext} context ESLint のルールのコンテキスト。ファイル 1 つにつき 1 回渡される
	 * @returns {import('eslint').Rule.RuleListener} AST のノードの種類ごとに呼ぶ関数
	 */
	create(context) {
		// 検査中のファイルのソース。ESLint 9 以降は context.sourceCode、それより前は getSourceCode() で取る
		const SOURCE_CODE = context.sourceCode ?? context.getSourceCode();
		// require( を含む変数宣言だけを対象にするとき true。オプションが無いときは false
		const REQUIRES_ONLY = context.options[0]?.requiresOnly === true;
		// ファイル内のすべてのコメント。代入文の間がコメントだけかを調べるのに使う
		const COMMENTS = SOURCE_CODE.getAllComments();
		// 代入文のグループ。見つけた順に並び、Program:exit でまとめて調べる
		const GROUPS = [];
		// 直前に見つけた代入文。次の代入文が同じグループかを決めるのに使う。まだ無いときは undefined
		let previousCandidate;

		// ESLint へ返す、ノードの種類と呼ぶ関数の組
		return {
			// 変数宣言を見つけたとき
			VariableDeclaration: VisitVariableDeclaration,
			// 式文を見つけたとき
			ExpressionStatement: VisitExpressionStatement,
			// ファイルを読み終えたとき
			'Program:exit': CheckAllGroups
		};

		/**
		 * 初期値を持つ変数宣言を、整列の候補に加える
		 * requiresOnly のときは、require( を含まない宣言を候補にしない
		 * @param {import('estree').VariableDeclaration} node 変数宣言のノード
		 * @returns {void}
		 */
		function VisitVariableDeclaration(node) {
			// require の宣言だけを揃える設定で、require を含まない宣言は候補にしない
			if (REQUIRES_ONLY && !/\brequire\s*\(/u.test(SOURCE_CODE.getText(node))) return;

			// 初期値を持つ最初の宣言子。初期値が 1 つも無いときは undefined
			const DECLARATOR = node.declarations.find((item) => item.init);
			// 初期値の無い宣言には = が無いため、候補にしない
			if (!DECLARATOR) return;

			// 変数名と初期値の間にある = のトークン。分割代入の既定値の = は、変数名の中にあるため選ばない
			const ASSIGNMENT_TOKEN = SOURCE_CODE.getTokensBetween(DECLARATOR.id, DECLARATOR.init).find((token) => token.value === '=');

			/* NOTE: export const を、文として ExportNamedDeclaration ごと扱うことについて
			 * 1. export const は、独自の ExportNamedDeclaration に包まれる
			 * 2. 包んでいるノードを文として扱うと、並んだ export 付きの宣言どうしも、親が同じ Program になり同じグループにできる */
			// グループ分けに使う文のノード。export const のときは、包んでいる ExportNamedDeclaration
			const STATEMENT_NODE = node.parent.type === 'ExportNamedDeclaration' && node.parent.declaration === node ? node.parent : node;

			AddCandidate(STATEMENT_NODE, node, ASSIGNMENT_TOKEN);
		}

		/**
		 * 単独の代入式の文を、整列の候補に加える
		 * += などの複合代入も候補にする
		 * @param {import('estree').ExpressionStatement} node 式文のノード
		 * @returns {void}
		 */
		function VisitExpressionStatement(node) {
			// 代入式でない式文（関数呼び出しなど）は候補にしない
			if (node.expression.type !== 'AssignmentExpression') return;

			// 左辺と右辺の間にある代入演算子のトークン。+= などの複合代入も含む
			const ASSIGNMENT_TOKEN = SOURCE_CODE.getTokensBetween(node.expression.left, node.expression.right).find((token) => token.value === node.expression.operator);

			AddCandidate(node, node.expression, ASSIGNMENT_TOKEN);
		}

		/**
		 * 代入演算子が文の最初の行にある文を、候補としてグループに加える
		 * 直前の候補と同じグループにならないときは、新しいグループを作る
		 * @param {import('estree').Node} statementNode グループ分けに使う文全体のノード
		 * @param {import('estree').Node} assignmentNode 代入演算子を含むノード。報告の位置にも使う
		 * @param {import('eslint').AST.Token | undefined} assignmentToken 代入演算子のトークン。見つからないときは undefined
		 * @returns {void}
		 */
		function AddCandidate(statementNode, assignmentNode, assignmentToken) {
			// 代入を含むノードの最初のトークン。代入演算子と同じ行かを調べる
			const FIRST_TOKEN = SOURCE_CODE.getFirstToken(assignmentNode);

			// 代入演算子が無いか、最初の行に無い文は、揃えると読みにくくなるため候補にしない
			if (!assignmentToken || !FIRST_TOKEN || assignmentToken.loc.start.line !== FIRST_TOKEN.loc.start.line) return;

			// グループに積む候補
			const CANDIDATE = {
				// グループ分けに使う文全体のノード
				statementNode,
				// 代入演算子を含むノード
				assignmentNode,
				// 揃える代入演算子のトークン
				assignmentToken
			};

			// 最初の候補か、直前の候補と別のグループになるときは、新しいグループを作る
			if (!previousCandidate || StartsNewGroup(previousCandidate.statementNode, statementNode)) GROUPS.push([CANDIDATE]);
			else GROUPS.at(-1).push(CANDIDATE);

			previousCandidate = CANDIDATE;
		}

		/**
		 * 2 つの代入文が、別のグループになるかを返す
		 * 間の行がすべてコメントで埋まっているときだけ、同じグループにする
		 * @param {import('estree').Node} previousNode 直前の代入文
		 * @param {import('estree').Node} currentNode 今の代入文
		 * @returns {boolean} 今の代入文から新しいグループを始めるとき true
		 */
		function StartsNewGroup(previousNode, currentNode) {
			// 親が違う（別のブロックにある）代入文は、同じグループにしない
			if (currentNode.parent !== previousNode.parent) return true;

			// for 文の初期化と更新の式は、1 つずつ別のグループにする
			if (previousNode.parent.type === 'ForStatement') return true;

			// 間にコメント以外のトークンがあれば、実行される構文が挟まっているため、グループを分ける
			if (SOURCE_CODE.getTokensBetween(previousNode, currentNode).length > 0) return true;

			// 直前の代入文の最後の行。1 始まり
			const PREVIOUS_LINE = SOURCE_CODE.getLastToken(previousNode).loc.end.line;
			// 今の代入文の最初の行。1 始まり
			const CURRENT_LINE = SOURCE_CODE.getFirstToken(currentNode).loc.start.line;

			// 隣の行どうしなら、同じグループ
			if (CURRENT_LINE - PREVIOUS_LINE === 1) return false;

			// 同じ行に並んだ代入文は、揃えられないため別のグループにする
			if (CURRENT_LINE <= PREVIOUS_LINE) return true;

			// 2 つの代入文の間で、コメントが占めている行の番号。コメントが占めていない行は空行とみなす
			const COMMENT_LINES = new Set();
			for (const COMMENT of COMMENTS) {
				// 2 つの代入文の間に収まらないコメントは数えない
				if (COMMENT.range[0] < previousNode.range[1] || COMMENT.range[1] > currentNode.range[0]) continue;

				for (let line = COMMENT.loc.start.line; line <= COMMENT.loc.end.line; line++) COMMENT_LINES.add(line);
			}

			for (let line = PREVIOUS_LINE + 1; line < CURRENT_LINE; line++) {
				// コメントが占めていない行（空行）が 1 行でもあれば、グループを分ける
				if (!COMMENT_LINES.has(line)) return true;
			}

			return false;
		}

		/**
		 * 集めたすべてのグループを調べ、揃っていないグループを報告する
		 * @returns {void}
		 */
		function CheckAllGroups() {
			for (const GROUP of GROUPS) CheckGroup(GROUP);
		}

		/**
		 * = の位置が揃っていないグループを報告し、空白を直す修正を付ける
		 * 候補が 1 つだけのグループは揃える相手が無いため調べない
		 * @param {Array<object>} group 1 つのグループの候補
		 * @returns {void}
		 */
		function CheckGroup(group) {
			// 候補が 1 つだけのグループは、揃える相手が無い
			if (group.length < 2) return;

			// 揃える先の = の桁。0 始まり。各候補が空白 1 つで置ける最小の桁のうち、最も右
			const TARGET_COLUMN = Math.max(...group.map(GetMinimumEqualsColumn));
			// すべての候補が揃える先の桁にあれば、報告しない
			if (group.every((candidate) => GetEqualsColumn(candidate) === TARGET_COLUMN)) return;

			context.report({
				// 報告の位置。グループの最初の代入
				node: group[0].assignmentNode,
				// 報告するメッセージの ID
				messageId: 'notAligned',
				/**
				 * グループの各代入演算子の前の空白を、揃える先の桁に合わせて直す
				 * ESLint が名前で呼ぶメソッドのため、名前は fix のまま
				 * @param {import('eslint').Rule.RuleFixer} fixer ESLint の修正を作るオブジェクト
				 * @returns {Array<import('eslint').Rule.Fix>} グループの修正。揃っている候補の分は含めない
				 */
				fix(fixer) {
					return group.map((candidate) => CreateFix(fixer, candidate, TARGET_COLUMN)).filter(Boolean);
				}
			});
		}

		/**
		 * 代入演算子の = がある桁を返す
		 * += などの複合代入では、最後の文字の = の桁
		 * @param {object} candidate 整列の候補
		 * @returns {number} = の桁。0 始まり
		 */
		function GetEqualsColumn(candidate) {
			return candidate.assignmentToken.loc.end.column - 1;
		}

		/**
		 * 直前のトークンとの間を空白 1 つにしたときの、= の桁を返す
		 * 今ある整列用の空白に左右されないよう、直前のトークンの位置から数える。そうしないと、名前を短くしても前の整列位置が残る
		 * @param {object} candidate 整列の候補
		 * @returns {number} = を置ける最小の桁。0 始まり
		 */
		function GetMinimumEqualsColumn(candidate) {
			// 代入演算子のトークン
			const OPERATOR_TOKEN = candidate.assignmentToken;
			// 代入演算子の直前のトークン。変数名や閉じ括弧
			const PREVIOUS_TOKEN = SOURCE_CODE.getTokenBefore(OPERATOR_TOKEN);

			return PREVIOUS_TOKEN.loc.end.column + OPERATOR_TOKEN.value.length;
		}

		/**
		 * 代入演算子 1 つを、揃える先の桁へ動かす空白の修正を作る
		 * @param {import('eslint').Rule.RuleFixer} fixer ESLint の修正を作るオブジェクト
		 * @param {object} candidate 整列の候補
		 * @param {number} targetColumn 揃える先の = の桁。0 始まり
		 * @returns {import('eslint').Rule.Fix | null} 空白を置き換える修正。すでに揃っているか、空白が 1 つ未満になるときは null
		 */
		function CreateFix(fixer, candidate, targetColumn) {
			// 代入演算子のトークン
			const OPERATOR_TOKEN = candidate.assignmentToken;
			// 代入演算子の直前のトークン。この後ろから代入演算子までの空白を置き換える
			const PREVIOUS_TOKEN = SOURCE_CODE.getTokenBefore(OPERATOR_TOKEN);
			// 代入演算子の先頭を置く桁。0 始まり。+= のように 2 文字以上の演算子は、= が揃う位置から左へずらす
			const OPERATOR_COLUMN = targetColumn - OPERATOR_TOKEN.value.length + 1;
			// 直前のトークンと代入演算子の間に要る空白の数
			const SPACES_REQUIRED = OPERATOR_COLUMN - PREVIOUS_TOKEN.loc.end.column;
			// 直前のトークンと代入演算子の間の、今の文字列
			const CURRENT_SPACING = SOURCE_CODE.text.slice(PREVIOUS_TOKEN.range[1], OPERATOR_TOKEN.range[0]);

			// 空白が 1 つも置けないか、すでに必要な数の空白だけのときは、直さない
			if (SPACES_REQUIRED < 1 || CURRENT_SPACING === ' '.repeat(SPACES_REQUIRED)) return null;

			return fixer.replaceTextRange([PREVIOUS_TOKEN.range[1], OPERATOR_TOKEN.range[0]], ' '.repeat(SPACES_REQUIRED));
		}
	}
};
