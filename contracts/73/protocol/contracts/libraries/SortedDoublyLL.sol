pragma solidity ^0.5.11;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title A sorted doubly linked list with nodes sorted in descending order. Optionally accepts insert position hints
 *
 * Given a new node with a `key`, a hint is of the form `(prevId, nextId)` s.t. `prevId` and `nextId` are adjacent in the list.
 * `prevId` is a node with a key >= `key` and `nextId` is a node with a key <= `key`. If the sender provides a hint that is a valid insert position
 * the insert operation is a constant time storage write. However, the provided hint in a given transaction might be a valid insert position, but if other transactions are included first, when
 * the given transaction is executed the provided hint may no longer be a valid insert position. For example, one of the nodes referenced might be removed or their keys may
 * be updated such that the the pair of nodes in the hint no longer represent a valid insert position. If one of the nodes in the hint becomes invalid, we still try to use the other
 * valid node as a starting point for finding the appropriate insert position. If both nodes in the hint become invalid, we use the head of the list as a starting point
 * to find the appropriate insert position.
 */
library SortedDoublyLL {
    using SafeMath for uint256;

    // Information for a node in the list
    struct Node {
        uint256 key; // Node's key used for sorting
        address nextId; // Id of next node (smaller key) in the list
        address prevId; // Id of previous node (larger key) in the list
    }

    // Information for the list
    struct Data {
        address head; // Head of the list. Also the node in the list with the largest key
        address tail; // Tail of the list. Also the node in the list with the smallest key
        uint256 maxSize; // Maximum size of the list
        uint256 size; // Current size of the list
        mapping(address => Node) nodes; // Track the corresponding ids for each node in the list
    }

    /**
     * @dev Set the maximum size of the list
     * @param _size Maximum size
     */
    function setMaxSize(Data storage self, uint256 _size) public {
        require(_size > self.maxSize, "new max size must be greater than old max size");

        self.maxSize = _size;
    }

    /**
     * @dev Add a node to the list
     * @param _id Node's id
     * @param _key Node's key
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function insert(
        Data storage self,
        address _id,
        uint256 _key,
        address _prevId,
        address _nextId
    ) public {
        // List must not be full
        require(!isFull(self), "list is full");
        // List must not already contain node
        require(!contains(self, _id), "node already in list");
        // Node id must not be null
        require(_id != address(0), "node id is null");
        // Key must be non-zero
        require(_key > 0, "key is zero");

        address prevId = _prevId;
        address nextId = _nextId;

        if (!validInsertPosition(self, _key, prevId, nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (prevId, nextId) = findInsertPosition(self, _key, prevId, nextId);
        }

        self.nodes[_id].key = _key;

        if (prevId == address(0) && nextId == address(0)) {
            // Insert as head and tail
            self.head = _id;
            self.tail = _id;
        } else if (prevId == address(0)) {
            // Insert before `prevId` as the head
            self.nodes[_id].nextId = self.head;
            self.nodes[self.head].prevId = _id;
            self.head = _id;
        } else if (nextId == address(0)) {
            // Insert after `nextId` as the tail
            self.nodes[_id].prevId = self.tail;
            self.nodes[self.tail].nextId = _id;
            self.tail = _id;
        } else {
            // Insert at insert position between `prevId` and `nextId`
            self.nodes[_id].nextId = nextId;
            self.nodes[_id].prevId = prevId;
            self.nodes[prevId].nextId = _id;
            self.nodes[nextId].prevId = _id;
        }

        self.size = self.size.add(1);
    }

    /**
     * @dev Remove a node from the list
     * @param _id Node's id
     */
    function remove(Data storage self, address _id) public {
        // List must contain the node
        require(contains(self, _id), "node not in list");

        if (self.size > 1) {
            // List contains more than a single node
            if (_id == self.head) {
                // The removed node is the head
                // Set head to next node
                self.head = self.nodes[_id].nextId;
                // Set prev pointer of new head to null
                self.nodes[self.head].prevId = address(0);
            } else if (_id == self.tail) {
                // The removed node is the tail
                // Set tail to previous node
                self.tail = self.nodes[_id].prevId;
                // Set next pointer of new tail to null
                self.nodes[self.tail].nextId = address(0);
            } else {
                // The removed node is neither the head nor the tail
                // Set next pointer of previous node to the next node
                self.nodes[self.nodes[_id].prevId].nextId = self.nodes[_id].nextId;
                // Set prev pointer of next node to the previous node
                self.nodes[self.nodes[_id].nextId].prevId = self.nodes[_id].prevId;
            }
        } else {
            // List contains a single node
            // Set the head and tail to null
            self.head = address(0);
            self.tail = address(0);
        }

        delete self.nodes[_id];
        self.size = self.size.sub(1);
    }

    /**
     * @dev Update the key of a node in the list
     * @param _id Node's id
     * @param _newKey Node's new key
     * @param _prevId Id of previous node for the new insert position
     * @param _nextId Id of next node for the new insert position
     */
    function updateKey(
        Data storage self,
        address _id,
        uint256 _newKey,
        address _prevId,
        address _nextId
    ) public {
        // List must contain the node
        require(contains(self, _id), "node not in list");

        // Remove node from the list
        remove(self, _id);

        if (_newKey > 0) {
            // Insert node if it has a non-zero key
            insert(self, _id, _newKey, _prevId, _nextId);
        }
    }

    /**
     * @dev Checks if the list contains a node
     * @param _id Address of transcoder
     * @return true if '_id' is in list
     */
    function contains(Data storage self, address _id) public view returns (bool) {
        // List only contains non-zero keys, so if key is non-zero the node exists
        return self.nodes[_id].key > 0;
    }

    /**
     * @dev Checks if the list is full
     * @return true if list is full
     */
    function isFull(Data storage self) public view returns (bool) {
        return self.size == self.maxSize;
    }

    /**
     * @dev Checks if the list is empty
     * @return true if list is empty
     */
    function isEmpty(Data storage self) public view returns (bool) {
        return self.size == 0;
    }

    /**
     * @dev Returns the current size of the list
     * @return current size of the list
     */
    function getSize(Data storage self) public view returns (uint256) {
        return self.size;
    }

    /**
     * @dev Returns the maximum size of the list
     */
    function getMaxSize(Data storage self) public view returns (uint256) {
        return self.maxSize;
    }

    /**
     * @dev Returns the key of a node in the list
     * @param _id Node's id
     * @return key for node with '_id'
     */
    function getKey(Data storage self, address _id) public view returns (uint256) {
        return self.nodes[_id].key;
    }

    /**
     * @dev Returns the first node in the list (node with the largest key)
     * @return address for the head of the list
     */
    function getFirst(Data storage self) public view returns (address) {
        return self.head;
    }

    /**
     * @dev Returns the last node in the list (node with the smallest key)
     * @return address for the tail of the list
     */
    function getLast(Data storage self) public view returns (address) {
        return self.tail;
    }

    /**
     * @dev Returns the next node (with a smaller key) in the list for a given node
     * @param _id Node's id
     * @return address for the node following node in list with '_id'
     */
    function getNext(Data storage self, address _id) public view returns (address) {
        return self.nodes[_id].nextId;
    }

    /**
     * @dev Returns the previous node (with a larger key) in the list for a given node
     * @param _id Node's id
     * address for the node before node in list with '_id'
     */
    function getPrev(Data storage self, address _id) public view returns (address) {
        return self.nodes[_id].prevId;
    }

    /**
     * @dev Check if a pair of nodes is a valid insertion point for a new node with the given key
     * @param _key Node's key
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     * @return if the insert position is valid
     */
    function validInsertPosition(
        Data storage self,
        uint256 _key,
        address _prevId,
        address _nextId
    ) public view returns (bool) {
        if (_prevId == address(0) && _nextId == address(0)) {
            // `(null, null)` is a valid insert position if the list is empty
            return isEmpty(self);
        } else if (_prevId == address(0)) {
            // `(null, _nextId)` is a valid insert position if `_nextId` is the head of the list
            return self.head == _nextId && _key >= self.nodes[_nextId].key;
        } else if (_nextId == address(0)) {
            // `(_prevId, null)` is a valid insert position if `_prevId` is the tail of the list
            return self.tail == _prevId && _key <= self.nodes[_prevId].key;
        } else {
            // `(_prevId, _nextId)` is a valid insert position if they are adjacent nodes and `_key` falls between the two nodes' keys
            return
                self.nodes[_prevId].nextId == _nextId &&
                self.nodes[_prevId].key >= _key &&
                _key >= self.nodes[_nextId].key;
        }
    }

    /**
     * @dev Descend the list (larger keys to smaller keys) to find a valid insert position
     * @param _key Node's key
     * @param _startId Id of node to start ascending the list from
     */
    function descendList(
        Data storage self,
        uint256 _key,
        address _startId
    ) private view returns (address, address) {
        // If `_startId` is the head, check if the insert position is before the head
        if (self.head == _startId && _key >= self.nodes[_startId].key) {
            return (address(0), _startId);
        }

        address prevId = _startId;
        address nextId = self.nodes[prevId].nextId;

        // Descend the list until we reach the end or until we find a valid insert position
        while (prevId != address(0) && !validInsertPosition(self, _key, prevId, nextId)) {
            prevId = self.nodes[prevId].nextId;
            nextId = self.nodes[prevId].nextId;
        }

        return (prevId, nextId);
    }

    /**
     * @dev Ascend the list (smaller keys to larger keys) to find a valid insert position
     * @param _key Node's key
     * @param _startId Id of node to start descending the list from
     */
    function ascendList(
        Data storage self,
        uint256 _key,
        address _startId
    ) private view returns (address, address) {
        // If `_startId` is the tail, check if the insert position is after the tail
        if (self.tail == _startId && _key <= self.nodes[_startId].key) {
            return (_startId, address(0));
        }

        address nextId = _startId;
        address prevId = self.nodes[nextId].prevId;

        // Ascend the list until we reach the end or until we find a valid insertion point
        while (nextId != address(0) && !validInsertPosition(self, _key, prevId, nextId)) {
            nextId = self.nodes[nextId].prevId;
            prevId = self.nodes[nextId].prevId;
        }

        return (prevId, nextId);
    }

    /**
     * @dev Find the insert position for a new node with the given key
     * @param _key Node's key
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function findInsertPosition(
        Data storage self,
        uint256 _key,
        address _prevId,
        address _nextId
    ) private view returns (address, address) {
        address prevId = _prevId;
        address nextId = _nextId;

        if (prevId != address(0)) {
            if (!contains(self, prevId) || _key > self.nodes[prevId].key) {
                // `prevId` does not exist anymore or now has a smaller key than the given key
                prevId = address(0);
            }
        }

        if (nextId != address(0)) {
            if (!contains(self, nextId) || _key < self.nodes[nextId].key) {
                // `nextId` does not exist anymore or now has a larger key than the given key
                nextId = address(0);
            }
        }

        if (prevId == address(0) && nextId == address(0)) {
            // No hint - descend list starting from head
            return descendList(self, _key, self.head);
        } else if (prevId == address(0)) {
            // No `prevId` for hint - ascend list starting from `nextId`
            return ascendList(self, _key, nextId);
        } else if (nextId == address(0)) {
            // No `nextId` for hint - descend list starting from `prevId`
            return descendList(self, _key, prevId);
        } else {
            // Descend list starting from `prevId`
            return descendList(self, _key, prevId);
        }
    }
}
