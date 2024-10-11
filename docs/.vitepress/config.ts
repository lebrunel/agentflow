import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Agentflow',
  titleTemplate: ':title ⋮ Agentflow',
  description: 'Agentflow is a low-code framework for creating and executing AI-powered workflows using Markdown and natural language.',

  head: [
    ['link', { rel: 'icon', href: '/logo.webp' }]
  ],

  // https://vitepress.dev/reference/default-theme-config
  themeConfig: {
    logo: {
      src: '/logo.webp',
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
            { text: 'JavaScript SDK', link: '/guide/javascript-sdk' },
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
    ]
  },


})
