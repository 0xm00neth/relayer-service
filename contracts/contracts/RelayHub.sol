// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RelayHub
contract RelayHub is EIP712, Ownable {
    using ECDSA for bytes32;

    /**************/
    /* Structures */
    /**************/

    /// @notice ForwardRequest struct
    /// @param from Transaction from address
    /// @param to Transaction to address
    /// @param value Transaction value amount
    /// @param gas Transaction gas amount
    /// @param nonce Transaction nonce
    /// @param data Transaction data
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    /*************/
    /* Constants */
    /*************/

    /// @dev ForwardRequest Type Hash
    bytes32 private constant _TYPEHASH =
        keccak256(
            "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
        );

    /***********/
    /* Storage */
    /***********/

    /// @dev User address to nonce
    mapping(address => uint256) private _nonces;

    /***************/
    /* Constructor */
    /***************/

    constructor() EIP712("RelayHub", "1") {}

    /******************/
    /* View Functions */
    /******************/

    /// @notice Get user's current nonce
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /// @notice Verify Signature for Forward Request
    /// @param req Forward Request
    /// @param signature Signature
    /// @return Signature is valid or not
    function verify(
        ForwardRequest calldata req,
        bytes calldata signature
    ) public view returns (bool) {
        (address signer, ECDSA.RecoverError err) = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _TYPEHASH,
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).tryRecover(signature);

        return
            err == ECDSA.RecoverError.NoError &&
            _nonces[req.from] == req.nonce &&
            signer == req.from;
    }

    /********************/
    /* Admion Functions */
    /********************/

    /// @notice Execute multiple meta transactions
    /// @param reqs List of ForwardRequest
    /// @param signatures List of signatures
    /// @return successes Success status list for the requests
    /// @return results Return data list for the requests
    function execute(
        ForwardRequest[] calldata reqs,
        bytes[] calldata signatures
    )
        external
        payable
        onlyOwner
        returns (bool[] memory successes, bytes[] memory results)
    {
        if (reqs.length != signatures.length) {
            revert();
        }

        uint256 reqCount = reqs.length;
        successes = new bool[](reqCount);
        results = new bytes[](reqCount);
        for (uint256 i; i != reqCount; ++i) {
            if (verify(reqs[i], signatures[i])) {
                ForwardRequest memory req = reqs[i];
                _nonces[req.from] = req.nonce + 1;

                (bool success, bytes memory returndata) = req.to.call{
                    gas: req.gas,
                    value: req.value
                }(abi.encodePacked(req.data, req.from));
                successes[i] = success;
                results[i] = returndata;
            } else {
                successes[i] = false;
                results[i] = "";
            }
        }
    }
}
