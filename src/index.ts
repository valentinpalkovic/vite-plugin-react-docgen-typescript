import { type Plugin, createFilter } from "vite";
import type { Options } from "./utils/options";

const getUtils = async (config: Options) => {
	const docGen = await import("react-docgen-typescript");
	const { default: ts } = await import("typescript");
	const { generateDocgenCodeBlock } = await import("./utils/generate");
	const { getOptions } = await import("./utils/options");

	const { docgenOptions, compilerOptions, generateOptions } =
		getOptions(config);

	const docGenParser = docGen.withCompilerOptions(
		compilerOptions,
		docgenOptions,
	);
	const { exclude = ["**/**.stories.tsx"], include = ["**/**.tsx"] } =
		docgenOptions;
	const filter = createFilter(include, exclude);

	const configFile = ts.findConfigFile(
		process.cwd(),
		ts.sys.fileExists,
		config.tsconfigPath ?? "tsconfig.json",
	);

	if (!configFile) {
		throw new Error(
			"vite-plugin-react-docgen-typescript: tsconfig.json not found in your root. Please provide the path to the tsconfig.json file via tsconfigPath option",
		);
	}
	const createProgram = ts.createAbstractBuilder;

	const host = ts.createWatchCompilerHost(
		configFile,
		{
			...config.compilerOptions,
			noEmit: true,
		},
		ts.sys,
		createProgram,
		// Disable standard diagnostic logging
		() => {},
		// Disable standard watch logging
		() => {},
	);
	const tsWatchProgram = ts.createWatchProgram(host);

	const result = {
		docGenParser,
		filter,
		generateOptions,
		generateDocgenCodeBlock,
		tsProgram: tsWatchProgram.getProgram(),
	};

	return result;
};

export default function reactDocgenTypescript(config: Options = {}): Plugin {
	const utilsPromise = getUtils(config);

	return {
		name: "vite:react-docgen-typescript",
		async transform(src, id) {
			try {
				const {
					filter,
					docGenParser,
					generateOptions,
					generateDocgenCodeBlock,
					tsProgram,
				} = await utilsPromise;

				if (!filter(id)) {
					return;
				}

				const componentDocs = docGenParser.parseWithProgramProvider(id, () =>
					tsProgram.getProgram(),
				);

				if (!componentDocs.length) {
					return null;
				}

				return generateDocgenCodeBlock({
					filename: id,
					source: src,
					componentDocs,
					...generateOptions,
				});
			} catch (e) {
				return src;
			}
		},
	};
}
