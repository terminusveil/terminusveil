// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Terminus Wire
/// @notice The desk's reads, posted on Robinhood Chain. For a ticker: the
///         staged multiplier and the terminus as the token contract held them
///         when the post was made, and the time of the post. Anyone may post;
///         a reader trusts a poster address, not this contract. Phase 1 of the
///         Terminus Veil desk.
/// @dev    No owner, no pause, no upgrade, no fee, no ETH. `staged` is the
///         18-decimal multiplier (1e18 = 1x). `terminus` is a Unix time, 0 when
///         the token contract has not set one. The desk's assumed times are
///         never posted.
contract TerminusWire {
    struct Post {
        uint256 staged;
        uint64 terminus;
        uint64 postedAt;
    }

    uint256 public constant MAX_BATCH = 64;

    event Posted(
        address indexed by,
        bytes32 indexed ticker,
        uint256 staged,
        uint64 terminus,
        uint64 postedAt
    );

    mapping(address => mapping(bytes32 => Post)) private _latest;
    mapping(address => uint256) private _count;

    /// @notice The latest post an address made for a ticker; all zero when none.
    function latest(address by, bytes32 ticker) external view returns (Post memory) {
        return _latest[by][ticker];
    }

    /// @notice How many posts an address has made, every ticker counted.
    function count(address by) external view returns (uint256) {
        return _count[by];
    }

    /// @notice Post one ticker's staged figure and terminus.
    /// @param ticker   The token's ticker, right-padded to bytes32 (e.g. "JNJ").
    /// @param staged   The staged multiplier, 18 decimals; must be non-zero.
    /// @param terminus The moment staged becomes live; 0 when the contract has not set one.
    function post(bytes32 ticker, uint256 staged, uint64 terminus) external {
        _post(ticker, staged, terminus);
    }

    /// @notice Post up to MAX_BATCH tickers in one transaction. All or nothing.
    function postMany(
        bytes32[] calldata tickers,
        uint256[] calldata staged,
        uint64[] calldata terminus
    ) external {
        uint256 n = tickers.length;
        require(n != 0, "TerminusWire: empty");
        require(n <= MAX_BATCH, "TerminusWire: batch");
        require(staged.length == n && terminus.length == n, "TerminusWire: length");
        for (uint256 i = 0; i < n; i++) {
            _post(tickers[i], staged[i], terminus[i]);
        }
    }

    function _post(bytes32 ticker, uint256 staged, uint64 terminus) private {
        require(ticker != bytes32(0), "TerminusWire: ticker");
        require(staged != 0, "TerminusWire: staged");
        uint64 now64 = uint64(block.timestamp);
        _latest[msg.sender][ticker] = Post({staged: staged, terminus: terminus, postedAt: now64});
        _count[msg.sender] += 1;
        emit Posted(msg.sender, ticker, staged, terminus, now64);
    }
}
