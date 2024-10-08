import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AgentFlow",
  description: "AgentFlow is a low-code framework for creating and executing AI-powered workflows using Markdown and natural language.",

  // https://vitepress.dev/reference/default-theme-config
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Examples', link: '/examples/markdown-examples' },
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
            { text: 'Your first workflow', link: '/guide/your-first-workflow' },
            { text: 'AI generations', link: '/guide/ai-generations' },
            { text: 'Looping & conditionals', link: '/guide/looping-conditionals' },
            { text: 'Using tools', link: '/guide/using-tools' },
          ]
        },
        {
          text: 'Using Agentflow',
          items: [
            { text: 'CLI', link: '/guide/cli' },
            { text: 'JavaScript SDK', link: '/guide/javascript-sdk' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Custom actions', link: '/guide/custom-actions' },
            { text: 'Custom tools', link: '/guide/custom-tools' },
          ]
        }
      ],

      '/examples': [
        {
          text: 'Examples',
          items: [
            { text: 'Markdown Examples', link: '/examples/markdown-examples' },
            { text: 'Runtime API Examples', link: '/examples/api-examples' }
          ]
        }
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
