import { defineConfig, type HeadConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Agentflow',
  titleTemplate: ':title ⋮ Agentflow',
  description: 'Powerfully simple AI agent framework.',
  lang: 'en-GB',

  head: [
    ['link', { rel: 'icon', href: '/images/logo.webp' }],
    ['script', { src: 'https://plausible.io/js/script.js', defer: '', 'data-domain': 'agentflow.2point0.ai' }],
  ],

  transformHead: ({ page, pageData, siteData }) => {
    const head: HeadConfig[] = []
    const isHome = page === 'index.md'
    const hasImage = !!pageData.frontmatter.image
    const baseUrl = 'https://agentflow.2point0.ai'
    const pageUrl = baseUrl + '/' + page.replace(/\.md$/, '.html').replace(/index\.html$/, '')
    const imageUrl = hasImage ? baseUrl + pageData.frontmatter.image : undefined

    head.push(['meta', { property: 'og:type', content: isHome ? 'website' : 'article' }])
    head.push(['meta', { property: 'og:title', content: pageData.title }])
    head.push(['meta', { property: 'og:description', content: pageData.description }])
    if (imageUrl) head.push(['meta', { property: 'og:image', content: imageUrl }])
    head.push(['meta', { property: 'twitter:card', content: hasImage ? 'summary_large_image' : 'summary' }])
    head.push(['meta', { property: 'twitter:url', content: pageUrl }])
    head.push(['meta', { property: 'twitter:title', content: pageData.title }])
    head.push(['meta', { property: 'twitter:description', content: pageData.description }])
    if (imageUrl) head.push(['meta', { property: 'twitter:image', content: imageUrl }])

    return head
  },

  // https://vitepress.dev/reference/default-theme-config
  themeConfig: {
    logo: {
      src: '/images/logo.webp',
      alt: 'Agentflow'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      /*{ text: 'Examples', link: '/examples/markdown-examples' },*/
      { text: '2point0.ai', link: 'https://2point0.ai' },
    ],

    sidebar: {
      '/guide': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Agentflow?', link: '/guide/what-is-agentflow' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ]
        },
        {
          text: 'Writing workflows',
          items: [
            { text: 'Workflow structure', link: '/guide/workflow-structure' },
            { text: 'Input data', link: '/guide/input-data' },
            { text: 'AI generations', link: '/guide/ai-generations' },
            { text: 'Control flow', link: '/guide/control-flow' },
          ]
        },
        {
          text: 'Using Agentflow',
          items: [
            { text: 'CLI', link: '/guide/cli' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'JavaScript API', link: '/guide/javascript-api' },
          ]
        },
        /*
        todo - add advanced documentation
        {
          text: 'Advanced',
          items: [
            { text: 'Custom actions', link: '/guide/custom-actions' },
            { text: 'Custom tools', link: '/guide/custom-tools' },
          ]
        }
        */
      ],

      '/examples': [
        // todo
      ]
    },

    editLink: {
      pattern: 'https://github.com/lebunrel/agentflow/edit/main/docs/:path'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/lebrunel/agentflow' }
    ],

    footer: {
      message: 'Released under the Apache-2.0 License.',
      copyright: 'Copyright © 2024 Push Code Ltd'
    }
  },


})
