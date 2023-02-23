import { dai, ppo, usdc, usdt, weth } from '../lib/supported-currencies'

export const altCoins = [weth, ppo] as const
export const altCoinsMap = { weth, ppo }

export const stableCoins = [usdc, usdt, dai]
export const stableCoinsMap = {
  usdc,
  usdt,
  dai,
}

export const allCoins = [...stableCoins, ...altCoins]
