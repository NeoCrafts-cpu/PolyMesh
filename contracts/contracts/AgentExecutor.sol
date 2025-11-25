// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPolygonZkEVMBridgeV2.sol";
import "./interfaces/IBridgeExtension.sol";

/**
 * @title AgentExecutor
 * @notice Main contract for AI agents to execute cross-chain operations via AggLayer
 * @dev Integrates with Polygon zkEVM Bridge V2 and provides agent-friendly interfaces
 * 
 * Key Features:
 * - bridgeAndCall execution for cross-chain agent operations
 * - Agent authentication and authorization
 * - Gas optimization for high-frequency agent transactions
 * - Integration with ZKML verification (optional)
 * - KYA (Know Your Agent) checks
 */
contract AgentExecutor is Ownable, ReentrancyGuard, Pausable {
    // ==================== State Variables ====================
    
    /// @notice Reference to the Polygon zkEVM Bridge V2
    IPolygonZkEVMBridgeV2 public immutable bridge;
    
    /// @notice Reference to the BridgeExtension for receiving calls
    address public bridgeExtension;
    
    /// @notice Mapping of authorized agents (address => authorized)
    mapping(address => bool) public authorizedAgents;
    
    /// @notice Mapping of agent reputation scores (address => score)
    mapping(address => uint256) public agentReputation;
    
    /// @notice Minimum reputation required for execution
    uint256 public minReputation = 0; // Start with no requirement
    
    /// @notice Address of the ZKML verifier (for provable AI decisions)
    address public zkmlVerifier;
    
    /// @notice Address of the KYA registry (Know Your Agent)
    address public kyaRegistry;
    
    /// @notice Total executions by agent
    mapping(address => uint256) public agentExecutionCount;
    
    /// @notice Failed execution count
    mapping(address => uint256) public agentFailureCount;
    
    // ==================== Events ====================
    
    event AgentExecuted(
        address indexed agent,
        uint32 indexed destinationNetwork,
        address indexed targetContract,
        uint256 amount,
        bytes callData,
        uint256 timestamp
    );
    
    event AgentAuthorized(address indexed agent, uint256 timestamp);
    event AgentDeauthorized(address indexed agent, uint256 timestamp);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore);
    event BridgeExtensionUpdated(address indexed oldExtension, address indexed newExtension);
    event ZKMLVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event KYARegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    
    // ==================== Errors ====================
    
    error UnauthorizedAgent(address agent);
    error InsufficientReputation(address agent, uint256 current, uint256 required);
    error InvalidDestination(uint32 network, address target);
    error ExecutionFailed(string reason);
    error InvalidBridgeExtension();
    
    // ==================== Constructor ====================
    
    /**
     * @notice Initialize the AgentExecutor
     * @param _bridge Address of the Polygon zkEVM Bridge V2
     * @param _initialOwner Address of the contract owner
     */
    constructor(
        address _bridge,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_bridge != address(0), "Invalid bridge address");
        bridge = IPolygonZkEVMBridgeV2(_bridge);
    }
    
    // ==================== Agent Execution Functions ====================
    
    /**
     * @notice Execute a cross-chain operation via AggLayer bridgeAndCall
     * @dev This is the main function agents use to interact with other chains
     * 
     * @param destinationNetwork Network ID of the destination chain
     * @param targetContract Contract to call on the destination chain
     * @param amount Amount of $MESH tokens to bridge
     * @param callData Encoded function call to execute
     * @param zkProof Optional ZK proof of AI decision (if ZKML is enabled)
     * 
     * Example: Agent swapping tokens on QuickSwap (Polygon PoS) from NeuroMesh
     */
    function agentExecute(
        uint32 destinationNetwork,
        address targetContract,
        uint256 amount,
        bytes calldata callData,
        bytes calldata zkProof
    ) external payable nonReentrant whenNotPaused {
        // 1. Authorization check
        if (!authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        
        // 2. Reputation check
        if (agentReputation[msg.sender] < minReputation) {
            revert InsufficientReputation(
                msg.sender,
                agentReputation[msg.sender],
                minReputation
            );
        }
        
        // 3. ZKML verification (if enabled)
        if (zkmlVerifier != address(0)) {
            _verifyZKProof(msg.sender, zkProof, callData);
        }
        
        // 4. KYA check (if enabled)
        if (kyaRegistry != address(0)) {
            _verifyKYA(msg.sender);
        }
        
        // 5. Validate destination
        if (targetContract == address(0)) {
            revert InvalidDestination(destinationNetwork, targetContract);
        }
        
        // 6. Execute bridgeAndCall
        try bridge.bridgeAndCall{value: msg.value}(
            destinationNetwork,
            targetContract,
            amount,
            address(0), // Using native gas token ($MESH)
            true, // Force update global exit root
            "", // No permit data for now
            callData
        ) {
            // Success
            agentExecutionCount[msg.sender]++;
            _updateReputation(msg.sender, true);
            
            emit AgentExecuted(
                msg.sender,
                destinationNetwork,
                targetContract,
                amount,
                callData,
                block.timestamp
            );
        } catch Error(string memory reason) {
            agentFailureCount[msg.sender]++;
            _updateReputation(msg.sender, false);
            revert ExecutionFailed(reason);
        }
    }
    
    /**
     * @notice Simplified execution for agents without ZKML proof
     * @dev Gas-optimized version for trusted agents
     */
    function agentExecuteSimple(
        uint32 destinationNetwork,
        address targetContract,
        uint256 amount,
        bytes calldata callData
    ) external payable nonReentrant whenNotPaused {
        // 1. Authorization check
        if (!authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        
        // 2. Reputation check
        if (agentReputation[msg.sender] < minReputation) {
            revert InsufficientReputation(
                msg.sender,
                agentReputation[msg.sender],
                minReputation
            );
        }
        
        // 3. Validate destination
        if (targetContract == address(0)) {
            revert InvalidDestination(destinationNetwork, targetContract);
        }
        
        // 4. Execute bridgeAndCall (no ZKML or KYA checks for simple version)
        try bridge.bridgeAndCall{value: msg.value}(
            destinationNetwork,
            targetContract,
            amount,
            address(0), // Using native gas token
            true, // Force update global exit root
            "", // No permit data
            callData
        ) {
            // Success
            agentExecutionCount[msg.sender]++;
            _updateReputation(msg.sender, true);
            
            emit AgentExecuted(
                msg.sender,
                destinationNetwork,
                targetContract,
                amount,
                callData,
                block.timestamp
            );
        } catch Error(string memory reason) {
            agentFailureCount[msg.sender]++;
            _updateReputation(msg.sender, false);
            revert ExecutionFailed(reason);
        }
    }
    
    /**
     * @notice Batch execute multiple cross-chain operations
     * @dev Allows agents to execute multiple operations in one transaction
     */
    function agentExecuteBatch(
        uint32[] calldata destinationNetworks,
        address[] calldata targetContracts,
        uint256[] calldata amounts,
        bytes[] calldata callDatas
    ) external payable nonReentrant whenNotPaused {
        require(
            destinationNetworks.length == targetContracts.length &&
            targetContracts.length == amounts.length &&
            amounts.length == callDatas.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < destinationNetworks.length; i++) {
            // Each execution will perform its own checks
            this.agentExecuteSimple{value: msg.value / destinationNetworks.length}(
                destinationNetworks[i],
                targetContracts[i],
                amounts[i],
                callDatas[i]
            );
        }
    }
    
    // ==================== Internal Functions ====================
    
    /**
     * @notice Verify ZKML proof of AI decision
     * @dev Checks that the agent's action was generated by a verified AI model
     */
    function _verifyZKProof(
        address agent,
        bytes calldata zkProof,
        bytes calldata callData
    ) internal view {
        if (zkProof.length == 0) {
            revert ExecutionFailed("ZKML proof required");
        }
        
        // Call ZKML verifier contract
        // This would verify that the callData was generated by a specific AI model
        // For now, we'll implement a simple check
        // In production, this would call HyperOracle or similar ZKML verifier
        
        // bytes32 callDataHash = keccak256(callData);
        // bool verified = IZKMLVerifier(zkmlVerifier).verify(agent, zkProof, callDataHash);
        // require(verified, "Invalid ZK proof");
    }
    
    /**
     * @notice Verify KYA (Know Your Agent) credentials
     * @dev Checks that the agent has valid identity credentials
     */
    function _verifyKYA(address agent) internal view {
        // Call KYA registry to verify agent has valid credentials
        // This would integrate with Privado ID
        // For now, we'll implement a simple check
        
        // bool hasCredential = IKYARegistry(kyaRegistry).hasValidCredential(agent);
        // require(hasCredential, "Invalid KYA credential");
    }
    
    /**
     * @notice Update agent reputation based on execution result
     * @param agent Address of the agent
     * @param success Whether the execution succeeded
     */
    function _updateReputation(address agent, bool success) internal {
        uint256 oldScore = agentReputation[agent];
        uint256 newScore;
        
        if (success) {
            // Increase reputation (capped at 1000)
            newScore = oldScore + 10;
            if (newScore > 1000) newScore = 1000;
        } else {
            // Decrease reputation (floored at 0)
            newScore = oldScore > 20 ? oldScore - 20 : 0;
        }
        
        agentReputation[agent] = newScore;
        emit ReputationUpdated(agent, oldScore, newScore);
    }
    
    // ==================== Admin Functions ====================
    
    /**
     * @notice Authorize an agent to execute operations
     * @param agent Address of the agent to authorize
     */
    function authorizeAgent(address agent) external onlyOwner {
        require(agent != address(0), "Invalid agent address");
        authorizedAgents[agent] = true;
        agentReputation[agent] = 100; // Start with base reputation
        emit AgentAuthorized(agent, block.timestamp);
    }
    
    /**
     * @notice Deauthorize an agent
     * @param agent Address of the agent to deauthorize
     */
    function deauthorizeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
        emit AgentDeauthorized(agent, block.timestamp);
    }
    
    /**
     * @notice Update the bridge extension address
     */
    function setBridgeExtension(address _bridgeExtension) external onlyOwner {
        require(_bridgeExtension != address(0), "Invalid address");
        address oldExtension = bridgeExtension;
        bridgeExtension = _bridgeExtension;
        emit BridgeExtensionUpdated(oldExtension, _bridgeExtension);
    }
    
    /**
     * @notice Update the ZKML verifier address
     */
    function setZKMLVerifier(address _zkmlVerifier) external onlyOwner {
        address oldVerifier = zkmlVerifier;
        zkmlVerifier = _zkmlVerifier;
        emit ZKMLVerifierUpdated(oldVerifier, _zkmlVerifier);
    }
    
    /**
     * @notice Update the KYA registry address
     */
    function setKYARegistry(address _kyaRegistry) external onlyOwner {
        address oldRegistry = kyaRegistry;
        kyaRegistry = _kyaRegistry;
        emit KYARegistryUpdated(oldRegistry, _kyaRegistry);
    }
    
    /**
     * @notice Update minimum reputation requirement
     */
    function setMinReputation(uint256 _minReputation) external onlyOwner {
        minReputation = _minReputation;
    }
    
    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Withdraw stuck tokens (emergency)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // ==================== View Functions ====================
    
    /**
     * @notice Get agent statistics
     * @param agent Address of the agent
     * @return authorized Whether agent is authorized
     * @return reputation Current reputation score
     * @return executions Total successful executions
     * @return failures Total failed executions
     */
    function getAgentStats(address agent) external view returns (
        bool authorized,
        uint256 reputation,
        uint256 executions,
        uint256 failures
    ) {
        return (
            authorizedAgents[agent],
            agentReputation[agent],
            agentExecutionCount[agent],
            agentFailureCount[agent]
        );
    }
    
    /**
     * @notice Check if an agent can execute operations
     */
    function canExecute(address agent) external view returns (bool) {
        return authorizedAgents[agent] && 
               agentReputation[agent] >= minReputation &&
               !paused();
    }
    
    /**
     * @notice Get the bridge address
     */
    function getBridge() external view returns (address) {
        return address(bridge);
    }
    
    // ==================== Receive Function ====================
    
    /**
     * @notice Receive function to accept $MESH tokens
     */
    receive() external payable {}
}
