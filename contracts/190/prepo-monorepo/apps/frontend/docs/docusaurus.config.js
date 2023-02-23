const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')
const math = require('remark-math')
const katex = require('rehype-katex')

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'prePO Docs',
  tagline: 'Learn everything there is to know about prePO',
  url: 'https://docs.prepo.io/',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'prepo-io', // Usually your GitHub org/user name.
  projectName: 'prepo-docs', // Usually your repo name.
  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        docsRouteBasePath: '/',
        indexBlog: false,
      },
    ],
  ],
  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars/index.js'),
          editUrl: 'https://github.com/prepo-io/prepo-monorepo/tree/main/apps/frontend/docs',
          // KaTeX
          remarkPlugins: [math],
          rehypePlugins: [katex],
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
      },
      announcementBar: {
        id: 'announcement',
        content: '🚧 All information is a <b>work in progress</b> and <b>subject to change</b> 🚧',
        backgroundColor: '#adaeeb',
        textColor: '#091E42',
        isCloseable: true,
      },
      navbar: {
        title: 'prePO Docs',
        logo: {
          alt: 'prePO Logo',
          src: 'img/logo-dark.png',
          srcDark: 'img/logo-light.png',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Home',
          },
          {
            type: 'doc',
            docId: 'developer/core-contracts',
            position: 'left',
            label: 'Developer Docs',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Home',
                to: '/',
              },
              {
                label: 'Developer Docs',
                to: '/developer/core-contracts',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://url.prepo.io/discord-docs',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/prepo_io',
              },
            ],
          },
          {
            title: 'Apps',
            items: [
              {
                label: 'Testnet',
                href: 'https://app.prepo.io/',
              },
              {
                label: 'Simulator',
                href: 'https://simulator.prepo.io/',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Jobs',
                href: 'https://apply.workable.com/prepo/',
              },
              {
                label: 'Website',
                href: 'https://www.prepo.io/',
              },
              {
                label: 'Blog',
                href: 'https://medium.com/prepo',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/prepo-io',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} prePO`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['solidity'],
      },
    }),
  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css',
      integrity: 'sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc',
      crossorigin: 'anonymous',
    },
  ],
  scripts: ['/bear.js?site=KdPR54pbOMF', './scripts/panelbear.js'],
}
