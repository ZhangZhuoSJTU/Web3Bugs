// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iBEP20.sol";
import "./interfaces/iUTILS.sol";
import "./interfaces/iDAO.sol";
import "./interfaces/iBASE.sol";
import "./interfaces/iDAOVAULT.sol";
import "./interfaces/iROUTER.sol";
import "./interfaces/iSYNTH.sol"; 
import "./interfaces/iSYNTHFACTORY.sol"; 
import "./interfaces/iBEP677.sol"; 

contract Pool is iBEP20 {  
    address public BASE;
    address public TOKEN;
    address public DEPLOYER;

    string _name; string _symbol;
    uint8 public override decimals; uint256 public override totalSupply;
    mapping(address => uint) private _balances;
    mapping(address => mapping(address => uint)) private _allowances;

    uint256 public baseAmount; // SPARTA amount that should be in the pool
    uint256 public tokenAmount; // TOKEN amount that should be in the pool

    uint private lastMonth; // Timestamp of the start of current metric period (For UI)
    uint public genesis; // Timestamp from when the pool was first deployed (For UI)

    uint256 public map30DPoolRevenue; // Tally of revenue during current incomplete metric period (for UI)
    uint256 public mapPast30DPoolRevenue; // Tally of revenue from last full metric period (for UI)
    uint256 [] public revenueArray; // Array of the last two metric periods (For UI)

    event AddLiquidity(address indexed member, uint inputBase, uint inputToken, uint unitsIssued);
    event RemoveLiquidity(address indexed member, uint outputBase, uint outputToken, uint unitsClaimed);
    event Swapped(address indexed tokenFrom, address indexed tokenTo, address indexed recipient, uint inputAmount, uint outputAmount, uint fee);
    event MintSynth(address indexed member, address indexed base, uint256 baseAmount, address indexed token, uint256 synthAmount);
    event BurnSynth(address indexed member, address indexed base, uint256 baseAmount, address indexed token, uint256 synthAmount);

    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }

    constructor (address _base, address _token) {
        BASE = _base;
        TOKEN = _token;
        string memory poolName = "-SpartanProtocolPool";
        string memory poolSymbol = "-SPP";
        _name = string(abi.encodePacked(iBEP20(_token).name(), poolName));
        _symbol = string(abi.encodePacked(iBEP20(_token).symbol(), poolSymbol));
        decimals = 18;
        genesis = block.timestamp;
        DEPLOYER = msg.sender;
        lastMonth = 0;
    }

    //========================================iBEP20=========================================//

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external virtual returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender]+(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external virtual returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "!approval");
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "!owner");
        require(spender != address(0), "!spender");
        if (_allowances[owner][spender] < type(uint256).max) { // No need to re-approve if already max
            _allowances[owner][spender] = amount;
            emit Approval(owner, spender, amount);
        }
    }

    function transferFrom(address sender, address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        // Max approval (saves an SSTORE)
        if (_allowances[sender][msg.sender] < type(uint256).max) {
            uint256 currentAllowance = _allowances[sender][msg.sender];
            require(currentAllowance >= amount, "!approval");
            _approve(sender, msg.sender, currentAllowance - amount);
        }
        return true;
    }

    //iBEP677 approveAndCall
    function approveAndCall(address recipient, uint amount, bytes calldata data) external returns (bool) {
      _approve(msg.sender, recipient, type(uint256).max); // Give recipient max approval
      iBEP677(recipient).onTokenApproval(address(this), amount, msg.sender, data); // Amount is passed thru to recipient
      return true;
    }

    //iBEP677 transferAndCall
    function transferAndCall(address recipient, uint amount, bytes calldata data) external returns (bool) {
      _transfer(msg.sender, recipient, amount);
      iBEP677(recipient).onTokenTransfer(address(this), amount, msg.sender, data); // Amount is passed thru to recipient 
      return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "!sender");
        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "!balance");
        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "!account");
        totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function burn(uint256 amount) external virtual override {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external virtual {  
        uint256 decreasedAllowance = allowance(account, msg.sender) - (amount);
        _approve(account, msg.sender, decreasedAllowance); 
        _burn(account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "!account");
        require(_balances[account] >= amount, "!balance");
        _balances[account] -= amount;
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    //====================================POOL FUNCTIONS =================================//

    // User adds liquidity to the pool
    function add() external returns(uint liquidityUnits){
        liquidityUnits = addForMember(msg.sender);
        return liquidityUnits;
    }

    // Contract adds liquidity for user 
    function addForMember(address member) public returns(uint liquidityUnits){
        uint256 _actualInputBase = _getAddedBaseAmount(); // Get the received SPARTA amount
        uint256 _actualInputToken = _getAddedTokenAmount(); // Get the received TOKEN amount
        if(baseAmount == 0 || tokenAmount == 0){
        require(_actualInputBase != 0 && _actualInputToken != 0, "!Balanced");
        }
        liquidityUnits = iUTILS(_DAO().UTILS()).calcLiquidityUnits(_actualInputBase, baseAmount, _actualInputToken, tokenAmount, totalSupply); // Calculate LP tokens to mint
        _incrementPoolBalances(_actualInputBase, _actualInputToken); // Update recorded BASE and TOKEN amounts
        _mint(member, liquidityUnits); // Mint the LP tokens directly to the user
        emit AddLiquidity(member, _actualInputBase, _actualInputToken, liquidityUnits);
        return liquidityUnits;
    }
    
    // User removes liquidity from the pool 
    function remove() external returns (uint outputBase, uint outputToken) {
        return removeForMember(msg.sender);
    } 

    // Contract removes liquidity for the user
    function removeForMember(address member) public returns (uint outputBase, uint outputToken) {
        uint256 _actualInputUnits = balanceOf(address(this)); // Get the received LP units amount
        outputBase = iUTILS(_DAO().UTILS()).calcLiquidityHoldings(_actualInputUnits, BASE, address(this)); // Get the SPARTA value of LP units
        outputToken = iUTILS(_DAO().UTILS()).calcLiquidityHoldings(_actualInputUnits, TOKEN, address(this)); // Get the TOKEN value of LP units
        _decrementPoolBalances(outputBase, outputToken); // Update recorded BASE and TOKEN amounts
        _burn(address(this), _actualInputUnits); // Burn the LP tokens
        iBEP20(BASE).transfer(member, outputBase); // Transfer the SPARTA to user
        iBEP20(TOKEN).transfer(member, outputToken); // Transfer the TOKENs to user
        emit RemoveLiquidity(member, outputBase, outputToken, _actualInputUnits);
        return (outputBase, outputToken);
    }

    // Caller swaps tokens
    function swap(address token) external returns (uint outputAmount, uint fee){
        (outputAmount, fee) = swapTo(token, msg.sender);
        return (outputAmount, fee);
    }

    // Contract swaps tokens for the member
    function swapTo(address token, address member) public payable returns (uint outputAmount, uint fee) {
        require((token == BASE || token == TOKEN), "!BASE||TOKEN"); // Must be SPARTA or the pool's relevant TOKEN
        address _fromToken; uint _amount;
        if(token == BASE){
            _fromToken = TOKEN; // If SPARTA is selected; swap from TOKEN
            _amount = _getAddedTokenAmount(); // Get the received TOKEN amount
            (outputAmount, fee) = _swapTokenToBase(_amount); // Calculate the SPARTA output from the swap
        } else {
            _fromToken = BASE; // If TOKEN is selected; swap from SPARTA
            _amount = _getAddedBaseAmount(); // Get the received SPARTA amount
            (outputAmount, fee) = _swapBaseToToken(_amount); // Calculate the TOKEN output from the swap
        }
        emit Swapped(_fromToken, token, member, _amount, outputAmount, fee);
        iBEP20(token).transfer(member, outputAmount); // Transfer the swap output to the selected user
        return (outputAmount, fee);
    }

    // Swap SPARTA for Synths
    function mintSynth(address synthOut, address member) external returns(uint outputAmount, uint fee) {
        require(iSYNTHFACTORY(_DAO().SYNTHFACTORY()).isSynth(synthOut) == true, "!synth"); // Must be a valid Synth
        uint256 _actualInputBase = _getAddedBaseAmount(); // Get received SPARTA amount
        uint output = iUTILS(_DAO().UTILS()).calcSwapOutput(_actualInputBase, baseAmount, tokenAmount); // Calculate value of swapping SPARTA to the relevant underlying TOKEN
        uint _liquidityUnits = iUTILS(_DAO().UTILS()).calcLiquidityUnitsAsym(_actualInputBase, address(this)); // Calculate LP tokens to be minted
        _incrementPoolBalances(_actualInputBase, 0); // Update recorded SPARTA amount
        uint _fee = iUTILS(_DAO().UTILS()).calcSwapFee(_actualInputBase, baseAmount, tokenAmount); // Calc slip fee in TOKEN
        fee = iUTILS(_DAO().UTILS()).calcSpotValueInBase(TOKEN, _fee); // Convert TOKEN fee to SPARTA
        _mint(synthOut, _liquidityUnits); // Mint the LP tokens directly to the Synth contract to hold
        iSYNTH(synthOut).mintSynth(member, output); // Mint the Synth tokens directly to the user
        _addPoolMetrics(fee); // Add slip fee to the revenue metrics
        emit MintSynth(member, BASE, _actualInputBase, TOKEN, outputAmount);
      return (output, fee);
    }
    
    // Swap Synths for SPARTA
    function burnSynth(address synthIN, address member) external returns(uint outputAmount, uint fee) {
        require(iSYNTHFACTORY(_DAO().SYNTHFACTORY()).isSynth(synthIN) == true, "!synth"); // Must be a valid Synth
        uint _actualInputSynth = iBEP20(synthIN).balanceOf(address(this)); // Get received SYNTH amount
        uint outputBase = iUTILS(_DAO().UTILS()).calcSwapOutput(_actualInputSynth, tokenAmount, baseAmount); // Calculate value of swapping relevant underlying TOKEN to SPARTA
        fee = iUTILS(_DAO().UTILS()).calcSwapFee(_actualInputSynth, tokenAmount, baseAmount); // Calc slip fee in SPARTA
        iBEP20(synthIN).transfer(synthIN, _actualInputSynth); // Transfer SYNTH to relevant synth contract
        iSYNTH(synthIN).burnSynth(); // Burn the SYNTH units
        _decrementPoolBalances(outputBase, 0); // Update recorded SPARTA amount
        iBEP20(BASE).transfer(member, outputBase); // Transfer SPARTA to user
        _addPoolMetrics(fee); // Add slip fee to the revenue metrics
        emit BurnSynth(member, BASE, outputBase, TOKEN, _actualInputSynth);
      return (outputBase, fee);
    }

    //=======================================INTERNAL MATHS======================================//

    // Check the SPARTA amount received by this Pool
    function _getAddedBaseAmount() internal view returns(uint256 _actual){
        uint _baseBalance = iBEP20(BASE).balanceOf(address(this)); 
        if(_baseBalance > baseAmount){
            _actual = _baseBalance-(baseAmount);
        } else {
            _actual = 0;
        }
        return _actual;
    }
  
    // Check the TOKEN amount received by this Pool
    function _getAddedTokenAmount() internal view returns(uint256 _actual){
        uint _tokenBalance = iBEP20(TOKEN).balanceOf(address(this)); 
        if(_tokenBalance > tokenAmount){
            _actual = _tokenBalance-(tokenAmount);
        } else {
            _actual = 0;
        }
        return _actual;
    }

    // Calculate output of swapping SPARTA for TOKEN & update recorded amounts
    function _swapBaseToToken(uint256 _x) internal returns (uint256 _y, uint256 _fee){
        uint256 _X = baseAmount;
        uint256 _Y = tokenAmount;
        _y =  iUTILS(_DAO().UTILS()).calcSwapOutput(_x, _X, _Y); // Calc TOKEN output
        uint fee = iUTILS(_DAO().UTILS()).calcSwapFee(_x, _X, _Y); // Calc TOKEN fee
        _fee = iUTILS(_DAO().UTILS()).calcSpotValueInBase(TOKEN, fee); // Convert TOKEN fee to SPARTA
        _setPoolAmounts(_X + _x, _Y - _y); // Update recorded BASE and TOKEN amounts
        _addPoolMetrics(_fee); // Add slip fee to the revenue metrics
        return (_y, _fee);
    }

    // Calculate output of swapping TOKEN for SPARTA & update recorded amounts
    function _swapTokenToBase(uint256 _x) internal returns (uint256 _y, uint256 _fee){
        uint256 _X = tokenAmount;
        uint256 _Y = baseAmount;
        _y =  iUTILS(_DAO().UTILS()).calcSwapOutput(_x, _X, _Y); // Calc SPARTA output
        _fee = iUTILS(_DAO().UTILS()).calcSwapFee(_x, _X, _Y); // Calc SPARTA fee
        _setPoolAmounts(_Y - _y, _X + _x); // Update recorded BASE and TOKEN amounts
        _addPoolMetrics(_fee); // Add slip fee to the revenue metrics
        return (_y, _fee);
    }

    //=======================================BALANCES=========================================//

    // Sync internal balances to actual
    function sync() external {
        baseAmount = iBEP20(BASE).balanceOf(address(this));
        tokenAmount = iBEP20(TOKEN).balanceOf(address(this));
    }

    // Increment internal balances
    function _incrementPoolBalances(uint _baseAmount, uint _tokenAmount) internal  {
        baseAmount += _baseAmount;
        tokenAmount += _tokenAmount;
    }

    // Set internal balances
    function _setPoolAmounts(uint256 _baseAmount, uint256 _tokenAmount) internal  {
        baseAmount = _baseAmount;
        tokenAmount = _tokenAmount; 
    }

    // Decrement internal balances
    function _decrementPoolBalances(uint _baseAmount, uint _tokenAmount) internal  {
        baseAmount -= _baseAmount;
        tokenAmount -= _tokenAmount; 
    }

    //===========================================POOL FEE ROI=================================//

    function _addPoolMetrics(uint256 _fee) internal {
        if(lastMonth == 0){
            lastMonth = block.timestamp;
        }
        if(block.timestamp <= lastMonth + 2592000){ // 30Days
            map30DPoolRevenue = map30DPoolRevenue+(_fee);
        } else {
            lastMonth = block.timestamp;
            mapPast30DPoolRevenue = map30DPoolRevenue;
            addRevenue(mapPast30DPoolRevenue);
            map30DPoolRevenue = 0;
            map30DPoolRevenue = map30DPoolRevenue+(_fee);
        }
    }

    function addRevenue(uint _totalRev) internal {
        if(!(revenueArray.length == 2)){
            revenueArray.push(_totalRev);
        } else {
            addFee(_totalRev);
        }
    }

    function addFee(uint _rev) internal {
        uint _n = revenueArray.length; // 2
        for (uint i = _n - 1; i > 0; i--) {
            revenueArray[i] = revenueArray[i - 1];
        }
        revenueArray[0] = _rev;
    }
}
