import { ChainId } from 'prepo-constants'
import * as utils from '../src'
// eslint-disable-next-line jest/no-mocks-import
import mockData from '../__mocks__/utils.mock'

const { getShortAccount, getNetworkByChainId, createFallbackProvider } = utils
const { ethAddress, ethAddressShort, goerliNetwork, fallbackProviderObject } = mockData

// TODO: will need to deep compare the objects in future
describe('prepo-utils', () => {
  it('tests getShortAccount function', () => {
    const shorterAddress = getShortAccount(ethAddress)
    expect(shorterAddress).toEqual(ethAddressShort)
  })
  it('tests getNetworkByChainId function', () => {
    const network = getNetworkByChainId(ChainId.Goerli)
    expect(network.name).toEqual(goerliNetwork.name)
    expect(network.chainId).toEqual(goerliNetwork.chainId)
    expect(network.faucet).toEqual(goerliNetwork.faucet)
    expect(network.blockExplorer).toEqual(goerliNetwork.blockExplorer)
    expect(network.rpcUrls).toEqual(goerliNetwork.rpcUrls)
    expect(network.color).toEqual(goerliNetwork.color)
  })
  it('tests createFallbackProvider function', () => {
    const fallbackProvider = createFallbackProvider(goerliNetwork)
    expect(fallbackProvider._network.name).toEqual(fallbackProviderObject._network.name)
    expect(fallbackProvider._network.ensAddress).toEqual(fallbackProviderObject._network.ensAddress)
    expect(fallbackProvider._network.chainId).toEqual(fallbackProviderObject._network.chainId)
  })
  it('test formatNumber function', () => {
    const number = '123456789'
    const formattedNumber1 = utils.formatNumber(number, { compact: true })
    expect(formattedNumber1).toEqual('123M')
    const formattedNumber2 = utils.formatNumber(number, { usd: true })
    expect(formattedNumber2).toEqual('$123,456,789.00')
    const formattedNumber3 = utils.formatNumber(number, { compact: true, usd: true })
    expect(formattedNumber3).toEqual('$123M')
  })
})
