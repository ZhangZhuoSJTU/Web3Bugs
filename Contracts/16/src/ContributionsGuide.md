# Tracer Contribution Guide

Any pull request (PR) should be atomic i.e. it only changes one feature. One PR can change multiple functions across multiple files, but should only have one functionality/feature changed. This allows for easier reviewing and improved modularity.

As an exception, it is encouraged that any minor style or commenting fixes be added to your PR.

Branches should be named in a way that gives a quick overview of the thing that is changed. For example, if you are changing how the funding rate is stored, a good branch name would be `Funding-Rate-storing`.

### Testing

Modify and/or create a unit test for the code you have modified or changed. If it is a change that changes the values/calculations of particular variables/systems include a description of your change in the PR's description, showing how you came to the values you are testing for.

i.e. If you proposed a new formula for `fairPrice` that is more accurate, justify your change and show that your code produces the correct result. (So if your change changed the “correct result” for `fairPrice` from 10000 to 10356 in a particular test, show your working to get to the 10356 value. 

This explanation of how you got to your value (as above) should also be commented in appropriately stepwise/linewise into your test code. 

### Commenting
##### NatSpec Comments
All functions should follow [the official Solidity style guide for NatSpec comments](https://docs.soliditylang.org/en/latest/style-guide.html#natspec).

Example:
```
   /**
    * @notice Places an on chain order, fillable by any part on chain
    * @dev Passes data to permissionedMakeOrder.
    * @param amount The amount of Tracers to buy
    * @param price The price at which someone can purchase (or "fill") 1 tracer of this order
    * @param side The side of the order. True for long, false for short.
    * @param expiration The expiry time for this order
    * @return (orderCounter - 1)
    */
    function makeOrder(
       uint256 amount,
       int256 price,
       bool side,
       uint256 expiration
   ) public override returns (uint256) {
       return permissionedMakeOrder(amount, price, side, expiration, msg.sender);
   }
```

In addition, as above, there should be a `@param` docstring for each input parameter with an explanation of what the variable is and where it comes from.
