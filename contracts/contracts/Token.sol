// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/// @notice Test ERC20 Token
contract Token is ERC2771Context, ERC20 {
    constructor(
        address trustedForwarder
    ) ERC20("TestToken", "TT") ERC2771Context(trustedForwarder) {
        _mint(msg.sender, 1000000 ether);
    }

    /// @dev See {ERC2771Context-_msgSender}.
    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    /// @dev See {ERC2771Context-_msgData}.
    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return super._msgData();
    }
}
