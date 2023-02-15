pragma solidity ^0.5.11;

import "./LivepeerToken.sol";

interface IL1GatewayRouter {
    function setGateway(
        address _gateway,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost,
        address _creditBackAddress
    ) external payable;
}

// Based off of https://github.com/OffchainLabs/arbitrum/blob/master/packages/arb-bridge-peripherals/contracts/tokenbridge/test/TestCustomTokenL1.sol
// TESTNET ONLY
contract ArbitrumLivepeerToken is LivepeerToken {
    address public routerAdmin;
    address public router;

    bool private shouldRegisterGateway;

    modifier onlyRouterAdmin() {
        require(msg.sender == routerAdmin, "NOT_ROUTER_ADMIN");
        _;
    }

    constructor(address _router) public {
        router = _router;
        routerAdmin = msg.sender;
    }

    function setRouterAdmin(address _routerAdmin) external onlyRouterAdmin {
        routerAdmin = _routerAdmin;
    }

    function registerGatewayWithRouter(
        address _gateway,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        uint256 _maxSubmissionCost,
        address _creditBackAddress
    ) external payable onlyRouterAdmin {
        // we temporarily set `shouldRegisterGateway` to true for the callback in setGateway() to succeed
        bool prev = shouldRegisterGateway;
        shouldRegisterGateway = true;

        IL1GatewayRouter(router).setGateway.value(msg.value)(
            _gateway,
            _maxGas,
            _gasPriceBid,
            _maxSubmissionCost,
            _creditBackAddress
        );

        shouldRegisterGateway = prev;
    }

    function isArbitrumEnabled() external view returns (uint8) {
        require(shouldRegisterGateway, "NOT_EXPECTED_CALL");
        return uint8(0xa4b1);
    }
}
