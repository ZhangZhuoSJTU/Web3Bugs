export enum FilterType {
  Opened = 'Opened',
  Closed = 'Closed',
  Withdrawn = 'Withdrawn',
  Deposited = 'Deposited',
}

export const portfolioHistoryFilterTypes: FilterType[] = [
  FilterType.Opened,
  FilterType.Closed,
  FilterType.Deposited,
  FilterType.Withdrawn,
]
