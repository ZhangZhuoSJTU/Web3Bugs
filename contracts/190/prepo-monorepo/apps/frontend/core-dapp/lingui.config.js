module.exports = {
  locales: ['en', 'ru'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: 'src/locale/{locale}/messages',
      include: ['src'],
      exclude: ['**/node_modules/**'],
    },
  ],
}