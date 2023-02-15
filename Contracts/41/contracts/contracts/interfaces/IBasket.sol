pragma solidity =0.8.7;

import "./IAuction.sol";

interface IBasket {
    struct PendingPublisher {
        address publisher;
        uint256 block;
    }

    struct PendingLicenseFee {
        uint256 licenseFee;
        uint256 block;
    }

    struct PendingWeights {
        address[] tokens;
        uint256[] weights;
        uint256 block;
        bool pending;
    }

    function initialize(IFactory.Proposal memory, IAuction) external;
    function mint(uint256) external;
    function mintTo(uint256, address) external;
    function burn(uint256) external;
    function changePublisher(address) external;
    function changeLicenseFee(uint256) external;
    function publishNewIndex(address[] calldata, uint256[] calldata) external;
    function deleteNewIndex() external;
    function auctionBurn(uint256) external;
    function updateIBRatio(uint256) external returns (uint256);
    function setNewWeights() external;
    function validateWeights(address[] memory, uint256[] memory) external pure;
    function initialized() external view returns (bool);

    function ibRatio() external view returns (uint256);
    function getPendingWeights() external view returns (address[] memory, uint256[] memory);
    function factory() external view returns (IFactory);
    function auction() external view returns (IAuction);
    function lastFee() external view returns (uint256);


    // TODO: none of these are used
    event Minted(address indexed _to, uint256 _amount);
    event Burned(address indexed _from, uint256 _amount);
    event ChangedPublisher(address indexed _newPublisher);
    event ChangedLicenseFee(uint256 _newLicenseFee);
    event NewPublisherSubmitted(address indexed _newPublisher);
    event NewLicenseFeeSubmitted(uint256 _newLicenseFee);
    event NewIndexSubmitted();
    event PublishedNewIndex(address _publisher);
    event DeletedNewIndex(address _publisher);
    event WeightsSet();
    event NewIBRatio(uint256);
}