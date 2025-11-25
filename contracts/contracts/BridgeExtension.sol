// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IBridgeExtension.sol";
import "./interfaces/IPolygonZkEVMBridgeV2.sol";

/**
 * @title BridgeExtension
 * @notice Handles incoming bridgeAndCall messages from the AggLayer
 * @dev This contract receives and executes cross-chain calls from other chains
 * 
 * Flow:
 * 1. Agent on NeuroMesh calls AgentExecutor.agentExecute()
 * 2. AgentExecutor calls bridge.bridgeAndCall()
 * 3. AggLayer routes the message to destination chain
 * 4. Bridge on destination chain calls BridgeExtension.onBridgeCall()
 * 5. BridgeExtension executes the call on the target contract
 */
contract BridgeExtension is IBridgeExtension, Ownable, ReentrancyGuard {
    // ==================== State Variables ====================
    
    /// @notice Reference to the Polygon zkEVM Bridge V2
    address public immutable bridge;
    
    /// @notice Authorized origin networks (networkId => authorized)
    mapping(uint32 => bool) public authorizedNetworks;
    
    /// @notice Authorized origin addresses per network (networkId => address => authorized)
    mapping(uint32 => mapping(address => bool)) public authorizedOrigins;
    
    /// @notice Whitelist of target contracts that can be called
    mapping(address => bool) public whitelistedTargets;
    
    /// @notice Enable/disable whitelist enforcement
    bool public whitelistEnabled = true;
    
    /// @notice Maximum gas allowed for external calls
    uint256 public maxGasPerCall = 500000;
    
    /// @notice Total calls executed
    uint256 public totalCallsExecuted;
    
    /// @notice Total calls failed
    uint256 public totalCallsFailed;
    
    // ==================== Events ====================
    
    event NetworkAuthorized(uint32 indexed networkId);
    event NetworkDeauthorized(uint32 indexed networkId);
    event OriginAuthorized(uint32 indexed networkId, address indexed origin);
    event OriginDeauthorized(uint32 indexed networkId, address indexed origin);
    event TargetWhitelisted(address indexed target);
    event TargetRemovedFromWhitelist(address indexed target);
    event WhitelistToggled(bool enabled);
    
    // ==================== Errors ====================
    
    error UnauthorizedCaller(address caller);
    error UnauthorizedNetwork(uint32 networkId);
    error UnauthorizedOrigin(uint32 networkId, address origin);
    error TargetNotWhitelisted(address target);
    error CallExecutionFailed(address target, string reason);
    error InvalidCallData();
    
    // ==================== Modifiers ====================
    
    modifier onlyBridge() {
        if (msg.sender != bridge) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }
    
    // ==================== Constructor ====================
    
    /**
     * @notice Initialize the BridgeExtension
     * @param _bridge Address of the Polygon zkEVM Bridge V2
     * @param _initialOwner Address of the contract owner
     */
    constructor(
        address _bridge,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_bridge != address(0), "Invalid bridge address");
        bridge = _bridge;
    }
    
    // ==================== Bridge Interface Implementation ====================
    
    /**
     * @notice Handle incoming bridge call from AggLayer
     * @dev Called by the bridge contract when a bridgeAndCall is executed
     * 
     * @param originNetwork Network ID of the origin chain
     * @param originAddress Address that initiated the bridge call (e.g., AgentExecutor)
     * @param data Encoded call data containing (targetContract, callData)
     * 
     * @return result The result of the executed call
     */
    function onBridgeCall(
        uint32 originNetwork,
        address originAddress,
        bytes calldata data
    ) external payable override onlyBridge nonReentrant returns (bytes memory) {
        // 1. Verify origin network is authorized
        if (!authorizedNetworks[originNetwork]) {
            revert UnauthorizedNetwork(originNetwork);
        }
        
        // 2. Verify origin address is authorized (optional, can be disabled)
        if (authorizedOrigins[originNetwork][address(0)] == false && 
            !authorizedOrigins[originNetwork][originAddress]) {
            revert UnauthorizedOrigin(originNetwork, originAddress);
        }
        
        // 3. Decode call data
        (address targetContract, bytes memory callData) = abi.decode(data, (address, bytes));
        
        // 4. Verify target is whitelisted (if whitelist is enabled)
        if (whitelistEnabled && !whitelistedTargets[targetContract]) {
            revert TargetNotWhitelisted(targetContract);
        }
        
        // 5. Execute the call
        bytes memory result;
        bool success;
        
        try this.executeCall{gas: maxGasPerCall}(targetContract, callData, msg.value) 
            returns (bytes memory _result) {
            result = _result;
            success = true;
            totalCallsExecuted++;
            
            emit BridgeCallExecuted(
                originNetwork,
                originAddress,
                targetContract,
                msg.value,
                result
            );
        } catch Error(string memory reason) {
            totalCallsFailed++;
            emit BridgeCallFailed(originNetwork, originAddress, targetContract, reason);
            revert CallExecutionFailed(targetContract, reason);
        } catch {
            totalCallsFailed++;
            emit BridgeCallFailed(originNetwork, originAddress, targetContract, "Unknown error");
            revert CallExecutionFailed(targetContract, "Unknown error");
        }
        
        return result;
    }
    
    /**
     * @notice Execute a call on a target contract
     * @dev This is a separate function to allow proper gas control and error handling
     */
    function executeCall(
        address targetContract,
        bytes memory callData,
        uint256 value
    ) external payable returns (bytes memory) {
        require(msg.sender == address(this), "Only self");
        
        (bool success, bytes memory result) = targetContract.call{value: value}(callData);
        
        if (!success) {
            // Try to extract revert reason
            if (result.length > 0) {
                assembly {
                    let returndata_size := mload(result)
                    revert(add(32, result), returndata_size)
                }
            } else {
                revert("Call failed without reason");
            }
        }
        
        return result;
    }
    
    /**
     * @notice Check if a call is authorized
     * @param originNetwork Network ID of the origin
     * @param originAddress Address on the origin network
     * @param targetContract Contract to be called
     * @return bool Whether the call is authorized
     */
    function isAuthorized(
        uint32 originNetwork,
        address originAddress,
        address targetContract
    ) external view override returns (bool) {
        // Check network authorization
        if (!authorizedNetworks[originNetwork]) {
            return false;
        }
        
        // Check origin authorization (if not globally authorized)
        if (authorizedOrigins[originNetwork][address(0)] == false && 
            !authorizedOrigins[originNetwork][originAddress]) {
            return false;
        }
        
        // Check target whitelist (if enabled)
        if (whitelistEnabled && !whitelistedTargets[targetContract]) {
            return false;
        }
        
        return true;
    }
    
    // ==================== Admin Functions ====================
    
    /**
     * @notice Authorize a network to send bridge calls
     * @param networkId Network ID to authorize
     */
    function authorizeNetwork(uint32 networkId) external onlyOwner {
        authorizedNetworks[networkId] = true;
        emit NetworkAuthorized(networkId);
    }
    
    /**
     * @notice Deauthorize a network
     * @param networkId Network ID to deauthorize
     */
    function deauthorizeNetwork(uint32 networkId) external onlyOwner {
        authorizedNetworks[networkId] = false;
        emit NetworkDeauthorized(networkId);
    }
    
    /**
     * @notice Authorize a specific origin address from a network
     * @param networkId Network ID
     * @param origin Address to authorize
     * @dev Use address(0) to authorize all addresses from a network
     */
    function authorizeOrigin(uint32 networkId, address origin) external onlyOwner {
        authorizedOrigins[networkId][origin] = true;
        emit OriginAuthorized(networkId, origin);
    }
    
    /**
     * @notice Deauthorize a specific origin address
     * @param networkId Network ID
     * @param origin Address to deauthorize
     */
    function deauthorizeOrigin(uint32 networkId, address origin) external onlyOwner {
        authorizedOrigins[networkId][origin] = false;
        emit OriginDeauthorized(networkId, origin);
    }
    
    /**
     * @notice Add a contract to the whitelist
     * @param target Contract address to whitelist
     */
    function whitelistTarget(address target) external onlyOwner {
        require(target != address(0), "Invalid target");
        whitelistedTargets[target] = true;
        emit TargetWhitelisted(target);
    }
    
    /**
     * @notice Remove a contract from the whitelist
     * @param target Contract address to remove
     */
    function removeTargetFromWhitelist(address target) external onlyOwner {
        whitelistedTargets[target] = false;
        emit TargetRemovedFromWhitelist(target);
    }
    
    /**
     * @notice Toggle whitelist enforcement
     * @param enabled Whether to enable whitelist checking
     */
    function setWhitelistEnabled(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistToggled(enabled);
    }
    
    /**
     * @notice Set maximum gas per call
     * @param maxGas Maximum gas limit
     */
    function setMaxGasPerCall(uint256 maxGas) external onlyOwner {
        require(maxGas >= 100000 && maxGas <= 10000000, "Invalid gas limit");
        maxGasPerCall = maxGas;
    }
    
    /**
     * @notice Withdraw stuck tokens (emergency)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // ==================== View Functions ====================
    
    /**
     * @notice Get statistics
     */
    function getStats() external view returns (
        uint256 executed,
        uint256 failed,
        uint256 successRate
    ) {
        executed = totalCallsExecuted;
        failed = totalCallsFailed;
        uint256 total = executed + failed;
        successRate = total > 0 ? (executed * 10000) / total : 0; // Basis points
    }
    
    /**
     * @notice Check if a specific call would be authorized
     */
    function checkAuthorization(
        uint32 originNetwork,
        address originAddress,
        address targetContract
    ) external view returns (
        bool networkAuthorized,
        bool originAuthorized,
        bool targetAuthorized,
        bool fullyAuthorized
    ) {
        networkAuthorized = authorizedNetworks[originNetwork];
        originAuthorized = authorizedOrigins[originNetwork][address(0)] || 
                          authorizedOrigins[originNetwork][originAddress];
        targetAuthorized = !whitelistEnabled || whitelistedTargets[targetContract];
        fullyAuthorized = networkAuthorized && originAuthorized && targetAuthorized;
    }
    
    // ==================== Receive Function ====================
    
    receive() external payable {}
}
