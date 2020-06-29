import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/SMention.svelte',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'SMention',
		file: 'docs/SMention.js'
	},
	plugins: [
		svelte({
			dev: !production,
			css: css => {
				css.write('docs/SMention.css');
			}
		}),
		resolve(),
		commonjs(),
		production && terser()
	]
};
