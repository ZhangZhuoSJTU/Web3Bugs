pragma solidity ^0.5.11;

import "./mocks/SortedDoublyLLFixture.sol";
import "./helpers/truffle/Assert.sol";

contract TestSortedDoublyLLFindWithHints {
    address[] ids = [address(1), address(2), address(3), address(4), address(5), address(6)];
    uint256[] keys = [uint256(13), uint256(11), uint256(9), uint256(7), uint256(5), uint256(3)];

    SortedDoublyLLFixture fixture;

    function beforeEach() public {
        fixture = new SortedDoublyLLFixture();
        fixture.setMaxSize(10);
    }

    function test_insert_findNoHintUpdateHead() public {
        fixture.insert(ids[1], keys[1], address(0), address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[3], keys[3], ids[2], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[0], keys[0], address(0), address(0));
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getFirst(), ids[0], "wrong head");
        Assert.equal(fixture.getKey(ids[0]), keys[0], "wrong key");
        Assert.equal(fixture.getNext(ids[0]), ids[1], "wrong next");
        Assert.equal(fixture.getPrev(ids[0]), address(0), "wrong prev");
    }

    function test_insert_findNoHintUpdateTail() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[3], keys[3], ids[2], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));

        fixture.insert(ids[5], keys[5], address(0), address(0));
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getLast(), ids[5], "wrong tail");
        Assert.equal(fixture.getKey(ids[5]), keys[5], "wrong key");
        Assert.equal(fixture.getNext(ids[5]), address(0), "wrong next transcoder");
        Assert.equal(fixture.getPrev(ids[5]), ids[4], "wrong prev transcoder");
    }

    function test_insert_findNoHintAtPosition() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[3], keys[3], ids[1], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[2], keys[2], address(0), address(0));
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getKey(ids[2]), keys[2], "wrong");
        Assert.equal(fixture.getNext(ids[2]), ids[3], "wrong next");
        Assert.equal(fixture.getPrev(ids[2]), ids[1], "wrong prev");
    }

    function test_insert_findWithHintNextUpdateHead() public {
        fixture.insert(ids[1], keys[1], address(0), address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[3], keys[3], ids[2], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[0], keys[0], address(0), ids[2]);
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getFirst(), ids[0], "wrong head");
        Assert.equal(fixture.getKey(ids[0]), keys[0], "wrong key");
        Assert.equal(fixture.getNext(ids[0]), ids[1], "wrong next");
        Assert.equal(fixture.getPrev(ids[0]), address(0), "wrong prev");
    }

    function test_insert_findWithHintNextUpdateTail() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[3], keys[3], ids[2], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[1], 3, address(0), ids[5]);
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getLast(), ids[1], "wrong tail");
        Assert.equal(fixture.getKey(ids[1]), 3, "wrong key");
        Assert.equal(fixture.getNext(ids[1]), address(0), "wrong next");
        Assert.equal(fixture.getPrev(ids[1]), ids[5], "wrong prev");
    }

    function test_insert_findWithHintNextAtPosition() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[3], keys[3], ids[1], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[2], keys[2], address(0), ids[3]);
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getKey(ids[2]), keys[2], "wrong key");
        Assert.equal(fixture.getNext(ids[2]), ids[3], "wrong next");
        Assert.equal(fixture.getPrev(ids[2]), ids[1], "wrong prev");
    }

    function test_insert_findWithHintPrevUpdateTail() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[3], keys[3], ids[1], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));

        fixture.insert(ids[5], keys[5], ids[1], address(0));
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getLast(), ids[5], "wrong tail");
        Assert.equal(fixture.getKey(ids[5]), keys[5], "wrong key");
        Assert.equal(fixture.getNext(ids[5]), address(0), "wrong next");
        Assert.equal(fixture.getPrev(ids[5]), ids[4], "wrong prev");
    }

    function test_insert_findWithHintPrevAtPosition() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[3], keys[3], ids[1], address(0));
        fixture.insert(ids[4], keys[4], ids[3], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[2], keys[2], ids[0], address(0));
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getKey(ids[2]), keys[2], "wrong key");
        Assert.equal(fixture.getNext(ids[2]), ids[3], "wrong next");
        Assert.equal(fixture.getPrev(ids[2]), ids[1], "wrong prev");
    }

    function test_insert_findWithHint() public {
        fixture.insert(ids[0], keys[0], address(0), address(0));
        fixture.insert(ids[1], keys[1], ids[0], address(0));
        fixture.insert(ids[2], keys[2], ids[1], address(0));
        fixture.insert(ids[4], keys[4], ids[2], address(0));
        fixture.insert(ids[5], keys[5], ids[4], address(0));

        fixture.insert(ids[3], keys[3], ids[2], ids[4]);
        Assert.equal(fixture.getSize(), 6, "wrong size");
        Assert.equal(fixture.getKey(ids[3]), keys[3], "wrong key");
        Assert.equal(fixture.getNext(ids[3]), ids[4], "wrong next");
        Assert.equal(fixture.getPrev(ids[3]), ids[2], "wrong prev");
    }
}
