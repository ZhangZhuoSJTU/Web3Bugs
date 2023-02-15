pragma solidity =0.8.7;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import './interfaces/IAuction.sol';
import "./interfaces/IBasket.sol";
import "./interfaces/IFactory.sol";
import "hardhat/console.sol";

//TODO: add revert reasons or v8 custom errors back in
contract Basket is IBasket, ERC20Upgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    //TODO: recommend using block timestamp instead of block numbers here
    uint256 public constant TIMELOCK_DURATION = 1 days; // 1 day
    uint256 public constant ONE_YEAR = 365.25 days;
    uint256 private constant BASE = 1e18;

    uint256 public maxSupply;

    address public publisher;
    uint256 public licenseFee;

    IFactory public override factory;
    IAuction public override auction;

    uint256 public override ibRatio;

    PendingPublisher public pendingPublisher;
    PendingLicenseFee public pendingLicenseFee;
    PendingWeights public pendingWeights;
    PendingMaxSupply public pendingMaxSupply;

    address[] public tokens;
    uint256[] public weights;

    uint256 public override lastFee;

    bool public override initialized;

    function initialize(IFactory.Proposal memory proposal, IAuction auction_) external override {
        require(address(factory) == address(0));
        require(!initialized);

        publisher = proposal.proposer;
        licenseFee = proposal.licenseFee;
        factory = IFactory(msg.sender);
        auction = auction_;
        ibRatio = BASE;
        tokens = proposal.tokens;
        weights = proposal.weights;
        maxSupply = proposal.maxSupply;
        approveUnderlying(address(auction));

        __ERC20_init(proposal.tokenName, proposal.tokenSymbol);

        initialized = true;
    }

    function getPendingWeights() external override view returns (address[] memory, uint256[] memory, uint256) {
        return (pendingWeights.tokens, pendingWeights.weights, pendingWeights.minIbRatio);
    }

    function validateWeights(address[] memory _tokens, uint256[] memory _weights) public override pure {
        require(_tokens.length > 0);
        require(_tokens.length == _weights.length);
        uint256 length = _tokens.length;
        address[] memory tokenList = new address[](length);

        // check uniqueness of tokens and not token(0)

        for (uint i = 0; i < length; i++) {
            require(_tokens[i] != address(0));
            require(_weights[i] > 0);

            for (uint256 x = 0; x < tokenList.length; x++) {
                require(_tokens[i] != tokenList[x]);
            }

            tokenList[i] = _tokens[i];
        }
    }

    function mint(uint256 amount) public override {
        mintTo(amount, msg.sender);
    }

    function mintTo(uint256 amount, address to) public nonReentrant override {
        require(auction.auctionOngoing() == false);
        require(amount > 0);
        uint256 startSupply = totalSupply();
        require(startSupply + amount <= maxSupply);

        handleFees(startSupply);

        pullUnderlying(amount, msg.sender);

        _mint(to, amount);

        require(totalSupply() <= maxSupply);

        emit Minted(to, amount);
    }

    function burn(uint256 amount) public nonReentrant override {
        require(auction.auctionOngoing() == false);
        require(amount > 0);

        uint256 startSupply = totalSupply();
        handleFees(startSupply);

        pushUnderlying(amount, msg.sender);
        _burn(msg.sender, amount);
        
        emit Burned(msg.sender, amount);
    }

    function auctionBurn(uint256 amount) onlyAuction nonReentrant external override {
        uint256 startSupply = totalSupply();
        handleFees(startSupply);
        _burn(msg.sender, amount);

        uint256 newIbRatio = ibRatio * startSupply / (startSupply - amount);
        ibRatio = newIbRatio;

        emit NewIBRatio(newIbRatio);
        emit Burned(msg.sender, amount);
    }

    function handleFees(uint256 startSupply) private {
        if (lastFee == 0) {
            lastFee = block.timestamp;
        } else if (startSupply == 0) {
            return;
        } else {
            uint256 timeDiff = (block.timestamp - lastFee);
            uint256 feePct = timeDiff * licenseFee / ONE_YEAR;
            uint256 fee = startSupply * feePct / (BASE - feePct);


            _mint(publisher, fee * (BASE - factory.ownerSplit()) / BASE);
            _mint(Ownable(address(factory)).owner(), fee * factory.ownerSplit() / BASE);
            lastFee = block.timestamp;

            uint256 newIbRatio = ibRatio * startSupply / totalSupply();
            ibRatio = newIbRatio;

            emit NewIBRatio(ibRatio);
        }
    }

    // changes publisher
    // timelocked
    function changePublisher(address newPublisher) onlyPublisher public override {
        require(newPublisher != address(0));

        if (pendingPublisher.publisher != address(0) && pendingPublisher.publisher == newPublisher) {
            require(block.timestamp >= pendingPublisher.timestamp + TIMELOCK_DURATION);
            publisher = newPublisher;

            pendingPublisher.publisher = address(0);

            emit ChangedPublisher(publisher);
        } else {
            pendingPublisher.publisher = newPublisher;
            pendingPublisher.timestamp = block.timestamp;

            emit NewPublisherSubmitted(newPublisher);
        }
    }

    //changes licenseFee
    // timelocked
    function changeLicenseFee(uint256 newLicenseFee) onlyPublisher public override {
        require(newLicenseFee >= factory.minLicenseFee() && newLicenseFee != licenseFee);
        if (pendingLicenseFee.licenseFee != 0 && pendingLicenseFee.licenseFee == newLicenseFee) {
            require(block.timestamp >= pendingLicenseFee.timestamp + TIMELOCK_DURATION);
            licenseFee = newLicenseFee;

            pendingLicenseFee.licenseFee = 0;

            emit ChangedLicenseFee(licenseFee);
        } else {
            pendingLicenseFee.licenseFee = newLicenseFee;
            pendingLicenseFee.timestamp = block.timestamp;

            emit NewLicenseFeeSubmitted(newLicenseFee);
        }
    }

    //changes maxSupply
    // timelocked
    function setNewMaxSupply(uint256 newMaxSupply) onlyPublisher public override {
        require(newMaxSupply > totalSupply());

        if (pendingMaxSupply.maxSupply != 0 && pendingMaxSupply.maxSupply == newMaxSupply) {
            require(block.timestamp >= pendingMaxSupply.timestamp + TIMELOCK_DURATION);
            maxSupply = newMaxSupply;

            pendingMaxSupply.maxSupply = 0;

            emit ChangedMaxSupply(newMaxSupply);
        } else {
            pendingMaxSupply.maxSupply = newMaxSupply;
            pendingMaxSupply.timestamp = block.timestamp;

            emit NewMaxSupplySubmitted(newMaxSupply);
        }
    }

    // publish new index
    // timelocked
    function publishNewIndex(address[] memory _tokens, uint256[] memory _weights, uint256 _minIbRatio) onlyPublisher public override {
        validateWeights(_tokens, _weights);

        if (pendingWeights.pending) {
            require(block.timestamp >= pendingWeights.timestamp + TIMELOCK_DURATION);
            if (auction.auctionOngoing() == false) {
                auction.startAuction();

                emit PublishedNewIndex(publisher);
            } else if (auction.hasBonded()) {

            } else {
                auction.killAuction();

                pendingWeights.tokens = _tokens;
                pendingWeights.weights = _weights;
                pendingWeights.timestamp = block.timestamp;
                pendingWeights.minIbRatio = _minIbRatio;
            }
        } else {
            pendingWeights.pending = true;
            pendingWeights.tokens = _tokens;
            pendingWeights.weights = _weights;
            pendingWeights.timestamp = block.timestamp;
            pendingWeights.minIbRatio = _minIbRatio;

            emit NewIndexSubmitted();
        }
    }

    function setNewWeights() onlyAuction external override {
        tokens = pendingWeights.tokens;
        weights = pendingWeights.weights;
        pendingWeights.pending = false;

        approveUnderlying(address(auction));

        emit WeightsSet();
    }

    // delete pending index
    function deleteNewIndex() public override {
        require(msg.sender == publisher || msg.sender == address(auction));
        require(auction.auctionOngoing() == false);

        pendingWeights.pending = false;

        emit DeletedNewIndex(msg.sender);
    }

    function updateIBRatio(uint256 newRatio) onlyAuction external override returns (uint256) {
        ibRatio = newRatio;

        emit NewIBRatio(ibRatio);

        return ibRatio;
    }

    function approveUnderlying(address spender) private {
        for (uint256 i = 0; i < weights.length; i++) {
            IERC20(tokens[i]).safeApprove(spender, 0);
            IERC20(tokens[i]).safeApprove(spender, type(uint256).max);
        }
    }

    function pushUnderlying(uint256 amount, address to) private {
        for (uint256 i = 0; i < weights.length; i++) {
            uint256 tokenAmount = amount * weights[i] * ibRatio / BASE / BASE;
            IERC20(tokens[i]).safeTransfer(to, tokenAmount);
        }
    }

    function pullUnderlying(uint256 amount, address from) private {
        for (uint256 i = 0; i < weights.length; i++) {
            uint256 tokenAmount = amount * weights[i] * ibRatio / BASE / BASE;
            require(tokenAmount > 0);
            IERC20(tokens[i]).safeTransferFrom(from, address(this), tokenAmount);
        }
    }

    modifier onlyAuction() {
        require(msg.sender == address(auction));
        _;
    }

    modifier onlyPublisher() {
        require(msg.sender == address(publisher));
        _;
    }
}