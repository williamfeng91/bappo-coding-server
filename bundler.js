const { dirname, isAbsolute, resolve } = require('path');
const { rollup } = require('rollup');
const babel = require('rollup-plugin-babel');
const nodeResolve = require('rollup-plugin-node-resolve');

module.exports = function bundler(appId, files) {
  const options = {
    entry: 'index.js',
    format: 'iife',
    moduleName: `app${appId}`,
    sourceMap: true,
    external: ['react', 'styled-components', 'bappo-components'],
    globals: {
      react: 'React',
      'styled-components': 'StyledComponents',
      'bappo-components': 'BappoComponents',
    },
  };

  const moduleById = files.reduce((dict, file) => {
    const absolutePath = resolve(file.dir, file.base);
    return Object.assign(dict, {
      [absolutePath]: Object.assign({}, file, { absolutePath }),
    });
  }, {});

  const addJsExtensionIfNecessary = (path) => {
    if (moduleById[path]) return path;
    if (moduleById[`${path}.js`]) return `${path}.js`;
  };
  const customPlugin = {
    resolveId(importee, importer) {
      // absolute paths are left untouched
      if (isAbsolute(importee)) return addJsExtensionIfNecessary(resolve(importee));

      // if this is the entry point, resolve agains root
      if (importer === undefined) return addJsExtensionIfNecessary(resolve('/', importee));

      // external modules are skipped at this stage
      if (importee[0] !== '.') return null;

      return addJsExtensionIfNecessary(resolve(dirname(importer), importee));
    },
    load(id) {
      return moduleById[id].content;
    },
  };

  options.plugins = [
    babel({
      babelrc: false,
      presets: [
        [require('babel-preset-es2015').buildPreset, { modules: false }],
        require('babel-preset-react'),
      ],
      plugins: [require('babel-plugin-external-helpers')],
    }),
    customPlugin,
  ];

  return rollup(options)
    .then((bundle) => {
      return bundle.generate(options);
    });
}
