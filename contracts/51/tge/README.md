# Vether - A strictly-scarce ethereum-based asset

## Smart Contract

The Vether smart contracts implements the [Vether whitepaper](https://bitcointalk.org/index.php?topic=5243406) announced on 25 April 2020. 

### Mainet
Vether1: 0x31Bb711de2e457066c6281f231fb473FC5c2afd3
Vether2: 0x01217729940055011F17BeFE6270e6E59B7d0337
Vether3: 0x75572098dc462F976127f59F8c97dFa291f81d8b
Vether4: 0x4ba6ddd7b89ed838fed25d208d4f644106e34279


### Rinkeby-Slow: 
Vether1: 0x4257e8a2052aFE4E7a52ee9233139EB28FB4BF44
Vether2:
Vether3:

### Rinkeby-Fast-1
Vether1: 0x8DC8b4D13D858367ceC17fF144ea2bcf718ff8C6
Vether2: 0xfEcb4Bf376067B273Ae1f9DA25252Fce3D7D041f
Vether3: 

### Rinkeby-Fast-2
Vether1: 0x3aaC4384E118388076C7E4085f39d364781D8604
Vether2: 0x53753Efb66b420fE461263E190fBb45F40bA1f79
Vether3: 0x68BDD33B0185b3Bf97Da0DEeC0f6d8EF2525193F

### Other
VetherNew : 0xc3e934cc79d0eE0FE7BE206914A9e5E5f87192B4
Uniswap V2: 0x0b487517c8c5cae9C7d28D3099907130a6cCB40E

GasMine
https://etherscan.io/address/0x8a9c1cd4074751e94f2c4075d333fb3226ca9378


### ERC-20
Vether is an ERC-20 contract that implements the following interface:
```Solidity
interface ERC20 {
    function totalSupply() external view returns (uint);
    function balanceOf(address account) external view returns (uint);
    function transfer(address, uint) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint);
    function approve(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
    }
```

### UniSwap Factory and Exchange
Vether uses the UniSwap Factory and Exchange contracts to enable swapping tokens for Ether at market prices:

```Solidity
// Uniswap Factory Interface
interface UniswapFactory {
    function getExchange(address token) external view returns (address exchange);
    }
// Uniswap Exchange Interface
interface UniswapExchange {
    function tokenToEthTransferInput(uint tokens_sold,uint min_eth,uint deadline, address recipient) external returns (uint  eth_bought);
    }
```

### Vether Public Get Methods
The following public getters are available to query:
```Solidity
// Public Parameters
uint coin; uint public emission;
uint public currentEra; uint public currentDay;
uint public daysPerEra; uint public secondsPerDay;
uint public genesis; uint public nextEraTime; uint public nextDayTime;
address payable public burnAddress;
address public registryAddress;
uint public totalFees; uint public totalBurnt;

// Public Mappings
mapping(uint=>uint) public mapEra_Emission;
mapping(uint=>mapping(uint=>uint)) public mapEraDay_Units;
mapping(uint=>mapping(uint=>uint)) public mapEraDay_UnitsRemaining;
mapping(uint=>mapping(uint=>uint)) public mapEraDay_Emission;
mapping(uint=>mapping(uint=>uint)) public mapEraDay_EmissionRemaining;
mapping(uint=>mapping(uint=>mapping(address=>uint))) public mapEraDay_MemberUnits;
mapping(address=>mapping(uint=>uint[])) public mapMemberEra_Days; 
mapping(address=>bool) public mapAddress_Excluded;

// Public Get Functions
function getExchange(address token ) public view returns (address)
function getDaysContributedForEra(address member, uint era) public view returns(uint days)
function getEmissionShare(uint era, uint day, address member) public view returns (uint emissionShare)
function getNextEraEmission() public view returns (uint)
function getDayEmission() public view returns (uint)
```

### Vether Public Transactions
The following public transaction functions are available to call:
```Solidity
receive() external payable
function burnEtherForMember(address member) external payable
function burnTokens(address token, uint amount) external
function burnTokensForMember(address token, uint amount, address member) external 
function addExcluded(address excuded) external
function withdrawShare(uint era, uint day) external 
function withdrawShareForMember(uint era, uint day, address member) external
```

### Constructor
There are three constructor options:

**Local**

This allows efficient testing locally, with `secondsPerDay=1`. 
Note: `6_shares.js` should be run individually `secondsPerDay=2`. 

```Solidity
//local
name = "Vether"; symbol = "VETH"; decimals = 18; totalSupply = 8190;
emission = 2048; currentEra = 1; currentDay = 1;                                    // Set emission, era and day
genesis = now; daysPerEra = 2; secondsPerDay = 1;                                   // Set genesis time
burnAddress = address(0);
```

**Rinkeby Testnet**

This allows the contract to be deployed to Rinkeby. It has a lifecycle of 5 days 

```Solidity
//testnet
name = "Vether"; symbol = "VETH"; decimals = 18; 
coin = 1*10**decimals; totalSupply = 1000000*coin;                                  // Set Supply
emission = 2048*coin*; currentEra = 1; currentDay = 1;                              // Set emission, era and day
genesis = now; daysPerEra = 4; secondsPerDay = 10000;                               // Set genesis time
burnAddress = 0x0111011001100001011011000111010101100101;                           // Set Burn Address
registryAddresss = 0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36;                      // Set UniSwap V1 Rinkeby
```

**Mainnet**

This is the constructor deployed to mainnet:

```Solidity
//mainnet
name = "Vether"; symbol = "VETH"; decimals = 18; 
coin = 1*10**decimals; totalSupply = 1000000*coin;                                  // Set Supply
emission = 2048*coin; currentEra = 1; currentDay = 1;                               // Set emission, Era and Day
genesis = now; daysPerEra = 244; secondsPerDay = 84200;                             // Set genesis time
burnAddress = 0x0111011001100001011011000111010101100101;                           // Set Burn Address
registryAddress = 0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95;                       // Set UniSwap V1 Mainnet

```

## Testing - Buidler

The test suite uses [Buidler](https://buidler.dev/) as the preferred testing suite, since it compiles and tests faster. 
The test suite implements 7 routines that can be tested individually.

```
npx buidler compile
```

Execute all at once:
```
npx builder test
```

Or execute individually:
```
npx builder test/1_coin.js
```

## Testing - Truffle
 Truffle testing can also be done:

```
truffle compile && truffle migrate --reset
```

Execute all at once:
```
truffle test
```

Or execute individually:
```
truffle test test/1_coin.js
```

## Analysis

Find in [/analysis](https://github.com/vetherasset/vether-contracts/blob/master/analysis)
```
yarn analysis
```

### [Vether Function Graph](https://github.com/vetherasset/vether-contracts/blob/master/analysis/Vether-Graph.png)
```
surya graph contracts/Vether.sol | dot -Tpng > analysis/Vether-Graph.png
```

### [Dependency Graph](https://github.com/vetherasset/vether-contracts/blob/master/analysis/Vether-Inheritance.png)
```
surya inheritance contracts/Vether.sol | dot -Tpng > analysis/Vether-Inheritance.png
```

### [Description Report](https://github.com/vetherasset/vether-contracts/blob/master/analysis/Vether-Report.md)
```
surya mdreport analysis/Vether-Report.md contracts/Vether.sol
```

### [Describe - Raw](https://github.com/vetherasset/vether-contracts/blob/master/analysis/Vether-Describe.md)
```
surya describe contracts/Vether.sol
```

Parse
```
surya parse contracts/Vether.sol
```




