const siteUrl = 'https://app.prepo.io/'

module.exports = {
  siteUrl: process.env.SITE_URL ?? siteUrl,
  generateRobotsTxt: true,
}
