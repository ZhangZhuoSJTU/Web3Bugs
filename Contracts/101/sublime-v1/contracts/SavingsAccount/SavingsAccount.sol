// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IYield.sol';

/**
 * @title Savings account contract with Methods related to savings account
 * @notice Implements the functions related to savings account
 * @author Sublime
 **/
contract SavingsAccount is ISavingsAccount, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    /**
     * @notice instance of the strategy registry used to whitelist strategies
     */
    IStrategyRegistry public immutable STRATEGY_REGISTRY;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- State vars start --------------------------------/

    /**
     * @notice mapping from user to token to strategy to balance of shares
     * @dev user -> token -> strategy (underlying address) -> amount (shares)
     */
    mapping(address => mapping(address => mapping(address => uint256))) public override balanceInShares;

    /**
     * @notice mapping from user to token to toAddress for approval to amount approved
     * @dev user => token => to => amount
     */
    mapping(address => mapping(address => mapping(address => uint256))) public override allowance;

    //-------------------------------- State vars end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /**
     * @notice constructor
     * @dev initializes the immutables
     * @param _strategyRegistry address of the strategy registry
     **/
    constructor(address _strategyRegistry) {
        require(_strategyRegistry != address(0), 'C1');
        STRATEGY_REGISTRY = IStrategyRegistry(_strategyRegistry);
    }

    /**
     * @dev initialize the contract
     * @param _owner address of the owner of the savings account contract
     **/
    function initialize(address _owner) external initializer {
        __Ownable_init();
        super.transferOwnership(_owner);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- Deposit start --------------------------------/

    /**
     * @notice used to deposit tokens into strategy via savings account
     * @param _amount amount of tokens deposited
     * @param _token address of token contract
     * @param _strategy address of the strategy into which tokens are to be deposited
     * @param _to address to deposit to
     * @return amount of shares deposited
     */
    function deposit(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
    ) external override nonReentrant returns (uint256) {
        require(_to != address(0), 'SA:D1');
        require(_amount != 0, 'SA:D2');
        require(STRATEGY_REGISTRY.registry(_strategy) != 0, 'SA:D3');
        require(_token != address(0), 'SA:D4');
        uint256 _sharesReceived = IYield(_strategy).lockTokens(msg.sender, _token, _amount);
        balanceInShares[_to][_token][_strategy] = balanceInShares[_to][_token][_strategy].add(_sharesReceived);
        emit Deposited(_to, _sharesReceived, _token, _strategy);
        return _sharesReceived;
    }

    //-------------------------------- Deposit end --------------------------------/

    //-------------------------------- Switch Strategy start --------------------------------/

    /**
     * @dev Used to switch saving strategy of an _token
     * @param _currentStrategy initial strategy of token
     * @param _newStrategy new strategy to invest
     * @param _token address of the token
     * @param _amount amount of tokens to be reinvested
     */
    function switchStrategy(
        address _currentStrategy,
        address _newStrategy,
        address _token,
        uint256 _amount
    ) external override nonReentrant {
        require(_currentStrategy != _newStrategy, 'SA:SS1');
        require(STRATEGY_REGISTRY.registry(_newStrategy) != 0, 'SA:SS2');
        require(STRATEGY_REGISTRY.isValidStrategy(_currentStrategy), 'SA:SS3');
        require(_amount != 0, 'SA:SS4');

        IYield currentStrategy = IYield(_currentStrategy);
        _amount = currentStrategy.getSharesForTokens(_amount, _token);

        // TODO use trySub - as mentioned in SafeMath library
        balanceInShares[msg.sender][_token][_currentStrategy] = balanceInShares[msg.sender][_token][_currentStrategy].sub(
            _amount,
            'SA:SS5'
        );

        uint256 _tokensReceived = currentStrategy.unlockTokens(_token, address(this), _amount);

        IERC20(_token).safeApprove(_newStrategy, _tokensReceived);

        uint256 _sharesReceived = IYield(_newStrategy).lockTokens(address(this), _token, _tokensReceived);

        balanceInShares[msg.sender][_token][_newStrategy] = balanceInShares[msg.sender][_token][_newStrategy].add(_sharesReceived);
        emit StrategySwitched(msg.sender, _token, _amount, _sharesReceived, _currentStrategy, _newStrategy);
    }

    //-------------------------------- Switch Strategy end --------------------------------/

    //-------------------------------- Allowance start --------------------------------/

    /**
     * @notice used to approve allowance to an address
     * @dev this is prone to race condition, hence increaseAllowance is recommended
     * @param _amount amount of tokens approved
     * @param _token address of token approved
     * @param _to address of the user approved to
     */
    function approve(
        address _token,
        address _to,
        uint256 _amount
    ) external override {
        require(msg.sender != _to, 'SA:A1');
        allowance[msg.sender][_token][_to] = _amount;

        emit Approved(_token, msg.sender, _to, _amount);
    }

    /**
     * @notice used to increase allowance to an address
     * @param _amount amount of tokens allowance is increased by
     * @param _token address of token approved
     * @param _to address of the address approved to
     */
    function increaseAllowance(
        address _token,
        address _to,
        uint256 _amount
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].add(_amount);
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    /**
     * @notice used to decrease allowance to an address
     * @param _amount amount of tokens allowance is decreased by
     * @param _token address of token approved
     * @param _to address of the user approved to
     */
    function decreaseAllowance(
        address _token,
        address _to,
        uint256 _amount
    ) external override {
        uint256 _updatedAllowance = allowance[msg.sender][_token][_to].sub(_amount, 'SA:DA1');
        allowance[msg.sender][_token][_to] = _updatedAllowance;

        emit Approved(_token, msg.sender, _to, _updatedAllowance);
    }

    //-------------------------------- Allowance ends --------------------------------/

    //-------------------------------- Transfer start --------------------------------/

    /**
     * @notice used to transfer tokens
     * @param _amount amount of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _to address of the user tokens are transferred to
     * @return amount of shares transferred
     */
    function transfer(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount
    ) external override returns (uint256) {
        require(_amount != 0, 'SA:T1');
        require(_to != address(0), 'SA:T2');
        require(STRATEGY_REGISTRY.registry(_strategy) != 0, 'SA:T3');

        uint256 _shares = IYield(_strategy).getSharesForTokens(_amount, _token);

        _transfer(_token, _strategy, msg.sender, _to, _shares);

        return _shares;
    }

    /**
     * @notice used to transfer tokens
     * @param _shares shares of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _to address of the user tokens are transferred to
     * @return amount of shares transferred
     */
    function transferShares(
        address _token,
        address _strategy,
        address _to,
        uint256 _shares
    ) external override returns (uint256) {
        require(_shares != 0, 'SA:TS1');
        require(_to != address(0), 'SA:TS2');
        require(STRATEGY_REGISTRY.registry(_strategy) != 0, 'SA:TS3');

        _transfer(_token, _strategy, msg.sender, _to, _shares);

        return _shares;
    }

    /**
     * @notice used to transfer tokens from allowance by another address
     * @param _amount amount of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _from address from whose allowance tokens are transferred
     * @param _to address of the user tokens are transferred to
     * @return the amount of tokens in terms of LP tokens of _token in _strategy strategy of
     *         savingsAccount that will be transferred from the _from address to the _to address
     */
    function transferFrom(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount
    ) external override returns (uint256) {
        require(_amount != 0, 'SA:TF1');
        require(_from != address(0), 'SA:TF2');
        require(_to != address(0), 'SA:TF3');
        require(STRATEGY_REGISTRY.registry(_strategy) != 0, 'SA:TF4');

        //update allowance
        _spendAllowance(_token, _from, msg.sender, _amount);

        uint256 _shares = IYield(_strategy).getSharesForTokens(_amount, _token);

        _transfer(_token, _strategy, _from, _to, _shares);

        return _shares;
    }

    /**
     * @notice used to transfer tokens from allowance by another address
     * @param _shares shares of tokens transferred
     * @param _token address of token transferred
     * @param _strategy address of the strategy from which tokens are transferred
     * @param _from address from whose allowance tokens are transferred
     * @param _to address of the user tokens are transferred to
     * @return number of shares transferred
     */
    function transferSharesFrom(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _shares
    ) external override returns (uint256) {
        require(_shares != 0, 'SA:TFS1');
        require(_from != address(0), 'SA:TFS2');
        require(_to != address(0), 'SA:TFS3');
        require(STRATEGY_REGISTRY.registry(_strategy) != 0, 'SA:TFS4');

        uint256 _amount = IYield(_strategy).getTokensForShares(_shares, _token);

        _spendAllowance(_token, _from, msg.sender, _amount);

        _transfer(_token, _strategy, _from, _to, _shares);

        return _shares;
    }

    function _transfer(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _shares
    ) private {
        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(_shares, 'SA:IT1');

        balanceInShares[_to][_token][_strategy] = (balanceInShares[_to][_token][_strategy]).add(_shares);

        emit Transfer(_token, _strategy, _from, _to, _shares);
    }

    function _spendAllowance(
        address _token,
        address _from,
        address _spender,
        uint256 _amount
    ) private {
        uint256 _currentAllowance = allowance[_from][_token][_spender];
        if (_currentAllowance != type(uint256).max) {
            allowance[_from][_token][_spender] = _currentAllowance.sub(_amount, 'SA:ISA1');
        }
    }

    //-------------------------------- Transfer end --------------------------------/

    //-------------------------------- Withdraw start --------------------------------/

    /**
     * @dev Used to withdraw token from Saving Account
     * @param _to address to which token should be sent
     * @param _amount amount of tokens to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _receiveShares boolean indicating to withdraw in liquidity share or underlying token
     * @return amount of tokens received from withdrawal
     */
    function withdraw(
        address _token,
        address _strategy,
        address _to,
        uint256 _amount,
        bool _receiveShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SA:W1');
        require(_to != address(0), 'SA:W2');
        require(STRATEGY_REGISTRY.isValidStrategy(_strategy), 'SA:W3');

        uint256 _shares = IYield(_strategy).getSharesForTokens(_amount, _token);

        uint256 _amountReceived = _withdraw(_token, _strategy, msg.sender, _to, _shares, _receiveShares);

        return _amountReceived;
    }

    /**
     * @dev Used to withdraw token from Saving Account
     * @param _to address to which token should be sent
     * @param _shares amount of shares to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _receiveShares boolean indicating to withdraw in liquidity share or underlying token
     * @return amount of tokens received from withdrawal
     */
    function withdrawShares(
        address _token,
        address _strategy,
        address _to,
        uint256 _shares,
        bool _receiveShares
    ) external override nonReentrant returns (uint256) {
        require(_shares != 0, 'SA:WS1');
        require(_to != address(0), 'SA:WS2');
        require(STRATEGY_REGISTRY.isValidStrategy(_strategy), 'SA:WS3');

        uint256 _amountReceived = _withdraw(_token, _strategy, msg.sender, _to, _shares, _receiveShares);

        return _amountReceived;
    }

    /**
     * @dev Used to withdraw token from allowance of Saving Account
     * @param _from address from which tokens will be withdrawn
     * @param _to address to which token should be withdrawn
     * @param _amount amount of tokens to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _receiveShares boolean indicating to withdraw in liquidity share or underlying token
     * @return amount of tokens received from withdrawal
     */

    function withdrawFrom(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _amount,
        bool _receiveShares
    ) external override nonReentrant returns (uint256) {
        require(_amount != 0, 'SA:WF1');
        require(_from != address(0), 'SA:WF2');
        require(_to != address(0), 'SA:WF3');
        require(STRATEGY_REGISTRY.isValidStrategy(_strategy), 'SA:WF4');

        _spendAllowance(_token, _from, msg.sender, _amount);

        uint256 _shares = IYield(_strategy).getSharesForTokens(_amount, _token);

        uint256 _amountReceived = _withdraw(_token, _strategy, _from, _to, _shares, _receiveShares);
        return _amountReceived;
    }

    /**
     * @dev Used to withdraw token from allowance of Saving Account
     * @param _to address to which token should be withdrawn
     * @param _shares amount of shares to withdraw
     * @param _token address of the token to be withdrawn
     * @param _strategy strategy from where token has to withdrawn(ex:- compound,Aave etc)
     * @param _receiveShares boolean indicating to withdraw in liquidity share or underlying token
     * @return amount of tokens received from withdrawal
     */
    function withdrawSharesFrom(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _shares,
        bool _receiveShares
    ) external override nonReentrant returns (uint256) {
        require(_shares != 0, 'SA:WSF1');
        require(_from != address(0), 'SA:WSF2');
        require(_to != address(0), 'SA:WSF3');
        require(STRATEGY_REGISTRY.isValidStrategy(_strategy), 'SA:WSF4');

        uint256 _amount = IYield(_strategy).getTokensForShares(_shares, _token);

        _spendAllowance(_token, _from, msg.sender, _amount);

        uint256 _amountReceived = _withdraw(_token, _strategy, _from, _to, _shares, _receiveShares);
        return _amountReceived;
    }

    function _withdraw(
        address _token,
        address _strategy,
        address _from,
        address _to,
        uint256 _shares,
        bool _receiveShares
    ) private returns (uint256) {
        balanceInShares[_from][_token][_strategy] = balanceInShares[_from][_token][_strategy].sub(_shares, 'SA:IW1');
        uint256 _amountReceived;
        IYield _strategyContract = IYield(_strategy);
        if (_receiveShares) {
            address _sharesToken = _strategyContract.liquidityToken(_token);
            require(_sharesToken != address(0), 'SA:IW2');
            _amountReceived = _strategyContract.unlockShares(_sharesToken, _to, _shares);
        } else {
            _amountReceived = _strategyContract.unlockTokens(_token, _to, _shares);
        }
        emit Withdrawn(_from, _to, _shares, _token, _strategy, _receiveShares);
        return _amountReceived;
    }

    /**
     * @notice used to withdraw a token from all strategies
     * @param _token address of token which is to be withdrawn
     * @return total amount of base tokens withdrawn
     */
    function withdrawAll(address _token) external override nonReentrant returns (uint256) {
        address[] memory _strategyList = STRATEGY_REGISTRY.getStrategies();
        uint256 _tokenReceived;

        for (uint256 i; i < _strategyList.length; ++i) {
            uint256 _shares = balanceInShares[msg.sender][_token][_strategyList[i]];
            if (_shares == 0) continue;

            delete balanceInShares[msg.sender][_token][_strategyList[i]];
            uint256 _amount = IYield(_strategyList[i]).unlockTokens(_token, msg.sender, _shares);
            _tokenReceived = _tokenReceived.add(_amount);
        }

        if (_tokenReceived == 0) return 0;

        emit WithdrawnAll(msg.sender, _tokenReceived, _token);

        return _tokenReceived;
    }

    /**
     * @notice used to withdraw a token from specific strategies
     * @param _token address of token which is to be withdrawn
     * @param _strategy strategy from which tokens are withdrawn
     * @return total amount of base tokens withdrawn
     */
    function withdrawAll(address _token, address _strategy) external override nonReentrant returns (uint256) {
        require(STRATEGY_REGISTRY.isValidStrategy(_strategy), 'SA:WA1');
        uint256 _sharesBalance = balanceInShares[msg.sender][_token][_strategy];

        if (_sharesBalance == 0) return 0;

        delete balanceInShares[msg.sender][_token][_strategy];

        uint256 _amount = IYield(_strategy).unlockTokens(_token, msg.sender, _sharesBalance);

        emit Withdrawn(msg.sender, msg.sender, _amount, _token, _strategy, false);

        return _amount;
    }

    //-------------------------------- Withdraw end --------------------------------/

    //-------------------------------- Getter start --------------------------------/

    /**
     * @notice used to query total tokens of a token with a user
     * @param _user address of the user
     * @param _token address of token
     * @return _totalTokens total number of tokens of the token with the user
     */
    function getTotalTokens(address _user, address _token) external override returns (uint256) {
        address[] memory _strategyList = STRATEGY_REGISTRY.getStrategies();
        uint256 _totalTokens;

        for (uint256 i; i < _strategyList.length; ++i) {
            uint256 _liquidityShares = balanceInShares[_user][_token][_strategyList[i]];
            if (_liquidityShares != 0) {
                uint256 _liquidityTokens = IYield(_strategyList[i]).getTokensForShares(_liquidityShares, _token);
                _totalTokens = _totalTokens.add(_liquidityTokens);
            }
        }
        return _totalTokens;
    }

    //-------------------------------- Getter end --------------------------------/
}
