/**
 * index.cjs が公開するプラグインの型を、TypeScript の利用者へ伝える
 * 実体は持たず、ESLint のプラグインの型として宣言するだけ
 * @file
 */
import type { ESLint } from 'eslint';

/** index.cjs が module.exports に入れるプラグイン */
declare const PLUGIN: ESLint.Plugin;

export = PLUGIN;
