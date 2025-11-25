// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPolygonZkEVMBridgeV2
 * @notice Interface for the Polygon zkEVM Bridge V2 (AggLayer-compatible)
 * @dev This interface represents the core functions needed for bridgeAndCall
 */
interface IPolygonZkEVMBridgeV2 {
    /**
     * @notice Bridge tokens and execute a call on the destination network (AggLayer)
     * @param destinationNetwork Network ID of the destination chain
     * @param destinationAddress Address to call on the destination network
     * @param amount Amount of tokens to bridge
     * @param token Token address to bridge (address(0) for native gas token)
     * @param forceUpdateGlobalExitRoot Force update of the global exit root
     * @param permitData Permit data for gasless approvals (if applicable)
     * @param callData Encoded function call to execute on destination
     */
    function bridgeAndCall(
        uint32 destinationNetwork,
        address destinationAddress,
        uint256 amount,
        address token,
        bool forceUpdateGlobalExitRoot,
        bytes calldata permitData,
        bytes calldata callData
    ) external payable;

    /**
     * @notice Bridge tokens to another network
     * @param destinationNetwork Network ID of the destination chain
     * @param destinationAddress Address to receive tokens on destination
     * @param amount Amount of tokens to bridge
     * @param token Token address to bridge
     * @param forceUpdateGlobalExitRoot Force update of the global exit root
     * @param permitData Permit data for gasless approvals
     */
    function bridgeAsset(
        uint32 destinationNetwork,
        address destinationAddress,
        uint256 amount,
        address token,
        bool forceUpdateGlobalExitRoot,
        bytes calldata permitData
    ) external payable;

    /**
     * @notice Claim bridged assets on the destination network
     * @param smtProofLocalExitRoot Merkle proof of the local exit root
     * @param smtProofRollupExitRoot Merkle proof of the rollup exit root
     * @param globalIndex Global index of the bridge transaction
     * @param mainnetExitRoot Mainnet exit root
     * @param rollupExitRoot Rollup exit root
     * @param originNetwork Origin network ID
     * @param originTokenAddress Token address on origin network
     * @param destinationNetwork Destination network ID
     * @param destinationAddress Destination address
     * @param amount Amount of tokens
     * @param metadata Additional metadata
     */
    function claimAsset(
        bytes32[32] calldata smtProofLocalExitRoot,
        bytes32[32] calldata smtProofRollupExitRoot,
        uint256 globalIndex,
        bytes32 mainnetExitRoot,
        bytes32 rollupExitRoot,
        uint32 originNetwork,
        address originTokenAddress,
        uint32 destinationNetwork,
        address destinationAddress,
        uint256 amount,
        bytes calldata metadata
    ) external;

    /**
     * @notice Get the network ID of this chain
     */
    function networkID() external view returns (uint32);

    /**
     * @notice Check if a global index has been claimed
     */
    function isClaimed(uint256 globalIndex) external view returns (bool);
}
