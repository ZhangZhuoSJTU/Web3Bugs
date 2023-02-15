pragma solidity 0.8.7;

/**
 * @author InsureDAO
 * @title InsureDAO vault contract
 * @notice
 * SPDX-License-Identifier: GPL-3.0
 */
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IOwnership.sol";
import "./interfaces/IVault.sol";

import "./interfaces/IController.sol";
import "./interfaces/IRegistry.sol";

contract Vault is IVault {
    using SafeERC20 for IERC20;

    /**
     * Storage
     */

    address public override token;
    IController public controller;
    IRegistry public registry;
    IOwnership public ownership;

    mapping(address => uint256) public override debts;
    mapping(address => uint256) public attributions;
    uint256 public totalAttributions;

    address public keeper; //keeper can operate utilize(), if address zero, anyone can operate.
    uint256 public balance; //balance of underlying token
    uint256 public totalDebt; //total debt balance. 1debt:1token

    uint256 public constant MAGIC_SCALE_1E6 = 1e6; //internal multiplication scale 1e6 to reduce decimal truncation



    event ControllerSet(address controller);

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Restricted: caller is not allowed to operate"
        );
        _;
    }

    modifier onlyMarket() {
        require(
            IRegistry(registry).isListed(msg.sender),
            "ERROR_ONLY_MARKET"
        );
        _;
    }

    constructor(
        address _token,
        address _registry,
        address _controller,
        address _ownership
    ) {
        require(_token != address(0));
        require(_registry != address(0));
        require(_ownership != address(0));
        //controller can be zero

        token = _token;
        registry = IRegistry(_registry);
        controller = IController(_controller);
        ownership = IOwnership(_ownership);
    }

    /**
     * Vault Functions
     */

    /**
     * @notice A market contract can deposit collateral and get attribution point in return
     * @param  _amount amount of tokens to deposit
     * @param _from sender's address
     * @param _beneficiaries beneficiary's address array
     * @param _shares funds share within beneficiaries (100% = 1e6)
     * @return _allocations attribution amount generated from the transaction
     */
    function addValueBatch(
        uint256 _amount,
        address _from,
        address[2] memory _beneficiaries,
        uint256[2] memory _shares
    ) external override onlyMarket returns (uint256[2] memory _allocations) {
        
        require(_shares[0] + _shares[1] == 1000000, "ERROR_INCORRECT_SHARE");

        uint256 _attributions;
        if (totalAttributions == 0) {
            _attributions = _amount;
        } else {
            uint256 _pool = valueAll();
            _attributions = (_amount * totalAttributions) / _pool;
        }
        IERC20(token).safeTransferFrom(_from, address(this), _amount);

        balance += _amount;
        totalAttributions += _attributions;
        for (uint128 i = 0; i < 2; i++) {
            uint256 _allocation = (_shares[i] * _attributions) / MAGIC_SCALE_1E6;
            attributions[_beneficiaries[i]] += _allocation;
            _allocations[i] = _allocation;
        }
    }

    /**
     * @notice A market contract can deposit collateral and get attribution point in return
     * @param  _amount amount of tokens to deposit
     * @param _from sender's address
     * @param _beneficiary beneficiary's address
     * @return _attributions attribution amount generated from the transaction
     */

    function addValue(
        uint256 _amount,
        address _from,
        address _beneficiary
    ) external override onlyMarket returns (uint256 _attributions) {

        if (totalAttributions == 0) {
            _attributions = _amount;
        } else {
            uint256 _pool = valueAll();
            _attributions = (_amount * totalAttributions) / _pool;
        }
        IERC20(token).safeTransferFrom(_from, address(this), _amount);
        balance += _amount;
        totalAttributions += _attributions;
        attributions[_beneficiary] += _attributions;
    }

    /**
     * @notice an address that has balance in the vault can withdraw underlying value
     * @param _amount amount of tokens to withdraw
     * @param _to address to get underlying tokens
     * @return _attributions amount of attributions burnet
     */
    function withdrawValue(uint256 _amount, address _to)
        external
        override
        returns (uint256 _attributions)
    {
        require(
            attributions[msg.sender] > 0 &&
                underlyingValue(msg.sender) >= _amount,
            "ERROR_WITHDRAW-VALUE_BADCONDITOONS"
        );
        _attributions = (totalAttributions * _amount) / valueAll();

        attributions[msg.sender] -= _attributions;
        totalAttributions -= _attributions;

        if (available() < _amount) {
            //when USDC in this contract isn't enough
            uint256 _shortage = _amount - available();
            _unutilize(_shortage);

            assert(available() >= _amount);
        }

        balance -= _amount;
        IERC20(token).safeTransfer(_to, _amount);
    }

    /**
     * @notice an address that has balance in the vault can transfer underlying value
     * @param _amount sender of value
     * @param _destination reciepient of value
     */

    function transferValue(uint256 _amount, address _destination)
        external
        override
        returns (uint256 _attributions)
    {
        require(
            attributions[msg.sender] > 0 &&
                underlyingValue(msg.sender) >= _amount,
            "ERROR_TRANSFER-VALUE_BADCONDITOONS"
        );
        _attributions = (_amount * totalAttributions) / valueAll();
        attributions[msg.sender] -= _attributions;
        attributions[_destination] += _attributions;
    }

    /**
     * @notice a registered contract can borrow balance from the vault
     * @param _amount borrow amount
     * @param _to borrower's address
     */
    function borrowValue(uint256 _amount, address _to) external onlyMarket override {
        debts[msg.sender] += _amount;
        totalDebt += _amount;

        IERC20(token).safeTransfer(_to, _amount);
    }

    /**
     * @notice an address that has balance in the vault can offset an address's debt
     * @param _amount debt amount to offset
     * @param _target borrower's address
     */

    function offsetDebt(uint256 _amount, address _target)
        external
        override
        returns (uint256 _attributions)
    {
        require(
            attributions[msg.sender] > 0 &&
                underlyingValue(msg.sender) >= _amount,
            "ERROR_REPAY_DEBT_BADCONDITOONS"
        );
        _attributions = (_amount * totalAttributions) / valueAll();
        attributions[msg.sender] -= _attributions;
        totalAttributions -= _attributions;
        balance -= _amount;
        debts[_target] -= _amount;
        totalDebt -= _amount;
    }

    /**
     * @notice a registerd market can transfer their debt to system debt
     * @param _amount debt amount to transfer
     * @dev will be called when CDS could not afford when resume the market.
     */
    function transferDebt(uint256 _amount) external onlyMarket override {

        if(_amount != 0){
            debts[msg.sender] -= _amount;
            debts[address(0)] += _amount;
        }
    }

    /**
     * @notice anyone can repay the system debt by sending tokens to this contract
     * @param _amount debt amount to repay
     * @param _target borrower's address
     */
    function repayDebt(uint256 _amount, address _target) external override {
        uint256 _debt = debts[_target];
        if (_debt >= _amount) {
            debts[_target] -= _amount;
            totalDebt -= _amount;
            IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        } else {
            debts[_target] = 0;
            totalDebt -= _debt;
            IERC20(token).safeTransferFrom(msg.sender, address(this), _debt);
        }
    }

    /**
     * @notice an address that has balance in the vault can withdraw value denominated in attribution
     * @param _attribution amount of attribution to burn
     * @param _to beneficiary's address
     * @return _retVal number of tokens withdrawn from the transaction
     */
    function withdrawAttribution(uint256 _attribution, address _to)
        external
        override
        returns (uint256 _retVal)
    {
        _retVal = _withdrawAttribution(_attribution, _to);
    }

    /**
     * @notice an address that has balance in the vault can withdraw all value
     * @param _to beneficiary's address
     * @return _retVal number of tokens withdrawn from the transaction
     */
    function withdrawAllAttribution(address _to)
        external
        override
        returns (uint256 _retVal)
    {
        _retVal = _withdrawAttribution(attributions[msg.sender], _to);
    }

    /**
     * @notice an address that has balance in the vault can withdraw all value
     * @param _attribution amount of attribution to burn
     * @param _to beneficiary's address
     * @return _retVal number of tokens withdrawn from the transaction
     */
    function _withdrawAttribution(uint256 _attribution, address _to)
        internal
        returns (uint256 _retVal)
    {
        require(
            attributions[msg.sender] >= _attribution,
            "ERROR_WITHDRAW-ATTRIBUTION_BADCONDITOONS"
        );
        _retVal = (_attribution * valueAll()) / totalAttributions;

        attributions[msg.sender] -= _attribution;
        totalAttributions -= _attribution;

        if (available() < _retVal) {
            uint256 _shortage = _retVal - available();
            _unutilize(_shortage);
        }

        balance -= _retVal;
        IERC20(token).safeTransfer(_to, _retVal);
    }

    /**
     * @notice an address that has balance in the vault can transfer value denominated in attribution
     * @param _amount amount of attribution to transfer
     * @param _destination reciepient of attribution
     */
    function transferAttribution(uint256 _amount, address _destination)
        external
        override
    {
        require(_destination != address(0), "ERROR_ZERO_ADDRESS");

        require(
            _amount != 0 && attributions[msg.sender] >= _amount,
            "ERROR_TRANSFER-ATTRIBUTION_BADCONDITOONS"
        );

        attributions[msg.sender] -= _amount;
        attributions[_destination] += _amount;
    }

    /**
     * @notice the controller can utilize all available stored funds
     * @return _amount amount of tokens utilized
     */
    function utilize() external override returns (uint256 _amount) {
        if (keeper != address(0)) {
            require(msg.sender == keeper, "ERROR_NOT_KEEPER");
        }
        _amount = available(); //balance
        if (_amount > 0) {
            IERC20(token).safeTransfer(address(controller), _amount);
            balance -= _amount;
            controller.earn(address(token), _amount);
        }
    }

    /**
     * @notice get attribution number for the specified address
     * @param _target target address
     * @return amount of attritbution
     */

    function attributionOf(address _target)
        external
        view
        override
        returns (uint256)
    {
        return attributions[_target];
    }

    /**
     * @notice get all attribution number for this contract
     * @return amount of all attribution
     */
    function attributionAll() external view returns (uint256) {
        return totalAttributions;
    }

    /**
     * @notice Convert attribution number into underlying assset value
     * @param _attribution amount of attribution
     * @return token value of input attribution
     */
    function attributionValue(uint256 _attribution)
        external
        view
        override
        returns (uint256)
    {
        if (totalAttributions > 0 && _attribution > 0) {
            return (_attribution * valueAll()) / totalAttributions;
        } else {
            return 0;
        }
    }

    /**
     * @notice return underlying value of the specified address
     * @param _target target address
     * @return token value of target address
     */
    function underlyingValue(address _target)
        public
        view
        override
        returns (uint256)
    {
        if (attributions[_target] > 0) {
            return (valueAll() * attributions[_target]) / totalAttributions;
        } else {
            return 0;
        }
    }

    /**
     * @notice return underlying value of this contract
     * @return all token value of the vault
     */
    function valueAll() public view returns (uint256) {
        if (address(controller) != address(0)) {
            return balance + controller.valueAll();
        } else {
            return balance;
        }
    }

    /**
     * @notice internal function to unutilize the funds and keep utilization rate
     * @param _amount amount to withdraw from controller
     */
    function _unutilize(uint256 _amount) internal {
        require(address(controller) != address(0), "ERROR_CONTROLLER_NOT_SET");

        controller.withdraw(address(this), _amount);
        balance += _amount;
    }

    /**
     * @notice return how much funds in this contract is available to be utilized
     * @return available balance to utilize
     */
    function available() public view returns (uint256) {
        return balance - totalDebt;
    }

    /**
     * @notice return how much price for each attribution
     * @return value of one share of attribution
     */
    function getPricePerFullShare() public view returns (uint256) {
        return (valueAll() * MAGIC_SCALE_1E6) / totalAttributions;
    }

    /**
     * onlyOwner
     */

    /**
     * @notice withdraw redundant token stored in this contract
     * @param _token token address
     * @param _to beneficiary's address
     */
    function withdrawRedundant(address _token, address _to)
        external
        override
        onlyOwner
    {
        if (
            _token == address(token) &&
            balance < IERC20(token).balanceOf(address(this))
        ) {
            uint256 _redundant = IERC20(token).balanceOf(address(this)) -
                balance;
            IERC20(token).safeTransfer(_to, _redundant);
        } else if (IERC20(_token).balanceOf(address(this)) > 0) {
            IERC20(_token).safeTransfer(
                _to,
                IERC20(_token).balanceOf(address(this))
            );
        }
    }

    /**
     * @notice admin function to set controller address
     * @param _controller address of the controller
     */
    function setController(address _controller) public override onlyOwner {
        require(_controller != address(0), "ERROR_ZERO_ADDRESS");

        if (address(controller) != address(0)) {
            controller.migrate(address(_controller));
            controller = IController(_controller);
        } else {
            controller = IController(_controller);
        }

        emit ControllerSet(_controller);
    }

    /**
     * @notice the controller can utilize all available stored funds
     * @param _keeper keeper address
     */
    function setKeeper(address _keeper) external override onlyOwner {
        if (keeper != _keeper) {
            keeper = _keeper;
        }
    }
}
