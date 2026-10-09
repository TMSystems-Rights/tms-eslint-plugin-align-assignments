'use strict';

const alignAssignments = require('./lib/rules/align-assignments.cjs');

const plugin = {
	meta: {
		name: '@tms/eslint-plugin-align-assignments',
		version: '1.0.1',
		namespace: 'align-assignments'
	},
	configs: {},
	rules: {
		'align-assignments': alignAssignments
	}
};

plugin.configs['flat/recommended'] = {
	name: '@tms/align-assignments/flat/recommended',
	plugins: {
		'align-assignments': plugin
	},
	rules: {
		'align-assignments/align-assignments': 'error'
	}
};

module.exports = plugin;
