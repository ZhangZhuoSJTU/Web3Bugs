pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

import "../configuration/LendingPoolAddressesProvider.sol";
import "../lendingpool/LendingPool.sol";
import "../lendingpool/LendingPoolDataProvider.sol";
import "../lendingpool/LendingPoolCore.sol";
import "../libraries/WadRayMath.sol";

/**
 * @title Aave ERC20 AToken
 *
 * @dev Implementation of the interest bearing token for the DLP protocol.
 * @author Aave
 */
contract AToken is ERC20, ERC20Detailed {
    using WadRayMath for uint256;

    uint256 public constant UINT_MAX_VALUE = uint256(-1);

    /**
    * @dev emitted after the redeem action
    * @param _from the address performing the redeem
    * @param _value the amount to be redeemed
    * @param _fromBalanceIncrease the cumulated balance since the last update of the user
    * @param _fromIndex the last index of the user
    **/
    event Redeem(
        address indexed _from,
        uint256 _value,
        uint256 _fromBalanceIncrease,
        uint256 _fromIndex
    );

    /**
    * @dev emitted after the mint action
    * @param _from the address performing the mint
    * @param _value the amount to be minted
    * @param _fromBalanceIncrease the cumulated balance since the last update of the user
    * @param _fromIndex the last index of the user
    **/
    event MintOnDeposit(
        address indexed _from,
        uint256 _value,
        uint256 _fromBalanceIncrease,
        uint256 _fromIndex
    );

    /**
    * @dev emitted during the liquidation action, when the liquidator reclaims the underlying
    * asset
    * @param _from the address from which the tokens are being burned
    * @param _value the amount to be burned
    * @param _fromBalanceIncrease the cumulated balance since the last update of the user
    * @param _fromIndex the last index of the user
    **/
    event BurnOnLiquidation(
        address indexed _from,
        uint256 _value,
        uint256 _fromBalanceIncrease,
        uint256 _fromIndex
    );

    /**
    * @dev emitted during the transfer action
    * @param _from the address from which the tokens are being transferred
    * @param _to the adress of the destination
    * @param _value the amount to be minted
    * @param _fromBalanceIncrease the cumulated balance since the last update of the user
    * @param _toBalanceIncrease the cumulated balance since the last update of the destination
    * @param _fromIndex the last index of the user
    * @param _toIndex the last index of the liquidator
    **/
    event BalanceTransfer(
        address indexed _from,
        address indexed _to,
        uint256 _value,
        uint256 _fromBalanceIncrease,
        uint256 _toBalanceIncrease,
        uint256 _fromIndex,
        uint256 _toIndex
    );

    /**
    * @dev emitted when the accumulation of the interest
    * by an user is redirected to another user
    * @param _from the address from which the interest is being redirected
    * @param _to the adress of the destination
    * @param _fromBalanceIncrease the cumulated balance since the last update of the user
    * @param _fromIndex the last index of the user
    **/
    event InterestStreamRedirected(
        address indexed _from,
        address indexed _to,
        uint256 _redirectedBalance,
        uint256 _fromBalanceIncrease,
        uint256 _fromIndex
    );

    /**
    * @dev emitted when the redirected balance of an user is being updated
    * @param _targetAddress the address of which the balance is being updated
    * @param _targetBalanceIncrease the cumulated balance since the last update of the target
    * @param _targetIndex the last index of the user
    * @param _redirectedBalanceAdded the redirected balance being added
    * @param _redirectedBalanceRemoved the redirected balance being removed
    **/
    event RedirectedBalanceUpdated(
        address indexed _targetAddress,
        uint256 _targetBalanceIncrease,
        uint256 _targetIndex,
        uint256 _redirectedBalanceAdded,
        uint256 _redirectedBalanceRemoved
    );

    event InterestRedirectionAllowanceChanged(
        address indexed _from,
        address indexed _to
    );

    address public underlyingAssetAddress;

    mapping (address => uint256) private userIndexes;
    mapping (address => address) private interestRedirectionAddresses;
    mapping (address => uint256) private redirectedBalances;
    mapping (address => address) private interestRedirectionAllowances;

    LendingPoolAddressesProvider private addressesProvider;
    LendingPoolCore private core;
    LendingPool private pool;
    LendingPoolDataProvider private dataProvider;

    modifier onlyLendingPool {
        require(
            msg.sender == address(pool),
            "The caller of this function must be a lending pool"
        );
        _;
    }

    modifier whenTransferAllowed(address _from, uint256 _amount) {
        require(isTransferAllowed(_from, _amount), "Transfer cannot be allowed.");
        _;
    }

    constructor(
        LendingPoolAddressesProvider _addressesProvider,
        address _underlyingAsset,
        uint8 _underlyingAssetDecimals,
        string memory _name,
        string memory _symbol
    ) public ERC20Detailed(_name, _symbol, _underlyingAssetDecimals) {

        addressesProvider = _addressesProvider;
        core = LendingPoolCore(addressesProvider.getLendingPoolCore());
        pool = LendingPool(addressesProvider.getLendingPool());
        dataProvider = LendingPoolDataProvider(addressesProvider.getLendingPoolDataProvider());
        underlyingAssetAddress = _underlyingAsset;
    }

    /**
     * @notice ERC20 implementation internal function backing transfer() and transferFrom()
     * @dev validates the transfer before allowing it. NOTE: This is not standard ERC20 behavior
     **/
    function _transfer(address _from, address _to, uint256 _amount) internal whenTransferAllowed(_from, _amount) {

        executeTransferInternal(_from, _to, _amount);
    }


    /**
    * @dev redirects the interest generated to a target address.
    * when the interest is redirected, the user balance is added to
    * the recepient redirected balance.
    * @param _to the address to which the interest will be redirected
    **/
    function redirectInterestStream(address _to) external {
        redirectInterestStreamInternal(msg.sender, _to);
    }

    /**
    * @dev redirects the interest generated by _from to a target address.
    * when the interest is redirected, the user balance is added to
    * the recepient redirected balance. The caller needs to have allowance on
    * the interest redirection to be able to execute the function.
    * @param _from the address of the user whom interest is being redirected
    * @param _to the address to which the interest will be redirected
    **/
    function redirectInterestStreamOf(address _from, address _to) external {
        require(
            msg.sender == interestRedirectionAllowances[_from],
            "Caller is not allowed to redirect the interest of the user"
        );
        redirectInterestStreamInternal(_from,_to);
    }

    /**
    * @dev gives allowance to an address to execute the interest redirection
    * on behalf of the caller.
    * @param _to the address to which the interest will be redirected. Pass address(0) to reset
    * the allowance.
    **/
    function allowInterestRedirectionTo(address _to) external {
        require(_to != msg.sender, "User cannot give allowance to himself");
        interestRedirectionAllowances[msg.sender] = _to;
        emit InterestRedirectionAllowanceChanged(
            msg.sender,
            _to
        );
    }

    /**
    * @dev redeems aToken for the underlying asset
    * @param _amount the amount being redeemed
    **/
    function redeem(uint256 _amount) external {

        require(_amount > 0, "Amount to redeem needs to be > 0");

        //cumulates the balance of the user
        (,
        uint256 currentBalance,
        uint256 balanceIncrease,
        uint256 index) = cumulateBalanceInternal(msg.sender);

        uint256 amountToRedeem = _amount;

        //if amount is equal to uint(-1), the user wants to redeem everything
        if(_amount == UINT_MAX_VALUE){
            amountToRedeem = currentBalance;
        }

        require(amountToRedeem <= currentBalance, "User cannot redeem more than the available balance");

        //check that the user is allowed to redeem the amount
        require(isTransferAllowed(msg.sender, amountToRedeem), "Transfer cannot be allowed.");

        //if the user is redirecting his interest towards someone else,
        //we update the redirected balance of the redirection address by adding the accrued interest,
        //and removing the amount to redeem
        updateRedirectedBalanceOfRedirectionAddressInternal(msg.sender, balanceIncrease, amountToRedeem);

        // burns tokens equivalent to the amount requested
        _burn(msg.sender, amountToRedeem);

        bool userIndexReset = false;
        //reset the user data if the remaining balance is 0
        if(currentBalance.sub(amountToRedeem) == 0){
            userIndexReset = resetDataOnZeroBalanceInternal(msg.sender);
        }

        // executes redeem of the underlying asset
        pool.redeemUnderlying(
            underlyingAssetAddress,
            msg.sender,
            amountToRedeem,
            currentBalance.sub(amountToRedeem)
        );

        emit Redeem(msg.sender, amountToRedeem, balanceIncrease, userIndexReset ? 0 : index);
    }

    /**
     * @dev mints token in the event of users depositing the underlying asset into the lending pool
     * only lending pools can call this function
     * @param _account the address receiving the minted tokens
     * @param _amount the amount of tokens to mint
     */
    function mintOnDeposit(address _account, uint256 _amount) external onlyLendingPool {

        //cumulates the balance of the user
        (,
        ,
        uint256 balanceIncrease,
        uint256 index) = cumulateBalanceInternal(_account);

        //if the user is redirecting his interest towards someone else,
        //we update the redirected balance of the redirection address by adding the accrued interest
        //and the amount deposited
        updateRedirectedBalanceOfRedirectionAddressInternal(_account, balanceIncrease.add(_amount), 0);

        //mint an equivalent amount of tokens to cover the new deposit
        _mint(_account, _amount);

        emit MintOnDeposit(_account, _amount, balanceIncrease, index);
    }

    /**
     * @dev burns token in the event of a borrow being liquidated, in case the liquidators reclaims the underlying asset
     * Transfer of the liquidated asset is executed by the lending pool contract.
     * only lending pools can call this function
     * @param _account the address from which burn the aTokens
     * @param _value the amount to burn
     **/
    function burnOnLiquidation(address _account, uint256 _value) external onlyLendingPool {

        //cumulates the balance of the user being liquidated
        (,uint256 accountBalance,uint256 balanceIncrease,uint256 index) = cumulateBalanceInternal(_account);

        //adds the accrued interest and substracts the burned amount to
        //the redirected balance
        updateRedirectedBalanceOfRedirectionAddressInternal(_account, balanceIncrease, _value);

        //burns the requested amount of tokens
        _burn(_account, _value);

        bool userIndexReset = false;
        //reset the user data if the remaining balance is 0
        if(accountBalance.sub(_value) == 0){
            userIndexReset = resetDataOnZeroBalanceInternal(_account);
        }

        emit BurnOnLiquidation(_account, _value, balanceIncrease, userIndexReset ? 0 : index);
    }

    /**
     * @dev transfers tokens in the event of a borrow being liquidated, in case the liquidators reclaims the aToken
     *      only lending pools can call this function
     * @param _from the address from which transfer the aTokens
     * @param _to the destination address
     * @param _value the amount to transfer
     **/
    function transferOnLiquidation(address _from, address _to, uint256 _value) external onlyLendingPool {

        //being a normal transfer, the Transfer() and BalanceTransfer() are emitted
        //so no need to emit a specific event here
        executeTransferInternal(_from, _to, _value);
    }

    /**
    * @dev calculates the balance of the user, which is the
    * principal balance + interest generated by the principal balance + interest generated by the redirected balance
    * @param _user the user for which the balance is being calculated
    * @return the total balance of the user
    **/
    function balanceOf(address _user) public view returns(uint256) {

        //current principal balance of the user
        uint256 currentPrincipalBalance = super.balanceOf(_user);
        //balance redirected by other users to _user for interest rate accrual
        uint256 redirectedBalance = redirectedBalances[_user];

        if(currentPrincipalBalance == 0 && redirectedBalance == 0){
            return 0;
        }
        //if the _user is not redirecting the interest to anybody, accrues
        //the interest for himself

        if(interestRedirectionAddresses[_user] == address(0)){

            //accruing for himself means that both the principal balance and
            //the redirected balance partecipate in the interest
            return calculateCumulatedBalanceInternal(
                _user,
                currentPrincipalBalance.add(redirectedBalance)
            )
            .sub(redirectedBalance);
        }
        else {
            //if the user redirected the interest, then only the redirected
            //balance generates interest. In that case, the interest generated
            //by the redirected balance is added to the current principal balance.
            return currentPrincipalBalance.add(
                calculateCumulatedBalanceInternal(
                    _user,
                    redirectedBalance
                )
                .sub(redirectedBalance)
            );
        }
    }

    /**
    * @dev returns the principal balance of the user. The principal balance is the last
    * updated stored balance, which does not consider the perpetually accruing interest.
    * @param _user the address of the user
    * @return the principal balance of the user
    **/
    function principalBalanceOf(address _user) external view returns(uint256) {
        return super.balanceOf(_user);
    }


    /**
    * @dev calculates the total supply of the specific aToken
    * since the balance of every single user increases over time, the total supply
    * does that too.
    * @return the current total supply
    **/
    function totalSupply() public view returns(uint256) {

        uint256 currentSupplyPrincipal = super.totalSupply();

        if(currentSupplyPrincipal == 0){
            return 0;
        }

        return currentSupplyPrincipal
        .wadToRay()
        .rayMul(core.getReserveNormalizedIncome(underlyingAssetAddress))
        .rayToWad();
    }


    /**
     * @dev Used to validate transfers before actually executing them.
     * @param _user address of the user to check
     * @param _amount the amount to check
     * @return true if the _user can transfer _amount, false otherwise
     **/
    function isTransferAllowed(address _user, uint256 _amount) public view returns (bool) {
        return dataProvider.balanceDecreaseAllowed(underlyingAssetAddress, _user, _amount);
    }

    /**
    * @dev returns the last index of the user, used to calculate the balance of the user
    * @param _user address of the user
    * @return the last user index
    **/
    function getUserIndex(address _user) external view returns(uint256) {
        return userIndexes[_user];
    }


    /**
    * @dev returns the address to which the interest is redirected
    * @param _user address of the user
    * @return 0 if there is no redirection, an address otherwise
    **/
    function getInterestRedirectionAddress(address _user) external view returns(address) {
        return interestRedirectionAddresses[_user];
    }

    /**
    * @dev returns the redirected balance of the user. The redirected balance is the balance
    * redirected by other accounts to the user, that is accrueing interest for him.
    * @param _user address of the user
    * @return the total redirected balance
    **/
    function getRedirectedBalance(address _user) external view returns(uint256) {
        return redirectedBalances[_user];
    }

    /**
    * @dev accumulates the accrued interest of the user to the principal balance
    * @param _user the address of the user for which the interest is being accumulated
    * @return the previous principal balance, the new principal balance, the balance increase
    * and the new user index
    **/
    function cumulateBalanceInternal(address _user)
    internal
    returns(uint256, uint256, uint256, uint256) {

        uint256 previousPrincipalBalance = super.balanceOf(_user);

        //calculate the accrued interest since the last accumulation
        uint256 balanceIncrease = balanceOf(_user).sub(previousPrincipalBalance);
        //mints an amount of tokens equivalent to the amount accumulated
        _mint(_user, balanceIncrease);
        //updates the user index
        uint256 index = userIndexes[_user] = core.getReserveNormalizedIncome(underlyingAssetAddress);
        return (
        previousPrincipalBalance,
        previousPrincipalBalance.add(balanceIncrease),
        balanceIncrease,
        index
        );
    }

    /**
    * @dev updates the redirected balance of the user. If the user is not redirecting his
    * interest, nothing is executed.
    * @param _user the address of the user for which the interest is being accumulated
    * @param _balanceToAdd the amount to add to the redirected balance
    * @param _balanceToRemove the amount to remove from the redirected balance
    **/
    function updateRedirectedBalanceOfRedirectionAddressInternal(
        address _user,
        uint256 _balanceToAdd,
        uint256 _balanceToRemove
    ) internal {

        address redirectionAddress = interestRedirectionAddresses[_user];
        //if there isn't any redirection, nothing to be done
        if(redirectionAddress == address(0)){
            return;
        }

        //compound balances of the redirected address
        (,,uint256 balanceIncrease, uint256 index) = cumulateBalanceInternal(redirectionAddress);

        //updating the redirected balance
        redirectedBalances[redirectionAddress] = redirectedBalances[redirectionAddress]
        .add(_balanceToAdd)
        .sub(_balanceToRemove);

        //if the interest of redirectionAddress is also being redirected, we need to update
        //the redirected balance of the redirection target by adding the balance increase
        address targetOfRedirectionAddress = interestRedirectionAddresses[redirectionAddress];

        if(targetOfRedirectionAddress != address(0)){
            redirectedBalances[targetOfRedirectionAddress] = redirectedBalances[targetOfRedirectionAddress].add(balanceIncrease);
        }

        emit RedirectedBalanceUpdated(
            redirectionAddress,
            balanceIncrease,
            index,
            _balanceToAdd,
            _balanceToRemove
        );
    }

    /**
    * @dev calculate the interest accrued by _user on a specific balance
    * @param _user the address of the user for which the interest is being accumulated
    * @param _balance the balance on which the interest is calculated
    * @return the interest rate accrued
    **/
    function calculateCumulatedBalanceInternal(
        address _user,
        uint256 _balance
    ) internal view returns (uint256) {
        return _balance
        .wadToRay()
        .rayMul(core.getReserveNormalizedIncome(underlyingAssetAddress))
        .rayDiv(userIndexes[_user])
        .rayToWad();
    }

    /**
    * @dev executes the transfer of aTokens, invoked by both _transfer() and
    *      transferOnLiquidation()
    * @param _from the address from which transfer the aTokens
    * @param _to the destination address
    * @param _value the amount to transfer
    **/
    function executeTransferInternal(
        address _from,
        address _to,
        uint256 _value
    ) internal {

        require(_value > 0, "Transferred amount needs to be greater than zero");

        //cumulate the balance of the sender
        (,
        uint256 fromBalance,
        uint256 fromBalanceIncrease,
        uint256 fromIndex
        ) = cumulateBalanceInternal(_from);

        //cumulate the balance of the receiver
        (,
        ,
        uint256 toBalanceIncrease,
        uint256 toIndex
        ) = cumulateBalanceInternal(_to);

        //if the sender is redirecting his interest towards someone else,
        //adds to the redirected balance the accrued interest and removes the amount
        //being transferred
        updateRedirectedBalanceOfRedirectionAddressInternal(_from, fromBalanceIncrease, _value);

        //if the receiver is redirecting his interest towards someone else,
        //adds to the redirected balance the accrued interest and the amount
        //being transferred
        updateRedirectedBalanceOfRedirectionAddressInternal(_to, toBalanceIncrease.add(_value), 0);

        //performs the transfer
        super._transfer(_from, _to, _value);

        bool fromIndexReset = false;
        //reset the user data if the remaining balance is 0
        if(fromBalance.sub(_value) == 0){
            fromIndexReset = resetDataOnZeroBalanceInternal(_from);
        }

        emit BalanceTransfer(
            _from,
            _to,
            _value,
            fromBalanceIncrease,
            toBalanceIncrease,
            fromIndexReset ? 0 : fromIndex,
            toIndex
        );
    }

    /**
    * @dev executes the redirection of the interest from one address to another.
    * immediately after redirection, the destination address will start to accrue interest.
    * @param _from the address from which transfer the aTokens
    * @param _to the destination address
    **/
    function redirectInterestStreamInternal(
        address _from,
        address _to
    ) internal {

        address currentRedirectionAddress = interestRedirectionAddresses[_from];

        require(_to != currentRedirectionAddress, "Interest is already redirected to the user");

        //accumulates the accrued interest to the principal
        (uint256 previousPrincipalBalance,
        uint256 fromBalance,
        uint256 balanceIncrease,
        uint256 fromIndex) = cumulateBalanceInternal(_from);

        require(fromBalance > 0, "Interest stream can only be redirected if there is a valid balance");

        //if the user is already redirecting the interest to someone, before changing
        //the redirection address we substract the redirected balance of the previous
        //recipient
        if(currentRedirectionAddress != address(0)){
            updateRedirectedBalanceOfRedirectionAddressInternal(_from,0, previousPrincipalBalance);
        }

        //if the user is redirecting the interest back to himself,
        //we simply set to 0 the interest redirection address
        if(_to == _from) {
            interestRedirectionAddresses[_from] = address(0);
            emit InterestStreamRedirected(
                _from,
                address(0),
                fromBalance,
                balanceIncrease,
                fromIndex
            );
            return;
        }

        //first set the redirection address to the new recipient
        interestRedirectionAddresses[_from] = _to;

        //adds the user balance to the redirected balance of the destination
        updateRedirectedBalanceOfRedirectionAddressInternal(_from,fromBalance,0);

        emit InterestStreamRedirected(
            _from,
            _to,
            fromBalance,
            balanceIncrease,
            fromIndex
        );
    }

    /**
    * @dev function to reset the interest stream redirection and the user index, if the
    * user has no balance left.
    * @param _user the address of the user
    * @return true if the user index has also been reset, false otherwise. useful to emit the proper user index value
    **/
    function resetDataOnZeroBalanceInternal(address _user) internal returns(bool) {

        //if the user has 0 principal balance, the interest stream redirection gets reset
        interestRedirectionAddresses[_user] = address(0);

        //emits a InterestStreamRedirected event to notify that the redirection has been reset
        emit InterestStreamRedirected(_user, address(0),0,0,0);

        //if the redirected balance is also 0, we clear up the user index
        if(redirectedBalances[_user] == 0){
            userIndexes[_user] = 0;
            return true;
        }
        else{
            return false;
        }
    }
}
