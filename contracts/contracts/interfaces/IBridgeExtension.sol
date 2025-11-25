// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBridgeExtension
 * @notice Interface for handling incoming messages from the AggLayer
 * @dev This contract acts as the receiver for bridgeAndCall messages
 */
interface IBridgeExtension {
    /**
     * @notice Struct representing a bridge call request
     * @param originNetwork Network ID where the call originated
     * @param originAddress Address that initiated the call
     * @param destinationAddress Target contract address
     * @param amount Amount of tokens bridged
     * @param callData Encoded function call
     */
    struct BridgeCallData {
        uint32 originNetwork;
        address originAddress;
        address destinationAddress;
        uint256 amount;
        bytes callData;
    }

    /**
     * @notice Handle incoming bridge call from AggLayer
     * @dev Called by the bridge contract when a bridgeAndCall is executed
     * @param originNetwork Network ID of the origin chain
     * @param originAddress Address that initiated the bridge call
     * @param data Encoded call data
     */
    function onBridgeCall(
        uint32 originNetwork,
        address originAddress,
        bytes calldata data
    ) external payable returns (bytes memory);

    /**
     * @notice Verify that a call is authorized
     * @param originNetwork Network ID of the origin
     * @param originAddress Address on the origin network
     * @param targetContract Contract to be called
     */
    function isAuthorized(
        uint32 originNetwork,
        address originAddress,
        address targetContract
    ) external view returns (bool);

    /**
     * @notice Emitted when a bridge call is successfully executed
     */
    event BridgeCallExecuted(
        uint32 indexed originNetwork,
        address indexed originAddress,
        address indexed targetContract,
        uint256 amount,
        bytes result
    );

    /**
     * @notice Emitted when a bridge call fails
     */
    event BridgeCallFailed(
        uint32 indexed originNetwork,
        address indexed originAddress,
        address indexed targetContract,
        string reason
    );
}
