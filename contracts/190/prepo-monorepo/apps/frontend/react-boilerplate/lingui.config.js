module.exports = {
  locales: ['en', 'es'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: 'src/locale/{locale}/messages',
      include: ['src'],
      exclude: ['**/node_modules/**'],
    },
  ],
}
