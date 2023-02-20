# Coverage Notes

- Free collateral needs more work, coverage evaluation is not correct due to delegate call
- settle assets needs to be more deterministic to catch all edge cases
- settle bitmap does not test remap bitmap
- account context store context, test bitmap
- bitmap assets other methods
- portfolio handler more branches

### Invariants

- System wide cash balances should be accounted for in a market or a stored cash balance
- Sum of capital deposit should equal currency balance
- Sum of perpetual token balances should equal total supply

- System wide fCash of same maturity should net off to zero
- System wide liquidity tokens should be accounted for in markets

- Account context hasDebt must reconcile
- Account context active currencies must be set properly
- Account context next maturing asset
- Account context last mint time
- If has bitmap, ifCash asset map must reconcile
