// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import 'forge-std/Test.sol';

import '../Constants.sol';
import '../ProtocolFeeCollector.sol';

import '../roles/Admin.sol';
import '../roles/User.sol';

contract StrategyRegistryTests is Test {
    using SafeMath for uint256;

    // Logic implementation contract addresses
    address public savingsAccountAddress;
    address public strategyRegistryAddress;
    address public noYieldAddress;
    address public extraYieldAddress;
    address public extraYieldAddress1;
    address public compoundYieldAddress;
    address public protocolFeeCollectorAddress;

    // Admins for deployements
    Admin public admin;
    Admin public fakeAdmin;

    // Extra actors
    User public borrower;
    User public lender;
    User public liquidator;

    function setUp() public {
        // setting admin addresses
        admin = new Admin();
        fakeAdmin = new Admin();

        // setting extra actors
        borrower = new User();
        lender = new User();
        liquidator = new User();

        // deploying  mock protocol fee collector
        protocolFeeCollectorAddress = address(new ProtocolFeeCollector());
        // deploying strategy registry contract
        strategyRegistryAddress = admin.deployStrategyRegistry(Constants.maxStrategies);
        // deploying savings account contract
        savingsAccountAddress = admin.deploySavingsAccount(strategyRegistryAddress);

        // deploying yield contracts
        noYieldAddress = admin.deployNoYield(address(admin), savingsAccountAddress, protocolFeeCollectorAddress);
        extraYieldAddress = admin.deployNoYield(address(admin), savingsAccountAddress, protocolFeeCollectorAddress);
        extraYieldAddress1 = admin.deployNoYield(address(admin), savingsAccountAddress, protocolFeeCollectorAddress);

        //----------------------- Deployment code end -----------------------//
    }

    // Events
    event StrategyAdded(address indexed strategy);
    event StrategyRemoved(address indexed strategy);
    event MaxStrategiesUpdated(uint256 maxStrategies);

    //----------------------- Strategy Registry updateMaxStrategies, failing tests-----------------------//

    // Updating max strategies to zero should fail
    function test_updateMaxStrategies_zero() public {
        try admin.updateMaxStrategies(strategyRegistryAddress, 0) {
            revert('Updating max strategies to zero should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:IUMS1');
        }
    }

    // Updating max strategies by inalid owner should fail
    function test_updateMaxStrategies_invalidOwner() public {
        try fakeAdmin.updateMaxStrategies(strategyRegistryAddress, 7) {
            revert('Updating max strategies by inalid owner should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Strategy Registry updateMaxStrategies, passing tests-----------------------//

    // Updating maximum strategies should pass
    function test_updateMaxStrategies(uint256 _maxStrategies) public {
        if (_maxStrategies == 0) {
            return;
        }
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        vm.expectEmit(true, true, false, true);
        emit MaxStrategiesUpdated(_maxStrategies);
        admin.updateMaxStrategies(strategyRegistryAddress, _maxStrategies);
        assertEq(_strategyRegistry.maxStrategies(), _maxStrategies);
    }

    //----------------------- Strategy Registry addStrategy, failing tests-----------------------//

    // Adding strategies more than max strategy should fail
    function test_addStrategy_excessStrategies() public {
        admin.updateMaxStrategies(strategyRegistryAddress, 1);

        admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress);
        try admin.addSavingsAccountStrategy(strategyRegistryAddress, extraYieldAddress) {
            revert('Adding strategies more than max strategies should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:AS1');
        }
    }

    // Adding existing strategy should fail
    function test_addStrategy_existingStrategy() public {
        admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress);
        try admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress) {
            revert('Adding existing strategy should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:AS2');
        }
    }

    // Adding zero address strategy should fail
    function test_addStrategy_zeroAddress() public {
        try admin.addSavingsAccountStrategy(strategyRegistryAddress, address(0)) {
            revert('Adding zero address strategy should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:AS3');
        }
    }

    // Adding new strategy by invalid owner should fail
    function test_addStrategy_invalidOwner() public {
        try fakeAdmin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress) {
            revert('Adding new strategy by invalid owner should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Strategy Registry addStrategy, passing tests-----------------------//

    // Adding new strategies should pass
    function test_addStrategy() public {
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Adding new strategy
        vm.expectEmit(true, true, false, true);
        emit StrategyAdded(noYieldAddress);
        admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress);

        // new strategy checks
        assertEq(_strategyRegistry.registry(noYieldAddress), 1);
        assertEq(_strategyRegistry.strategies(0), noYieldAddress);

        // Adding new strategy
        vm.expectEmit(true, true, false, true);
        emit StrategyAdded(extraYieldAddress);
        admin.addSavingsAccountStrategy(strategyRegistryAddress, extraYieldAddress);

        // new strategy checks
        assertEq(_strategyRegistry.registry(extraYieldAddress), 1);
        assertEq(_strategyRegistry.strategies(1), extraYieldAddress);
    }

    //----------------------- Strategy Registry removeStrategy, failing tests-----------------------//

    // Removing invalid strategy address should fail
    function test_removeStrategy_invalidStrategy() public {
        test_addStrategy();
        try admin.removeStrategy(strategyRegistryAddress, 1, noYieldAddress) {
            revert('Removing invalid strategy address should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:RS1');
        }
    }

    // Removing strategy by invalid owner should fail
    function test_removeStrategy_invalidOwner() public {
        test_addStrategy();
        try fakeAdmin.removeStrategy(strategyRegistryAddress, 1, extraYieldAddress) {
            revert('Removing strategy by invalid owner should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Strategy Registry removeStrategy, passing tests-----------------------//

    // Removing strategy should pass
    function test_removeStrategy_lastIndex() public {
        test_addStrategy();
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Removing strategies
        vm.expectEmit(true, true, false, true);
        emit StrategyRemoved(extraYieldAddress);
        admin.removeStrategy(strategyRegistryAddress, 1, extraYieldAddress);

        // Removed strategy checks
        assertEq(_strategyRegistry.registry(extraYieldAddress), 0);
        assertEq(_strategyRegistry.retiredRegistry(extraYieldAddress), 1);
    }

    // Removing strategy should pass
    function test_removeStrategy_randomIndex() public {
        test_addStrategy();
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Removing strategies
        vm.expectEmit(true, true, false, true);
        emit StrategyRemoved(noYieldAddress);
        admin.removeStrategy(strategyRegistryAddress, 0, noYieldAddress);

        // Removed strategy checks
        assertEq(_strategyRegistry.registry(noYieldAddress), 0);
        assertEq(_strategyRegistry.retiredRegistry(noYieldAddress), 1);
    }

    //----------------------- Strategy Registry updateStrategy, failing tests-----------------------//

    // Updating strategy with invalid index should fail
    function test_updateStrategy_invalidIndex() public {
        test_addStrategy();
        try admin.updateStrategy(strategyRegistryAddress, 2, extraYieldAddress, extraYieldAddress1) {
            revert('Updating strategy with invalid index should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:US1');
        }
    }

    // Updating strategy with invalid old strategy should fail
    function test_updateStrategy_invalidOldStrategy() public {
        test_addStrategy();
        try admin.updateStrategy(strategyRegistryAddress, 1, extraYieldAddress1, extraYieldAddress1) {
            revert('Updating strategy with invalid old strategy should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:US2');
        }
    }

    // Updating strategy with zero address new strategy should fail
    function test_updateStrategy_zeroNewStrategy() public {
        test_addStrategy();
        try admin.updateStrategy(strategyRegistryAddress, 1, extraYieldAddress, address(0)) {
            revert('Updating strategy with zero address new strategy should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:US3');
        }
    }

    // Updating strategy with invalid new strategy should fail
    function test_updateStrategy_invalidNewStrategy() public {
        test_addStrategy();
        try admin.updateStrategy(strategyRegistryAddress, 1, extraYieldAddress, noYieldAddress) {
            revert('Updating strategy with invalid new strategy should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'SR:US4');
        }
    }

    // Updating strategy by invalid owner should fail
    function test_updateStrategy_invalidOwner() public {
        test_addStrategy();
        try fakeAdmin.updateStrategy(strategyRegistryAddress, 1, extraYieldAddress, extraYieldAddress1) {
            revert('Updating strategy by invalid owner should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    //----------------------- Strategy Registry updateStrategy, passing tests-----------------------//

    // Updating strategy should pass
    function test_updateStrategy() public {
        test_addStrategy();
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Updating strategy
        vm.expectEmit(true, true, false, true);
        emit StrategyRemoved(extraYieldAddress);
        vm.expectEmit(true, true, false, true);
        emit StrategyAdded(extraYieldAddress1);
        admin.updateStrategy(strategyRegistryAddress, 1, extraYieldAddress, extraYieldAddress1);

        // Old strategy checks
        assertEq(_strategyRegistry.registry(extraYieldAddress), 0);
        assertEq(_strategyRegistry.retiredRegistry(extraYieldAddress), 1);

        // New strategy checks
        assertEq(_strategyRegistry.registry(extraYieldAddress1), 1);
        assertEq(_strategyRegistry.strategies(1), extraYieldAddress1);
    }

    //----------------------- Strategy Registry util functions-----------------------//

    // Getting list of strategies should pass
    function test_getStrategies() public {
        test_addStrategy();
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Getting list of strategies
        address[] memory _strategies = _strategyRegistry.getStrategies();

        // Strategy list checks
        assertEq(_strategies[0], noYieldAddress);
        assertEq(_strategies[1], extraYieldAddress);
    }

    // Checking validity of strategeis should pass
    function test_isValidStrategy() public {
        test_addStrategy();
        StrategyRegistry _strategyRegistry = StrategyRegistry(strategyRegistryAddress);

        // Checking strategy validity (For valid strategy)
        bool isValid = _strategyRegistry.isValidStrategy(noYieldAddress);
        assertTrue(isValid);

        // Checking strategy validity (For valid strategy)
        isValid = _strategyRegistry.isValidStrategy(extraYieldAddress);
        assertTrue(isValid);

        // Checking strategy validity (For invalid strategy)
        isValid = _strategyRegistry.isValidStrategy(extraYieldAddress1);
        assertTrue(!isValid);
    }
}
