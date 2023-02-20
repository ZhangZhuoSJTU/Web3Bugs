// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./Pool.sol";  
import "./interfaces/iPOOLFACTORY.sol";

contract Synth is iBEP20 {
    address public BASE;
    address public LayerONE; // Underlying relevant layer1 token
    uint public genesis;
    address public DEPLOYER;

    string _name; string _symbol;
    uint8 public override decimals; uint256 public override totalSupply;

    mapping(address => uint) private _balances;
    mapping(address => mapping(address => uint)) private _allowances;
    mapping(address => uint) public mapSynth_LPBalance;
    mapping(address => uint) public mapSynth_LPDebt;
   
    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }
    
    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == DEPLOYER, "!DAO");
        _;
    }

    // Restrict access
    modifier onlyPool() {
        require(iPOOLFACTORY(_DAO().POOLFACTORY()).isCuratedPool(msg.sender) == true, "!curated");
        _;
    }
    
    constructor (address _base, address _token) {
        BASE = _base;
        LayerONE = _token;
        string memory synthName = "-SpartanProtocolSynthetic";
        string memory synthSymbol = "-SPS";
        _name = string(abi.encodePacked(iBEP20(_token).name(), synthName));
        _symbol = string(abi.encodePacked(iBEP20(_token).symbol(), synthSymbol));
        decimals = iBEP20(_token).decimals();
        DEPLOYER = msg.sender;
        genesis = block.timestamp;
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

    // iBEP20 Transfer function
    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    // iBEP20 Approve, change allowance functions
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
    
    // iBEP20 TransferFrom function
    function transferFrom(address sender, address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        // Unlimited approval (saves an SSTORE)
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

    // Internal transfer function
    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        require(sender != address(0), "!sender");
        uint256 senderBalance = _balances[sender];
        require(senderBalance >= amount, "!balance");
        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    // Internal mint (upgrading and daily emissions)
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "!account");
        totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    // Burn supply
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

    //==================================== SYNTH FUNCTIONS =================================//

    // Handle received LP tokens and mint Synths
    function mintSynth(address member, uint amount) external onlyPool returns (uint syntheticAmount){
        uint lpUnits = _getAddedLPAmount(msg.sender); // Get the received LP units
        mapSynth_LPDebt[msg.sender] += amount; // Increase debt by synth amount
        mapSynth_LPBalance[msg.sender] += lpUnits; // Increase lp balance by LPs received
        _mint(member, amount); // Mint the synths & tsf to user
        return amount;
    }
    
    // Handle received Synths and burn the LPs and Synths
    function burnSynth() external returns (bool){
        uint _syntheticAmount = balanceOf(address(this)); // Get the received synth units
        uint _amountUnits = (_syntheticAmount * mapSynth_LPBalance[msg.sender]) / mapSynth_LPDebt[msg.sender]; // share = amount * part/total
        mapSynth_LPBalance[msg.sender] -= _amountUnits; // Reduce lp balance
        mapSynth_LPDebt[msg.sender] -= _syntheticAmount; // Reduce debt by synths being burnt
        if(_amountUnits > 0){
            _burn(address(this), _syntheticAmount); // Burn the synths
            Pool(msg.sender).burn(_amountUnits); // Burn the LP tokens
        }
        return true;
    }

    // Burn LPs to if their value outweights the synths supply value (Ensures incentives are funnelled to existing LPers)
    function realise(address pool) external {
        uint baseValueLP = iUTILS(_DAO().UTILS()).calcLiquidityHoldings(mapSynth_LPBalance[pool], BASE, pool); // Get the SPARTA value of the LP tokens
        uint baseValueSynth = iUTILS(_DAO().UTILS()).calcActualSynthUnits(mapSynth_LPDebt[pool], address(this)); // Get the SPARTA value of the synths
        if(baseValueLP > baseValueSynth){
            uint premium = baseValueLP - baseValueSynth; // Get the premium between the two values
            if(premium > 10**18){
                uint premiumLP = iUTILS(_DAO().UTILS()).calcLiquidityUnitsAsym(premium, pool); // Get the LP value of the premium
                mapSynth_LPBalance[pool] -= premiumLP; // Reduce the LP balance
                Pool(pool).burn(premiumLP); // Burn the premium of the LP tokens
            }
        }
    }

    // Check the received token amount
    function _handleTransferIn(address _token, uint256 _amount) internal returns(uint256 _actual){
        if(_amount > 0) {
            uint startBal = iBEP20(_token).balanceOf(address(this)); // Get existing balance
            iBEP20(_token).transferFrom(msg.sender, address(this), _amount); // Transfer tokens in
            _actual = iBEP20(_token).balanceOf(address(this)) - startBal; // Calculate received amount
        }
        return _actual;
    }

    // Check the received LP tokens amount
    function _getAddedLPAmount(address _pool) internal view returns(uint256 _actual){
        uint _lpCollateralBalance = iBEP20(_pool).balanceOf(address(this)); // Get total balance held
        if(_lpCollateralBalance > mapSynth_LPBalance[_pool]){
            _actual = _lpCollateralBalance - mapSynth_LPBalance[_pool]; // Get received amount
        } else {
            _actual = 0;
        }
        return _actual;
    }

    function getmapAddress_LPBalance(address pool) external view returns (uint){
        return mapSynth_LPBalance[pool];
    }

    function getmapAddress_LPDebt(address pool) external view returns (uint){
        return mapSynth_LPDebt[pool];
    }
}
