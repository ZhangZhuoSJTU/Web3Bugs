pragma solidity 0.8.7;

/**
 * @title Parameters
 * @author @InsureDAO
 * @notice This contract manages parameters of markets.
 * SPDX-License-Identifier: GPL-3.0
 */

import "./interfaces/IOwnership.sol";
import "./interfaces/IParameters.sol";
import "./interfaces/IPremiumModel.sol";
import "hardhat/console.sol";

contract Parameters is IParameters {
    event VaultSet(address indexed token, address vault);
    event FeeRateSet(address indexed target, uint256 rate);
    event PremiumSet(address indexed target, address model);
    event UpperSlack(address indexed target, uint256 rate);
    event LowerSlack(address indexed target, uint256 rate);
    event LockupSet(address indexed target, uint256 span);
    event GraceSet(address indexed target, uint256 span);
    event MinDateSet(address indexed target, uint256 span);
    event WithdrawableSet(address indexed target, uint256 span);
    event ConditionSet(bytes32 indexed ref, bytes32 condition);
    event MaxListSet(address target, uint256 max);

    address public ownership;

    mapping(address => address) private _vaults; //address of the vault contract for each token
    mapping(address => uint256) private _fee; //fee rate in 1e6 (100% = 1e6)
    mapping(address => address) private _premium; //address for each premium model contract
    mapping(address => uint256) private _lowerSlack; //lower slack range before adjustAlloc for index
    mapping(address => uint256) private _upperSlack; //upper slack range before adjustAlloc for index
    mapping(address => uint256) private _grace; //grace before an insurance policy expires
    mapping(address => uint256) private _lockup; //funds lock up period after user requested to withdraw liquidity
    mapping(address => uint256) private _min; //minimum period to purchase an insurance policy
    mapping(address => uint256) private _maxList; //maximum number of pools one index can allocate
    mapping(address => uint256) private _withdawable; //a certain period a user can withdraw after lock up ends
    mapping(bytes32 => bytes32) private _conditions; //condition mapping for future use cases

    constructor(address _ownership) {
        ownership = _ownership;
    }

    /**
     * @notice Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(
            IOwnership(ownership).owner() == msg.sender,
            "Restricted: caller is not allowed to operate"
        );
        _;
    }

    /**
     * @notice set the vault address corresponding to the token address
     * @param _token address of token
     * @param _vault vault for token
     */
    function setVault(address _token, address _vault)
        external
        override
        onlyOwner
    {
        require(_vaults[_token] == address(0), "dev: already initialized");
        require(_vault != address(0), "dev: zero address");
        _vaults[_token] = _vault;
        emit VaultSet(_token, _vault);
    }

    /**
     * @notice set lock up periods in unix timestamp length (1 day = 86400)
     * @param _address address to set the parameter
     * @param _target parameter
     */
    function setLockup(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _lockup[_address] = _target;
        emit LockupSet(_address, _target);
    }

    /**
     * @notice set grace period length in unix timestamp length (1 day = 86400)
     * @param _address address to set the parameter
     * @param _target parameter
     */
    function setGrace(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _grace[_address] = _target;
        emit GraceSet(_address, _target);
    }

    /**
     * @notice set min length in unix timestamp length (1 day = 86400)
     * @param _address address to set the parameter
     * @param _target parameter
     */
    function setMinDate(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _min[_address] = _target;
        emit MinDateSet(_address, _target);
    }

    /**
     * @notice set slack rate of leverage before adjustAlloc
     * @param _address address to set the parameter
     * @param _target parameter (slack rate 100% = 1000
     */
    function setUpperSlack(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _upperSlack[_address] = _target;
        emit UpperSlack(_address, _target);
    }

    /**
     * @notice set slack rate of leverage before adjustAlloc
     * @param _address address to set the parameter
     * @param _target parameter (slack rate 100% = 1000
     */
    function setLowerSlack(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _lowerSlack[_address] = _target;
        emit LowerSlack(_address, _target);
    }

    /**
     * @notice set withdrawable period in unixtimestamp length (1 day = 86400)
     * @param _address address to set the parameter
     * @param _target parameter
     */
    function setWithdrawable(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _withdawable[_address] = _target;
        emit WithdrawableSet(_address, _target);
    }

    /**
     * @notice set the contract address of premium model
     * @param _address address to set the premium model
     * @param _target premium model contract address
     */
    function setPremiumModel(address _address, address _target)
        external
        override
        onlyOwner
    {
        require(_target != address(0), "dev: zero address");
        _premium[_address] = _target;
        emit PremiumSet(_address, _target);
    }

    /**
     * @notice set the contract address of fee model
     * @param _address address to set the fee model
     * @param _target fee rate
     */
    function setFeeRate(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _fee[_address] = _target;
        emit FeeRateSet(_address, _target);
    }

    /**
     * @notice set the max list number (e.g. 10)
     * @param _address address to set the parameter
     * @param _target parameter
     */
    function setMaxList(address _address, uint256 _target)
        external
        override
        onlyOwner
    {
        _maxList[_address] = _target;
        emit MaxListSet(_address, _target);
    }

    /**
     * @notice set the condition in bytes32 corresponding to bytes32
     * @param _reference bytes32 value to refer the parameter
     * @param _target parameter
     */
    function setCondition(bytes32 _reference, bytes32 _target)
        external
        override
        onlyOwner
    {
        _conditions[_reference] = _target;
        emit ConditionSet(_reference, _target);
    }

    /**
     * @notice Get the address of the owner
     * @return owner's address
     */
    function getOwner() public view override returns (address) {
        return IOwnership(ownership).owner();
    }

    /**
     * @notice get the address of the vault contract
     * @param _token token address
     * @return vault address
     */
    function getVault(address _token) external view override returns (address) {
        return _vaults[_token];
    }

    /**
     * @notice get premium amount for the specified conditions
     * @param _amount amount to get insured
     * @param _term term length
     * @param _totalLiquidity liquidity of the target contract's pool
     * @param _lockedAmount locked amount of the total liquidity
     * @param _target address of insurance market
     * @return premium amount
     */
    function getPremium(
        uint256 _amount,
        uint256 _term,
        uint256 _totalLiquidity,
        uint256 _lockedAmount,
        address _target
    ) external view override returns (uint256) {
        if (_premium[_target] == address(0)) {
            return
                IPremiumModel(_premium[address(0)]).getPremium(
                    _amount,
                    _term,
                    _totalLiquidity,
                    _lockedAmount
                );
        } else {
            return
                IPremiumModel(_premium[_target]).getPremium(
                    _amount,
                    _term,
                    _totalLiquidity,
                    _lockedAmount
                );
        }
    }

    /**
     * @notice get fee rate for the specified conditions
     * @param _target address of insurance market
     * @return fee rate
     */
    function getFeeRate(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_fee[_target] == 0) {
            return _fee[address(0)];
        } else {
            return _fee[_target];
        }
    }

    /**
     * @notice get slack rate of leverage before adjustAlloc
     * @param _target target contract's address
     * @return upper slack(slack above target)
     */
    function getUpperSlack(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_upperSlack[_target] == 0) {
            return _upperSlack[address(0)];
        } else {
            return _upperSlack[_target];
        }
    }

    /**
     * @notice get slack rate of leverage before adjustAlloc
     * @param _target target contract's address
     * @return lower slack(slack below target)
     */
    function getLowerSlack(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_lowerSlack[_target] == 0) {
            return _lowerSlack[address(0)];
        } else {
            return _lowerSlack[_target];
        }
    }

    /**
     * @notice get lock up period length
     * @param _target target contract's address
     * @return lock up period
     */
    function getLockup(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_lockup[_target] == 0) {
            return _lockup[address(0)];
        } else {
            return _lockup[_target];
        }
    }

    /**
     * @notice get withdrawable period length
     * @param _target target contract's address
     * @return withdrawable period
     */
    function getWithdrawable(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_withdawable[_target] == 0) {
            return _withdawable[address(0)];
        } else {
            return _withdawable[_target];
        }
    }

    /**
     * @notice get grace period length
     * @param _target target contract's address
     * @return grace period
     */
    function getGrace(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_grace[_target] == 0) {
            return _grace[address(0)];
        } else {
            return _grace[_target];
        }
    }

    /**
     * @notice get minimum period length for an insurance policy
     * @param _target target contract's address
     * @return minimum lenght of policy
     */
    function getMinDate(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_min[_target] == 0) {
            return _min[address(0)];
        } else {
            return _min[_target];
        }
    }

    /**
     * @notice get max number of pools for an index
     * @param _target target contract's address
     * @return maximum number of pools
     */
    function getMaxList(address _target)
        external
        view
        override
        returns (uint256)
    {
        if (_maxList[_target] == 0) {
            return _maxList[address(0)];
        } else {
            return _maxList[_target];
        }
    }

    /**
     * @notice get conditions for the corresponding reference parameter in bytes32
     * @param _reference reference address
     * @return condition parameter
     */
    function getCondition(bytes32 _reference)
        external
        view
        override
        returns (bytes32)
    {
        return _conditions[_reference];
    }
}
