const svelte = require('svelte/compiler');
const fs = require('fs');
const path = require('path');

async function buildSvelteConfig(config, pluginOptions) {
  let compilerOptions;
  let preprocessors;
  const userSvelteConfigLoc = path.join(process.cwd(), 'svelte.config.js');
  if (fs.existsSync(userSvelteConfigLoc)) {
    let userSvelteConfig = require(userSvelteConfigLoc);
    userSvelteConfig = userSvelteConfig.snowpack || userSvelteConfig;
    const { preprocess, ..._svelteOptions } = typeof userSvelteConfig === 'function' ? await userSvelteConfig() : userSvelteConfig;
    preprocessors = preprocess;
    compilerOptions = _svelteOptions;
  }

  compilerOptions = {
    ...compilerOptions,
    ...pluginOptions,
  };

  return {
    compilerOptions,
    preprocessors,
  };
}

module.exports = function plugin(config, pluginOptions) {
  const buildConfigPromise = buildSvelteConfig(config, pluginOptions);
  return {
    defaultBuildScript: 'build:svelte,svx',
    knownEntrypoints: ['svelte/internal'],
    async build({ contents, filePath }) {
      const svelteConfig = await buildConfigPromise;
      const { compilerOptions, preprocessors } = svelteConfig;
      let codeToCompile = contents;
      // PRE-PROCESS
      if (preprocessors) {
        try {
          codeToCompile = (
            await svelte.preprocess(codeToCompile, preprocessors, {
              filename: filePath,
            })
          ).code;
        } catch (e) {
          console.error(`failed to preprocess ${filePath}`, e);
          throw e;
        }
      }
      // COMPILE
      try {
        const { js, css } = svelte.compile(codeToCompile, {
          ...compilerOptions,
          filename: filePath,
        });
        const result = { result: js && js.code };
        if (!compilerOptions.css) {
          result.resources = { css: css && css.code };
        }
        return result;
      } catch (e) {
        console.error(`failed to compile ${filePath}`, e);
        throw e;
      }
    },
  };
};