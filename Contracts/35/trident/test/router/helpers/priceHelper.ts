import { getRandom } from "./randomHelper";

const MIN_TOKEN_PRICE = 1e-6
const MAX_TOKEN_PRICE = 1e6
  
export function getTokenPrice(rnd: () => number) {
    const price = getRandom(rnd, MIN_TOKEN_PRICE, MAX_TOKEN_PRICE)
    return price
}