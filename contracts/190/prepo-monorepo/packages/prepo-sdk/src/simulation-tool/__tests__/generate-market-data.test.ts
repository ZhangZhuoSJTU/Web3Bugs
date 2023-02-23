import generateMarketData from '../generate-market-data'

test('generateMarketData returns expected output', () => {
  const out = generateMarketData({
    lpDeposit: 1000,
    lowRes: true,
    range: [0.2, 0.8],
  })
  expect(out).toMatchSnapshot()
})
