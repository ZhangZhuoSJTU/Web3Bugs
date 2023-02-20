pragma solidity ^0.5.11;

import "./mocks/SortedDoublyLLFixture.sol";
import "./helpers/RevertProxy.sol";
import "./helpers/truffle/Assert.sol";

contract TestSortedDoublyLLRemove {
    address[] ids = [address(1), address(2), address(3), address(4), address(5), address(6)];
    uint256[] keys = [uint256(13), uint256(11), uint256(9), uint256(7), uint256(5), uint256(3)];

    SortedDoublyLLFixture fixture;
    RevertProxy proxy;

    function beforeAll() public {
        proxy = new RevertProxy();
    }

    function beforeEach() public {
        fixture = new SortedDoublyLLFixture();
        fixture.setMaxSize(10);
    }

    function test_remove() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));

        fixture.remove(ids[1]);
        Assert.equal(fixture.contains(ids[1]), false, "should not contain node");
        Assert.equal(fixture.getSize(), 2, "wrong size");
        Assert.equal(fixture.getNext(ids[0]), ids[2], "wrong next");
        Assert.equal(fixture.getPrev(ids[2]), ids[0], "wrong prev");
    }

    function test_remove_singleNode() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));

        fixture.remove(ids[0]);
        Assert.equal(fixture.contains(ids[0]), false, "should not contain node");
        Assert.equal(fixture.getSize(), 0, "wrong size");
        Assert.equal(fixture.getFirst(), address(0), "wrong head");
        Assert.equal(fixture.getLast(), address(0), "wrong tail");
    }

    function test_remove_head() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));

        fixture.remove(ids[0]);
        Assert.equal(fixture.contains(ids[0]), false, "should not contain node");
        Assert.equal(fixture.getSize(), 1, "wrong size");
        Assert.equal(fixture.getFirst(), ids[1], "wrong head");
        Assert.equal(fixture.getPrev(ids[1]), address(0), "wrong prev");
    }

    function test_remove_tail() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));

        fixture.remove(ids[1]);
        Assert.equal(fixture.contains(ids[1]), false, "should not contain node");
        Assert.equal(fixture.getSize(), 1, "wrong size");
        Assert.equal(fixture.getLast(), ids[0], "wrong prev");
        Assert.equal(fixture.getNext(ids[0]), address(0), "wrong next");
    }

    function test_remove_notInList() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));

        SortedDoublyLLFixture(address(proxy)).remove(ids[1]);
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }
}
