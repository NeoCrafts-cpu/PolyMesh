// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockBridge
 * @notice Mock implementation of Polygon zkEVM Bridge V2 for testing
 */
contract MockBridge {
    event BridgeAndCallExecuted(
        uint32 destinationNetwork,
        address destinationAddress,
        uint256 amount,
        address token,
        bytes callData
    );

    function bridgeAndCall(
        uint32 destinationNetwork,
        address destinationAddress,
        uint256 amount,
        address token,
        bool forceUpdateGlobalExitRoot,
        bytes calldata permitData,
        bytes calldata callData
    ) external payable {
        emit BridgeAndCallExecuted(
            destinationNetwork,
            destinationAddress,
            amount,
            token,
            callData
        );
    }

    function networkID() external pure returns (uint32) {
        return 10101;
    }

    function isClaimed(uint256 globalIndex) external pure returns (bool) {
        return false;
    }
}
