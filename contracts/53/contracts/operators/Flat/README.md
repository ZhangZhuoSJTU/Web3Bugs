## FlatOperator

We have one main operator called _ZeroExOperator_ and he is responsible for swapping assets with 0x.
However, the users may not want to swap everytime...

For example, the user wants to create a portfolio with 5 DAI and 5 USDC. But if the input is 10 DAI, he can't "swap 5 DAI for 5 DAI" with the _ZeroExOperator_. It makes no sense and will revert.

![image](https://user-images.githubusercontent.com/22816913/137106682-02211ca4-cafd-4dea-a254-c4726e1109f5.png)

To resolve that, we created an operator "doing nothing", the _FlatOperator_.
In fact, we just want to deposit or withdraw without swapping in some cases.

![image](https://user-images.githubusercontent.com/22816913/137106149-217ff4d2-e1df-47ab-b7a4-765d41f48af6.png)

The FlatOperator will do nothing, and return to the factory that "input = output" (for the amount and token address). This way, it "simulates" a deposit (or withdraw in the case of some factory functions).

```javascript
/// @inheritdoc IFlatOperator
function commitAndRevert(
    address own,
    address token,
    uint256 amount
) external payable override returns (uint256[] memory amounts, address[] memory tokens) {
    require(amount > 0, "FlatOperator::commitAndRevert: Amount must be greater than zero");

    amounts = new uint256[](2);
    tokens = new address[](2);

    // Output amounts
    amounts[0] = amount;
    amounts[1] = amount;
    // Output token
    tokens[0] = token;
    tokens[1] = token;
}
```
