/* eslint-disable @typescript-eslint/explicit-function-return-type */

const BLOG_URL = 'https://prepo-blog-private.vercel.app'

module.exports = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: `/:path*`,
      },
      {
        source: '/blog',
        destination: `${BLOG_URL}`,
      },
      {
        source: '/blog/:path*',
        destination: `${BLOG_URL}/:path*`,
      },
      {
        source: '/bear.js',
        destination: 'https://cdn.panelbear.com/analytics.js',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/:path*/amp',
        has: [
          {
            type: 'host',
            value: 'blogtest.prepo.io',
          },
        ],
        destination: 'https://prepo.io/blog/:path*',
        permanent: false,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'blogtest.prepo.io',
          },
        ],
        destination: 'https://prepo.io/blog/:path*',
        permanent: false,
      },
      {
        source: '/:path*/amp',
        has: [
          {
            type: 'host',
            value: 'blog.prepo.io',
          },
        ],
        destination: 'https://prepo.io/blog/:path*',
        permanent: false,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'blog.prepo.io',
          },
        ],
        destination: 'https://prepo.io/blog/:path*',
        permanent: false,
      },
    ]
  },
}
