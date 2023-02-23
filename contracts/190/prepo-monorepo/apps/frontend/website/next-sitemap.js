const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://prepo.io')
const blogSitemapUrl = new URL('/blog/sitemap-index.xml', siteUrl).href

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  robotsTxtOptions: {
    additionalSitemaps: [blogSitemapUrl],
  },
}
