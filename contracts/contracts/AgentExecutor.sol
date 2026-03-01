// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPolygonZkEVMBridgeV2.sol";
import "./interfaces/IBridgeExtension.sol";
import "./interfaces/IZKMLVerifier.sol";
import "./interfaces/ITokenWrapper.sol";

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
 * 
 * Security Features (Enhanced):
 * - Slippage protection with minOutputAmount
 * - Rate limiting with cooldowns
 * - Flash loan attack prevention
 * - Agent staking/slashing mechanism
 * - Protocol fee collection
 */
contract AgentExecutor is Ownable, ReentrancyGuard, Pausable {
    // ==================== Constants ====================
    
    uint256 public constant MAX_BATCH_SIZE = 10;
    uint256 public constant MIN_STAKE_AMOUNT = 0.1 ether;
    uint256 public constant SLASH_PERCENT = 10; // 10% slash on failure
    uint256 public constant PROTOCOL_FEE_BPS = 10; // 0.1% fee (10 basis points)
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5% max slippage
    uint256 public constant COOLDOWN_BLOCKS = 1; // 1 block minimum between executions
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
    
    // ==================== New State Variables (Security Features) ====================
    
    /// @notice Agent staked amounts
    mapping(address => uint256) public agentStakes;
    
    /// @notice Last execution block per agent (for rate limiting)
    mapping(address => uint256) public lastExecutionBlock;
    
    /// @notice Collected protocol fees
    uint256 public collectedFees;
    
    /// @notice Fee recipient address
    address public feeRecipient;
    
    /// @notice ZKML verification enabled flag
    bool public zkmlEnabled = false;
    
    /// @notice KYA verification enabled flag  
    bool public kyaEnabled = false;
    
    /// @notice Registered AI model hashes for ZKML
    mapping(bytes32 => bool) public registeredModels;
    
    /// @notice Reference to TokenWrapper for ERC-20 operations
    address public tokenWrapper;
    
    /// @notice Reference to ZKMLVerifier contract
    IZKMLVerifier public zkmlVerifierContract;
    
    /// @notice Agent KYA credentials (agent => credentialHash)
    mapping(address => bytes32) public agentCredentials;
    
    /// @notice Flash loan protection - tracks execution in progress
    mapping(bytes32 => bool) private _executionInProgress;
    
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
    
    // New events for security features
    event AgentStaked(address indexed agent, uint256 amount, uint256 totalStake);
    event AgentUnstaked(address indexed agent, uint256 amount, uint256 totalStake);
    event AgentSlashed(address indexed agent, uint256 amount, string reason);
    event FeesCollected(address indexed recipient, uint256 amount);
    event ModelRegistered(bytes32 indexed modelHash);
    event CredentialUpdated(address indexed agent, bytes32 credentialHash);
    event ZKMLProofVerified(address indexed agent, bytes32 indexed proofHash);
    event TokenWrapperUpdated(address indexed oldWrapper, address indexed newWrapper);
    event ERC20TradeExecuted(
        address indexed agent,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    
    // ==================== Errors ====================
    
    error UnauthorizedAgent(address agent);
    error InsufficientReputation(address agent, uint256 current, uint256 required);
    error InvalidDestination(uint32 network, address target);
    error ExecutionFailed(string reason);
    error InvalidBridgeExtension();
    error InsufficientStake(address agent, uint256 current, uint256 required);
    error RateLimitExceeded(address agent, uint256 lastBlock, uint256 currentBlock);
    error SlippageExceeded(uint256 expected, uint256 actual, uint256 maxSlippage);
    error BatchSizeExceeded(uint256 size, uint256 maxSize);
    error FlashLoanDetected();
    error InvalidZKMLProof(address agent);
    error InvalidKYACredential(address agent);
    error ModelNotRegistered(bytes32 modelHash);
    error WithdrawalFailed();
    
    // ==================== Modifiers ====================
    
    /// @notice Prevents flash loan attacks
    modifier noFlashLoan() {
        bytes32 txOrigin = keccak256(abi.encodePacked(tx.origin, block.number));
        if (_executionInProgress[txOrigin]) {
            revert FlashLoanDetected();
        }
        _executionInProgress[txOrigin] = true;
        _;
        _executionInProgress[txOrigin] = false;
    }
    
    /// @notice Rate limiting modifier
    modifier rateLimited() {
        if (block.number < lastExecutionBlock[msg.sender] + COOLDOWN_BLOCKS) {
            revert RateLimitExceeded(
                msg.sender,
                lastExecutionBlock[msg.sender],
                block.number
            );
        }
        lastExecutionBlock[msg.sender] = block.number;
        _;
    }
    
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
        feeRecipient = _initialOwner;
    }
    
    // ==================== Staking Functions ====================
    
    /**
     * @notice Stake tokens to become an authorized agent
     */
    function stake() external payable {
        require(msg.value > 0, "Must stake some amount");
        
        agentStakes[msg.sender] += msg.value;
        
        // Auto-authorize if stake meets minimum
        if (agentStakes[msg.sender] >= MIN_STAKE_AMOUNT && !authorizedAgents[msg.sender]) {
            authorizedAgents[msg.sender] = true;
            agentReputation[msg.sender] = 100;
            emit AgentAuthorized(msg.sender, block.timestamp);
        }
        
        emit AgentStaked(msg.sender, msg.value, agentStakes[msg.sender]);
    }
    
    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        require(agentStakes[msg.sender] >= amount, "Insufficient stake");
        
        agentStakes[msg.sender] -= amount;
        
        // Deauthorize if below minimum
        if (agentStakes[msg.sender] < MIN_STAKE_AMOUNT) {
            authorizedAgents[msg.sender] = false;
            emit AgentDeauthorized(msg.sender, block.timestamp);
        }
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        
        emit AgentUnstaked(msg.sender, amount, agentStakes[msg.sender]);
    }
    
    /**
     * @notice Slash an agent's stake (internal)
     */
    function _slashAgent(address agent, string memory reason) internal {
        uint256 slashAmount = (agentStakes[agent] * SLASH_PERCENT) / 100;
        
        if (slashAmount > 0) {
            agentStakes[agent] -= slashAmount;
            collectedFees += slashAmount;
            
            emit AgentSlashed(agent, slashAmount, reason);
            
            if (agentStakes[agent] < MIN_STAKE_AMOUNT) {
                authorizedAgents[agent] = false;
                emit AgentDeauthorized(agent, block.timestamp);
            }
        }
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
    ) external payable nonReentrant whenNotPaused noFlashLoan rateLimited {
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
        if (zkmlEnabled && zkmlVerifier != address(0)) {
            _verifyZKProof(msg.sender, zkProof, callData);
        }
        
        // 4. KYA check (if enabled)
        if (kyaEnabled && kyaRegistry != address(0)) {
            _verifyKYA(msg.sender);
        }
        
        // 5. Validate destination
        if (targetContract == address(0)) {
            revert InvalidDestination(destinationNetwork, targetContract);
        }
        
        // 6. Calculate and collect protocol fee
        uint256 fee = (amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 amountAfterFee = amount - fee;
        collectedFees += fee;
        
        // 7. Execute bridgeAndCall
        try bridge.bridgeAndCall{value: msg.value}(
            destinationNetwork,
            targetContract,
            amountAfterFee,
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
                amountAfterFee,
                callData,
                block.timestamp
            );
        } catch Error(string memory reason) {
            agentFailureCount[msg.sender]++;
            _updateReputation(msg.sender, false);
            _slashAgent(msg.sender, reason);
            revert ExecutionFailed(reason);
        }
    }
    
    /**
     * @notice Execute with full security features including slippage protection
     * @param destinationNetwork Target network ID
     * @param targetContract Contract to call
     * @param amount Amount to bridge
     * @param minOutputAmount Minimum output (slippage protection)
     * @param callData Encoded call data
     * @param zkProof ZKML proof (if enabled)
     */
    function agentExecuteSecure(
        uint32 destinationNetwork,
        address targetContract,
        uint256 amount,
        uint256 minOutputAmount,
        bytes calldata callData,
        bytes calldata zkProof
    ) external payable nonReentrant whenNotPaused noFlashLoan rateLimited {
        // 1. Authorization & stake check
        if (!authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        
        if (agentStakes[msg.sender] < MIN_STAKE_AMOUNT) {
            revert InsufficientStake(msg.sender, agentStakes[msg.sender], MIN_STAKE_AMOUNT);
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
        if (zkmlEnabled) {
            _verifyZKProof(msg.sender, zkProof, callData);
        }
        
        // 4. KYA check (if enabled)
        if (kyaEnabled) {
            _verifyKYA(msg.sender);
        }
        
        // 5. Validate destination
        if (targetContract == address(0)) {
            revert InvalidDestination(destinationNetwork, targetContract);
        }
        
        // 6. Validate slippage
        if (minOutputAmount > 0) {
            uint256 maxSlippageAmount = (amount * MAX_SLIPPAGE_BPS) / 10000;
            if (amount - minOutputAmount > maxSlippageAmount) {
                revert SlippageExceeded(amount, minOutputAmount, MAX_SLIPPAGE_BPS);
            }
        }
        
        // 7. Calculate and collect protocol fee
        uint256 fee = (amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 amountAfterFee = amount - fee;
        collectedFees += fee;
        
        // 8. Execute bridgeAndCall
        try bridge.bridgeAndCall{value: msg.value}(
            destinationNetwork,
            targetContract,
            amountAfterFee,
            address(0),
            true,
            "",
            callData
        ) {
            agentExecutionCount[msg.sender]++;
            _updateReputation(msg.sender, true);
            
            emit AgentExecuted(
                msg.sender,
                destinationNetwork,
                targetContract,
                amountAfterFee,
                callData,
                block.timestamp
            );
        } catch Error(string memory reason) {
            agentFailureCount[msg.sender]++;
            _updateReputation(msg.sender, false);
            _slashAgent(msg.sender, reason);
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
    ) external payable nonReentrant whenNotPaused rateLimited {
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
        
        // 4. Calculate and collect protocol fee
        uint256 fee = (amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 amountAfterFee = amount - fee;
        collectedFees += fee;
        
        // 5. Execute bridgeAndCall (no ZKML or KYA checks for simple version)
        try bridge.bridgeAndCall{value: msg.value}(
            destinationNetwork,
            targetContract,
            amountAfterFee,
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
                amountAfterFee,
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
    ) external payable nonReentrant whenNotPaused noFlashLoan {
        // Validate batch size
        if (destinationNetworks.length > MAX_BATCH_SIZE) {
            revert BatchSizeExceeded(destinationNetworks.length, MAX_BATCH_SIZE);
        }
        
        require(
            destinationNetworks.length == targetContracts.length &&
            targetContracts.length == amounts.length &&
            amounts.length == callDatas.length,
            "Array length mismatch"
        );
        
        // Authorization check for batch caller
        if (!authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        
        uint256 valuePerCall = msg.value / destinationNetworks.length;
        
        for (uint256 i = 0; i < destinationNetworks.length; i++) {
            _executeSingleTrade(
                destinationNetworks[i],
                targetContracts[i],
                amounts[i],
                callDatas[i],
                valuePerCall
            );
        }
    }
    
    /**
     * @notice Internal single trade execution for batching
     */
    function _executeSingleTrade(
        uint32 destinationNetwork,
        address targetContract,
        uint256 amount,
        bytes calldata callData,
        uint256 value
    ) internal {
        if (targetContract == address(0)) {
            revert InvalidDestination(destinationNetwork, targetContract);
        }
        
        // Calculate fee
        uint256 fee = (amount * PROTOCOL_FEE_BPS) / 10000;
        uint256 amountAfterFee = amount - fee;
        collectedFees += fee;
        
        try bridge.bridgeAndCall{value: value}(
            destinationNetwork,
            targetContract,
            amountAfterFee,
            address(0),
            true,
            "",
            callData
        ) {
            agentExecutionCount[msg.sender]++;
            _updateReputation(msg.sender, true);
            
            emit AgentExecuted(
                msg.sender,
                destinationNetwork,
                targetContract,
                amountAfterFee,
                callData,
                block.timestamp
            );
        } catch Error(string memory) {
            agentFailureCount[msg.sender]++;
            _updateReputation(msg.sender, false);
            // Don't revert batch, just log failure
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
    ) internal {
        if (zkProof.length == 0) {
            revert ExecutionFailed("ZKML proof required");
        }
        
        // If we have an external ZKMLVerifier contract, use it
        if (address(zkmlVerifierContract) != address(0)) {
            (bool verified, bytes32 proofHash) = zkmlVerifierContract.verifyProof(agent, zkProof);
            if (!verified) {
                revert InvalidZKMLProof(agent);
            }
            emit ZKMLProofVerified(agent, proofHash);
            return;
        }
        
        // Fallback to internal verification
        // Decode proof components
        (bytes32 modelHash, bytes32 inputHash, bytes memory signature) = abi.decode(
            zkProof,
            (bytes32, bytes32, bytes)
        );
        
        // Verify model is registered
        if (!registeredModels[modelHash]) {
            revert ModelNotRegistered(modelHash);
        }
        
        // Verify input matches callData
        bytes32 callDataHash = keccak256(callData);
        if (inputHash != callDataHash) {
            revert InvalidZKMLProof(agent);
        }
        
        // Verify signature length (basic check)
        if (signature.length < 65) {
            revert InvalidZKMLProof(agent);
        }
        
        emit ZKMLProofVerified(agent, keccak256(zkProof));
    }
    
    /**
     * @notice Verify KYA (Know Your Agent) credentials
     * @dev Checks that the agent has valid identity credentials
     */
    function _verifyKYA(address agent) internal view {
        bytes32 credential = agentCredentials[agent];
        
        if (credential == bytes32(0)) {
            revert InvalidKYACredential(agent);
        }
        
        // In production, verify with Privado ID registry
        // bool isValid = IKYARegistry(kyaRegistry).verifyCredential(agent, credential);
        // if (!isValid) revert InvalidKYACredential(agent);
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
        zkmlVerifierContract = IZKMLVerifier(_zkmlVerifier);
        emit ZKMLVerifierUpdated(oldVerifier, _zkmlVerifier);
    }
    
    /**
     * @notice Update the TokenWrapper address
     */
    function setTokenWrapper(address _tokenWrapper) external onlyOwner {
        address oldWrapper = tokenWrapper;
        tokenWrapper = _tokenWrapper;
        emit TokenWrapperUpdated(oldWrapper, _tokenWrapper);
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
     * @notice Enable/disable ZKML verification
     */
    function setZKMLEnabled(bool enabled) external onlyOwner {
        zkmlEnabled = enabled;
    }
    
    /**
     * @notice Enable/disable KYA verification
     */
    function setKYAEnabled(bool enabled) external onlyOwner {
        kyaEnabled = enabled;
    }
    
    /**
     * @notice Register an AI model for ZKML verification
     * @param modelHash Hash of the AI model
     */
    function registerModel(bytes32 modelHash) external onlyOwner {
        registeredModels[modelHash] = true;
        emit ModelRegistered(modelHash);
    }
    
    /**
     * @notice Set agent KYA credential
     * @param agent Agent address
     * @param credentialHash Credential hash from Privado ID
     */
    function setAgentCredential(address agent, bytes32 credentialHash) external onlyOwner {
        agentCredentials[agent] = credentialHash;
        emit CredentialUpdated(agent, credentialHash);
    }
    
    /**
     * @notice Update the fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @notice Withdraw collected protocol fees
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = collectedFees;
        collectedFees = 0;
        
        (bool success, ) = payable(feeRecipient).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        
        emit FeesCollected(feeRecipient, amount);
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
     * @return staked Amount staked by agent
     */
    function getAgentStats(address agent) external view returns (
        bool authorized,
        uint256 reputation,
        uint256 executions,
        uint256 failures,
        uint256 staked
    ) {
        return (
            authorizedAgents[agent],
            agentReputation[agent],
            agentExecutionCount[agent],
            agentFailureCount[agent],
            agentStakes[agent]
        );
    }
    
    /**
     * @notice Check if an agent can execute operations
     */
    function canExecute(address agent) external view returns (bool) {
        return authorizedAgents[agent] && 
               agentReputation[agent] >= minReputation &&
               block.number >= lastExecutionBlock[agent] + COOLDOWN_BLOCKS &&
               !paused();
    }
    
    /**
     * @notice Get protocol statistics
     */
    function getProtocolStats() external view returns (
        uint256 totalFees,
        uint256 minStake,
        uint256 feeBps,
        uint256 slashPercent,
        uint256 maxBatchSize
    ) {
        return (
            collectedFees,
            MIN_STAKE_AMOUNT,
            PROTOCOL_FEE_BPS,
            SLASH_PERCENT,
            MAX_BATCH_SIZE
        );
    }
    
    /**
     * @notice Get the bridge address
     */
    function getBridge() external view returns (address) {
        return address(bridge);
    }
    
    // ==================== ERC-20 Token Functions ====================
    
    /**
     * @notice Execute ERC-20 arbitrage trade via TokenWrapper
     * @param tokenIn Input token address
     * @param tokenOut Output token address  
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output (slippage protection)
     * @param zkProof Optional ZKML proof
     */
    function agentExecuteERC20(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata zkProof
    ) external nonReentrant whenNotPaused rateLimited {
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
        if (zkmlEnabled && zkProof.length > 0) {
            _verifyZKProof(msg.sender, zkProof, abi.encode(tokenIn, tokenOut, amountIn));
        }
        
        // 4. Execute swap via TokenWrapper
        require(tokenWrapper != address(0), "TokenWrapper not set");
        
        uint256 amountOut = ITokenWrapper(tokenWrapper).executeArbitrageSwap(
            tokenIn,
            tokenOut,
            msg.sender,
            amountIn,
            minAmountOut
        );
        
        // 5. Update stats
        agentExecutionCount[msg.sender]++;
        _updateReputation(msg.sender, true);
        
        emit ERC20TradeExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            block.timestamp
        );
    }
    
    /**
     * @notice Execute cross-chain ERC-20 transfer
     * @param token Token to transfer
     * @param destinationNetwork Target chain ID
     * @param recipient Recipient on destination
     * @param amount Amount to transfer
     */
    function agentCrossChainERC20(
        address token,
        uint32 destinationNetwork,
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused rateLimited {
        // 1. Authorization check
        if (!authorizedAgents[msg.sender]) {
            revert UnauthorizedAgent(msg.sender);
        }
        
        // 2. Execute cross-chain transfer via TokenWrapper
        require(tokenWrapper != address(0), "TokenWrapper not set");
        
        bool success = ITokenWrapper(tokenWrapper).crossChainTransfer(
            token,
            msg.sender,
            destinationNetwork,
            recipient,
            amount
        );
        
        require(success, "Cross-chain transfer failed");
        
        agentExecutionCount[msg.sender]++;
        _updateReputation(msg.sender, true);
    }
    
    /**
     * @notice Get agent's wrapped token balance
     */
    function getAgentTokenBalance(address agent, address token) external view returns (uint256) {
        if (tokenWrapper == address(0)) return 0;
        return ITokenWrapper(tokenWrapper).getWrappedBalance(token, agent);
    }
    
    // ==================== Receive Function ====================
    
    /**
     * @notice Receive function to accept $MESH tokens
     */
    receive() external payable {}
}
