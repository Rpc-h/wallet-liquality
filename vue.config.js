const path = require('path')

module.exports = {
  lintOnSave: false,
  productionSourceMap: false,
  configureWebpack: {
    devtool: 'source-map',
    entry: {
      background: './src/background.js'
    }
  },
  css: {
    loaderOptions: {
      sass: {
        prependData: '@import "@/assets/scss/_vars.scss";'
      }
    }
  },

  chainWebpack: (config) => {
    config.resolve.alias.set('vue', path.resolve('./node_modules/vue'))
    config.resolve.alias.set('vuex', path.resolve('./node_modules/vuex'))

    const svgRule = config.module.rule('svg')

    svgRule.uses.clear()

    svgRule
      .oneOf('inline')
      .resourceQuery(/inline/)
      .use('svg-url-loader')
      .loader('svg-url-loader')
      .end()
      .end()
      .oneOf('external')
      .use('babel-loader')
      .loader('babel-loader')
      .end()
      .use('vue-svg-loader')
      .loader('vue-svg-loader')
      .options({
        svgo: {
          plugins: [{ removeViewBox: false }, { removeDimensions: true }]
        }
      })
  },

  pluginOptions: {
    // browserExtension: {
    //   componentOptions: {
    //     background: {
    //       entry: 'src/background.js'
    //     },
    //     contentScripts: {
    //       entries: {
    //         'content-script': ['src/contentScript.js']
    //       }
    //     }
    //   },
    //   manifestTransformer: (manifest) => {
    //     manifest.externally_connectable = {
    //       matches: [`${process.env.VUE_APP_LEDGER_BRIDGE_URL}/*`]
    //     }
    //     return manifest
    //   }
    // }
  },

  pages: {
    popup: {
      template: 'public/index.html',
      entry: './src/main.js',
      title: 'Liquality Wallet'
    },
    standalone: {
      template: 'public/index.html',
      entry: './src/main.js',
      title: 'Liquality Wallet',
      filename: 'index.html'
    }
  }
}
