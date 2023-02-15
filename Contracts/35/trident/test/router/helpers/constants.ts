export const MIN_POOL_RESERVE = 1e9;
export const MAX_POOL_RESERVE = 1e23;
export const MIN_POOL_IMBALANCE = 1 / (1 + 1e-3);
export const MAX_POOL_IMBALANCE = 1 + 1e-3;

export enum RouteType {
    SinglePool = "SinglePool",
    SinglePath = "SinglePath",
    ComplexPath = "ComplexPath"
}