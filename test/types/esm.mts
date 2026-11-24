/**
 * ESM の既定の import でプラグインを読み込んだとき、ルールの型が取れるかを tsc で確かめる
 * 実行はせず、型の検査だけに使う
 * @file
 */
import PLUGIN from '../../index.cjs';

/** プラグインから取り出した整列ルール。型が付くかだけを見る */
const RULE = PLUGIN.rules?.['align-assignments'];

void RULE;
