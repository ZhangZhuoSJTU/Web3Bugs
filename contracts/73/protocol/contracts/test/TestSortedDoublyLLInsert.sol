pragma solidity ^0.5.11;

import "./mocks/SortedDoublyLLFixture.sol";
import "./helpers/RevertProxy.sol";
import "./helpers/truffle/Assert.sol";

contract TestSortedDoublyLLInsert {
    address[] ids = [address(1), address(2), address(3), address(4), address(5), address(6)];
    uint256[] keys = [uint256(13), uint256(11), uint256(9), uint256(7), uint256(5), uint256(5), uint256(3)];

    SortedDoublyLLFixture fixture;
    RevertProxy proxy;

    function beforeAll() public {
        proxy = new RevertProxy();
    }

    function beforeEach() public {
        fixture = new SortedDoublyLLFixture();
        fixture.setMaxSize(3);
    }

    function test_setMaxSize() public {
        Assert.equal(fixture.getMaxSize(), 3, "wrong max size");
    }

    function test_setMaxSize_update() public {
        fixture.setMaxSize(10);

        Assert.equal(fixture.getMaxSize(), 10, "wrong max size");
    }

    function test_setMaxSize_decreaseSize() public {
        SortedDoublyLLFixture(address(proxy)).setMaxSize(1);
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }

    function test_insert_empty() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        Assert.equal(fixture.getSize(), 1, "wrong size");
        Assert.equal(fixture.getFirst(), ids[0], "wrong head");
        Assert.equal(fixture.getLast(), ids[0], "wrong tail");
        Assert.equal(fixture.getKey(ids[0]), keys[0], "wrong key");
        Assert.equal(fixture.getNext(ids[0]), address(0), "wrong next");
        Assert.equal(fixture.getPrev(ids[0]), address(0), "wrong prev");
    }

    function test_insert_updateHead() public {
        fixture.insert(ids[1], keys[1], address(0), address(0));

        fixture.insert(ids[0], keys[0], address(0), ids[1]);
        Assert.equal(fixture.getSize(), 2, "wrong size");
        Assert.equal(fixture.getFirst(), ids[0], "wrong head");
        Assert.equal(fixture.getKey(ids[0]), keys[0], "wrong key");
        Assert.equal(fixture.getNext(ids[0]), ids[1], "wrong next");
        Assert.equal(fixture.getPrev(ids[0]), address(0), "wrong prev");
    }

    function test_insert_updateTail() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));

        fixture.insert(ids[1], keys[1], ids[0], address(0));
        Assert.equal(fixture.getSize(), 2, "wrong size");
        Assert.equal(fixture.getLast(), ids[1], "wrong tail");
        Assert.equal(fixture.getKey(ids[1]), keys[1], "wrong key");
        Assert.equal(fixture.getNext(ids[1]), address(0), "wrong next");
        Assert.equal(fixture.getPrev(ids[1]), ids[0], "wrong prev");
    }

    function test_insert_atPosition() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[2], keys[2], ids[0], address(0));

        fixture.insert(ids[1], keys[1], ids[0], ids[2]);
        Assert.equal(fixture.getSize(), 3, "wrong size");
        Assert.equal(fixture.getKey(ids[1]), keys[1], "wrong stake");
        Assert.equal(fixture.getNext(ids[1]), ids[2], "wrong next transcoder");
        Assert.equal(fixture.getPrev(ids[1]), ids[0], "wrong prev transcoder");
    }

    function test_insert_full() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));

        SortedDoublyLLFixture(address(proxy)).insert(ids[3], keys[3], address(0), address(0));
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }

    function test_insert_containsId() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));

        SortedDoublyLLFixture(address(proxy)).insert(ids[0], keys[0], address(0), address(0));
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }

    function test_insert_null() public {
        SortedDoublyLLFixture(address(proxy)).insert(address(0), keys[0], address(0), address(0));
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }

    function test_insert_zeroKey() public {
        SortedDoublyLLFixture(address(proxy)).insert(ids[0], 0, address(0), address(0));
        bool result = proxy.execute(address(fixture));
        Assert.isFalse(result, "did not revert");
    }
}
