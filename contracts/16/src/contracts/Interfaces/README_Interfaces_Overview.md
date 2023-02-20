**<center>Interfaces - Introduction:</center>**
Interfaces are a description or general overview  of how a contract should be implemented. They describe the functions 
that should be implemented  in a contract without specifying  the exact implementation or how these functions would/should work. 

**General Example:**  
IDice.sol might describe that a dice contract would need a roll() function that takes an integer as an argument and returns an integer 
but it would not specify the mechanism of the function itself. 

i.e:
```
interface IDice {

    function roll(int256 nonce) external returns (int256);
}
```

**Specific Example:**  
  In ITracerPerpetualSwaps.sol: 
  ```
function takeOrder(OrderLib.Order calldata order, uint256 amount) external;
```

**<center>Interfaces:</center>**


**IAccount.sol (needs editing):**   
IAccount.sol is an interface  that describes the functions that an Account contract should implement.     
==> The specific implementation of this interface as a contract can be found in Account.sol   
**Explanation:** The account contract handles functionality allowing users to deposit/withdraw from tracer margin accounts, settling of said Tracer accounts, handles liquedation events and updates accounts in accordance of these events.

**IPricing.sol:**  
IPricing.sol is an inteface that describes the functions that a Pricing contract should implement.   
=> The specific implementation of this interface as a contract can be found in Pricing.sol   
**Explanation:** A Pricing contract handles all of the updating, storage allocation and retrieval of values related to the value of a Tracer (e.g. funding rate or Tracer price)

**IPerpsDeployer.sol:**  
IPerpsDeployer.sol is an interface that describes the functions that a Deployer contract should implement.   
=>The specific implementation of this interface as a contract can be found in DeployerV1.sol   
**Explanation:** A deployer contract facilitates the deployment of Tracers

**IGov.sol:**  
IGov.sol is an interface that describes the functions that a Gov (governance) contract should implement.   
=>The specific implementation of this interface as a contract can be found in Gov.sol   
**Explanation:** A governance contract handles the status governance/ownership tokens, proposals and voting 

**IInsurance.sol:**  
IInsurance.sol is an interface that describes the functions that an Insurance contract should implement.   
=>The specific implementation of this interface as a contract can be found in Insurance.sol   
**Explanation:** An insurance contract handles the Insurance Pool token, withdrawing/staking into a specific tracer’s insurance pool and deploying insurance pools for new tracers 
=> The Insurance Pool Token implementation can be found in InsurancePoolToken.sol 

**IOracle.sol**   
IOracle.sol is an interface that describes the functions that a Gov (governance) contract should implement.   
=>The specific implementation of this interface as a contract can be found in Oracle.sol (this is an example of a Tracer oracle)     
=>The specific implementation of this interface as a contract can be found in GasOracle.sol (An example an oracle that references Chainlink fast gas price and ETH/USD price to get a gas cost in $USD)  
**Explanation:** This interface described the minimum functionality that a Tracer/Gas Oracle need to have. Each oracle can have different implementations (although they must conform to IOracle.sol), the Oracle must be community approved. Chainlink reference data contracts currently conform to the IOracle specification (as of 04/11/2020) and as such Chainlink data contracts can be used as the oracle implementation. 

**IReceipt.sol**   
IReceipt.sol is an interface that describes the functions that a Receipt contract should implement.   
=>The specific implementation of this interface as a contract can be found in Receipt.sol   
**Explanation:** The receipt contract handles the creation of liquidation  receipts and retrieval  of funds entitled to entities who facilitate a complete and successful liquidation ; 

**ITracerPerpetualSwaps.sol**   
ITracerPerpetualSwaps.sol is an interface that describes the functions that a Tracer contract should implement.   
=>The specific implementation of this interface as a contract can be found in TracerV2.sol   
**Explanation:** The tracer contract handles the deployment  of tracer markets, creation and filling of market orders, settlement of accounts and updating the pricing values of the Tracer (via a pricing contract (e.g. Pricing.sol)). 
The Tracer contract also contains governance functions that allows the contract owner to transfer ownership of a Tracer, change/set the pricing oracles and manipulate the fee system. 

**ITracerPerpetualsFactory.sol**   
ITracerPerpetualsFactory.sol is an interface that describes the functions that a TracerFactory contract should implement.    
=>An example can be found in Pricing.sol:20 where a fundingRate struct is used in a mapping
**Explanation:** The Perpetual Swaps Factory contract collates Tracer perpetual swap markets so they can be validated as valid tracers. Third parties may propose their Tracer market become part of the factory. 

**Types.sol**   
Types.sol is an interface that describes the nature of the structs used within the project.  
=>The specific implementation of this interface as a contract can be found in TracerV2.sol     


i.e.  
In Type.sol
```

interface Types {
struct FundingRate {
        uint256 recordTime;
        int256 recordPrice;
        int256 fundingRate; //positive value = longs pay shorts
        int256 fundingRateValue; //previous rate + (time diff * price * rate)
    }
}
```
In Pricing.sol, Line 20:
```
 mapping(address => mapping(uint256 => Types.FundingRate)) public fundingRates;
 ```




























