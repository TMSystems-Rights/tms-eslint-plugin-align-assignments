'use strict';

module.exports = {
	meta: {
		type: 'layout',
		docs: {
			description: 'Align assignment operators across consecutive statements and intervening comment lines'
		},
		fixable: 'whitespace',
		schema: [
			{
				type: 'object',
				properties: {
					requiresOnly: { type: 'boolean' }
				},
				additionalProperties: false
			}
		],
		messages: {
			notAligned: 'This group of assignments is not aligned'
		}
	},

	/**
	 * Group assignment statements and align the operators in each group.
	 * Comment-only lines remain in the group; blank lines and other statements end it.
	 *
	 * @param {import('eslint').Rule.RuleContext} context ESLint rule context
	 * @returns {import('eslint').Rule.RuleListener} AST listeners
	 */
	create(context) {
		const sourceCode   = context.sourceCode ?? context.getSourceCode();
		const requiresOnly = context.options[0]?.requiresOnly === true;
		const comments     = sourceCode.getAllComments();
		const groups       = [];
		let previousCandidate;

		return {
			VariableDeclaration: visitVariableDeclaration,
			ExpressionStatement: visitExpressionStatement,
			'Program:exit': checkAllGroups
		};

		/**
		 * Add a variable declaration with an initializer as an alignment candidate.
		 *
		 * @param {import('estree').VariableDeclaration} node Variable declaration
		 * @returns {void}
		 */
		function visitVariableDeclaration(node) {
			if (requiresOnly && !/\brequire\s*\(/u.test(sourceCode.getText(node)))
				return;

			const declarator = node.declarations.find(item => item.init);
			if (!declarator)
				return;

			const assignmentToken = sourceCode
				.getTokensBetween(declarator.id, declarator.init)
				.find(token => token.value === '=');

			// `export const` is wrapped in its own ExportNamedDeclaration. Use that wrapper as
			// the statement so adjacent exported declarations still share the Program parent.
			const statementNode = node.parent.type === 'ExportNamedDeclaration'
				&& node.parent.declaration === node
				? node.parent
				: node;

			addCandidate(statementNode, node, assignmentToken);
		}

		/**
		 * Add a standalone assignment expression as an alignment candidate.
		 *
		 * @param {import('estree').ExpressionStatement} node Expression statement
		 * @returns {void}
		 */
		function visitExpressionStatement(node) {
			if (node.expression.type !== 'AssignmentExpression')
				return;

			const assignmentToken = sourceCode
				.getTokensBetween(node.expression.left, node.expression.right)
				.find(token => token.value === node.expression.operator);

			addCandidate(node, node.expression, assignmentToken);
		}

		/**
		 * Add a node whose assignment operator occurs on its first line.
		 *
		 * @param {import('estree').Node} statementNode Entire statement node
		 * @param {import('estree').Node} assignmentNode Node containing the assignment operator
		 * @param {import('eslint').AST.Token | undefined} assignmentToken Assignment operator token
		 * @returns {void}
		 */
		function addCandidate(statementNode, assignmentNode, assignmentToken) {
			const firstToken = sourceCode.getFirstToken(assignmentNode);

			if (!assignmentToken || !firstToken || assignmentToken.loc.start.line !== firstToken.loc.start.line)
				return;

			const candidate = { statementNode, assignmentNode, assignmentToken };

			if (!previousCandidate || startsNewGroup(previousCandidate.statementNode, statementNode))
				groups.push([candidate]);
			else
				groups.at(-1).push(candidate);

			previousCandidate = candidate;
		}

		/**
		 * Decide whether two assignment statements belong to different groups.
		 *
		 * @param {import('estree').Node} previousNode Previous assignment statement
		 * @param {import('estree').Node} currentNode Current assignment statement
		 * @returns {boolean} True when the current statement starts a new group
		 */
		function startsNewGroup(previousNode, currentNode) {
			if (currentNode.parent !== previousNode.parent)
				return true;

			if (previousNode.parent.type === 'ForStatement')
				return true;

			// Any non-comment token represents intervening executable syntax and ends the group.
			if (sourceCode.getTokensBetween(previousNode, currentNode).length > 0)
				return true;

			const previousLine = sourceCode.getLastToken(previousNode).loc.end.line;
			const currentLine  = sourceCode.getFirstToken(currentNode).loc.start.line;

			if (currentLine - previousLine === 1)
				return false;

			if (currentLine <= previousLine)
				return true;

			// A comment covering every intervening line is transparent; an uncovered line is blank.
			const commentLines = new Set();
			for (const comment of comments) {
				if (comment.range[0] < previousNode.range[1] || comment.range[1] > currentNode.range[0])
					continue;

				for (let line = comment.loc.start.line; line <= comment.loc.end.line; line++)
					commentLines.add(line);
			}

			for (let line = previousLine + 1; line < currentLine; line++) {
				if (!commentLines.has(line))
					return true;
			}

			return false;
		}

		/**
		 * Check every collected assignment group.
		 *
		 * @returns {void}
		 */
		function checkAllGroups() {
			for (const group of groups)
				checkGroup(group);
		}

		/**
		 * Report and fix a group whose equals signs do not share a column.
		 *
		 * @param {Array<object>} group Assignment candidates in one group
		 * @returns {void}
		 */
		function checkGroup(group) {
			if (group.length < 2)
				return;

			const targetColumn = Math.max(...group.map(getEqualsColumn));
			if (group.every(candidate => getEqualsColumn(candidate) === targetColumn))
				return;

			context.report({
				node: group[0].assignmentNode,
				messageId: 'notAligned',
				/**
				 * Adjust the whitespace before each assignment operator in the group.
				 *
				 * @param {import('eslint').Rule.RuleFixer} fixer ESLint fixer
				 * @returns {Array<import('eslint').Rule.Fix>} Fixes for the group
				 */
				fix(fixer) {
					return group
						.map(candidate => createFix(fixer, candidate, targetColumn))
						.filter(Boolean);
				}
			});
		}

		/**
		 * Return the zero-based column containing the equals sign of an operator.
		 *
		 * @param {object} candidate Assignment candidate
		 * @returns {number} Equals-sign column
		 */
		function getEqualsColumn(candidate) {
			return candidate.assignmentToken.loc.end.column - 1;
		}

		/**
		 * Create a whitespace fix that moves one assignment operator to the target column.
		 *
		 * @param {import('eslint').Rule.RuleFixer} fixer ESLint fixer
		 * @param {object} candidate Assignment candidate
		 * @param {number} targetColumn Target column of the equals sign
		 * @returns {import('eslint').Rule.Fix | null} Whitespace fix, or null when already aligned
		 */
		function createFix(fixer, candidate, targetColumn) {
			const operatorToken  = candidate.assignmentToken;
			const previousToken  = sourceCode.getTokenBefore(operatorToken);
			const operatorColumn = targetColumn - operatorToken.value.length + 1;
			const spacesRequired = operatorColumn - previousToken.loc.end.column;
			const currentSpacing = sourceCode.text.slice(previousToken.range[1], operatorToken.range[0]);

			if (spacesRequired < 1 || currentSpacing === ' '.repeat(spacesRequired))
				return null;

			return fixer.replaceTextRange(
				[previousToken.range[1], operatorToken.range[0]],
				' '.repeat(spacesRequired)
			);
		}
	}
};
