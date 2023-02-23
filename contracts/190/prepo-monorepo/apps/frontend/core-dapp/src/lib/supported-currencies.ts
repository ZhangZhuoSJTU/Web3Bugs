import { Currency } from '../types/currency.types'

export const usdc: Currency = {
  iconName: 'usdc',
  id: 'usdc',
  name: 'USDC',
  sameUsdValue: true,
  storeName: 'baseTokenStore',
}

export const usdt: Currency = {
  iconName: 'usdt',
  id: 'usdt',
  name: 'USDT',
}

export const dai: Currency = {
  iconName: 'dai',
  id: 'dai',
  name: 'DAI',
}

export const weth: Currency = {
  iconName: 'weth',
  id: 'weth',
  name: 'WETH',
}

export const ppo: Currency = {
  iconName: 'ppo-logo',
  id: 'ppo',
  name: 'PPO',
  storeName: 'ppoTokenStore',
}
