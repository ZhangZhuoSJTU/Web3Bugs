// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

// Interfaces
import "./interfaces/iERC20.sol";
import "./interfaces/iVADER.sol";
import "./interfaces/iROUTER.sol";

contract USDV is iERC20 {

    // ERC-20 Parameters
    string public override name; string public override symbol;
    uint public override decimals; uint public override totalSupply;

    // ERC-20 Mappings
    mapping(address => uint) private _balances;
    mapping(address => mapping(address => uint)) private _allowances;

    // Parameters
    bool private inited;
    uint public nextEraTime;
    uint public blockDelay;

    address public VADER;
    address public VAULT;
    address public ROUTER;

    mapping(address => uint) public lastBlock;

    // Only DAO can execute
    modifier onlyDAO() {
        require(msg.sender == DAO(), "Not DAO");
        _;
    }
    // Stop flash attacks
    modifier flashProof() {
        require(isMature(), "No flash");
        _;
    }
    function isMature() public view returns(bool isMatured){
        if(lastBlock[tx.origin] + blockDelay <= block.number){ // Stops an EOA doing a flash attack in same block
            return true;
        }
    }

    //=====================================CREATION=========================================//
    // Constructor
    constructor() {
        name = 'VADER STABLE DOLLAR';
        symbol = 'USDV';
        decimals = 18;
        totalSupply = 0;
    }
    function init(address _vader, address _vault, address _router) external {
        require(inited == false);
        inited = true;
        VADER = _vader;
        VAULT = _vault;
        ROUTER = _router;
        nextEraTime = block.timestamp + iVADER(VADER).secondsPerEra();
    }

    //========================================iERC20=========================================//
    function balanceOf(address account) public view override returns (uint) {
        return _balances[account];
    }
    function allowance(address owner, address spender) public view virtual override returns (uint) {
        return _allowances[owner][spender];
    }
    // iERC20 Transfer function
    function transfer(address recipient, uint amount) external virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    // iERC20 Approve, change allowance functions
    function approve(address spender, uint amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    function _approve(address owner, address spender, uint amount) internal virtual {
        require(owner != address(0), "sender");
        require(spender != address(0), "spender");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
    
    // iERC20 TransferFrom function
    function transferFrom(address sender, address recipient, uint amount) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
        return true;
    }

    // TransferTo function
    // Risks: User can be phished, or tx.origin may be deprecated, optionality should exist in the system. 
    function transferTo(address recipient, uint amount) external virtual override returns (bool) {
        _transfer(tx.origin, recipient, amount);
        return true;
    }

    // Internal transfer function
    function _transfer(address sender, address recipient, uint amount) internal virtual {
        if(amount > 0){                                     // Due to design, this function may be called with 0
            require(sender != address(0), "sender");
            _balances[sender] -= amount;
            _balances[recipient] += amount;
            emit Transfer(sender, recipient, amount);
            _checkIncentives();
        }
    }
    // Internal mint (upgrading and daily emissions)
    function _mint(address account, uint amount) internal virtual {
        if(amount > 0){                                     // Due to design, this function may be called with 0
            require(account != address(0), "recipient");
            totalSupply += amount;
            _balances[account] += amount;
            emit Transfer(address(0), account, amount);
        }
    }
    // Burn supply
    function burn(uint amount) external virtual override {
        _burn(msg.sender, amount);
    }
    function burnFrom(address account, uint amount) external virtual override {
        uint decreasedAllowance = allowance(account, msg.sender)- amount;
        _approve(account, msg.sender, decreasedAllowance);
        _burn(account, amount);
    }
    function _burn(address account, uint amount) internal virtual {
        if(amount > 0){                                     // Due to design, this function may be called with 0
            require(account != address(0), "address err");
            _balances[account] -= amount;
            totalSupply -= amount;
            emit Transfer(account, address(0), amount);
        }
    }

    //=========================================DAO=========================================//
    // Can set params
    function setParams(uint newDelay) external onlyDAO {
        blockDelay = newDelay;
    }

   //======================================INCENTIVES========================================//
    // Internal - Update incentives function
    function _checkIncentives() private {
        if (block.timestamp >= nextEraTime && emitting()) {                 // If new Era
            nextEraTime = block.timestamp + iVADER(VADER).secondsPerEra(); 
            uint _balance = iERC20(VADER).balanceOf(address(this));         // Get spare VADER
            if(_balance > 4){
                uint _USDVShare = _balance/2;                                   // Get 50%
                _convert(address(this), _USDVShare);                            // Convert it
                if(balanceOf(address(this)) > 2){
                    _transfer(address(this), ROUTER, balanceOf(address(this)) / 2);              // Send half USDV to ROUTER
                    _transfer(address(this), VAULT, balanceOf(address(this)));                   // Send rest to VAULT
                }
                iERC20(VADER).transfer(ROUTER, iERC20(VADER).balanceOf(address(this))/2);   // Send half VADER to ROUTER
                iERC20(VADER).transfer(VAULT, iERC20(VADER).balanceOf(address(this)));      // Send rest to VAULT
            }
        }
    }
    
    //======================================ASSET MINTING========================================//
    // Convert to USDV
    function convert(uint amount) external returns(uint) {
        return convertForMember(msg.sender, amount);
    }
    // Convert for members
    function convertForMember(address member, uint amount) public returns(uint) {
        getFunds(VADER, amount);
        return _convert(member, amount);
    }
    // Internal convert
    function _convert(address _member, uint amount) internal flashProof returns(uint _convertAmount){
        if(minting()){
            lastBlock[tx.origin] = block.number;                    // Record first
            iERC20(VADER).burn(amount);
            _convertAmount = iROUTER(ROUTER).getUSDVAmount(amount); // Critical pricing functionality
            _mint(_member, _convertAmount);
        }
    }
    // Redeem to VADER
    function redeem(uint amount) external returns(uint) {
        return redeemForMember(msg.sender, amount);
    }
    // Contracts to redeem for members
    function redeemForMember(address member, uint amount) public returns(uint redeemAmount) {
        _transfer(msg.sender, VADER, amount);                   // Move funds
        redeemAmount = iVADER(VADER).redeemToMember(member);    // Ask VADER to redeem
        lastBlock[tx.origin] = block.number;                    // Must record block AFTER the tx
    }

    //============================== ASSETS ================================//

    function getFunds(address token, uint amount) internal {
        if(token == address(this)){
            _transfer(msg.sender, address(this), amount);
        } else {
            if(tx.origin==msg.sender){
                require(iERC20(token).transferTo(address(this), amount));
            }else{
                require(iERC20(token).transferFrom(msg.sender, address(this), amount));
            }
        }
    }

    //============================== HELPERS ================================//

    function DAO() public view returns(address){
        return iVADER(VADER).DAO();
    }
    function emitting() public view returns(bool){
        return iVADER(VADER).emitting();
    }
    function minting() public view returns(bool){
        return iVADER(VADER).minting();
    }

}