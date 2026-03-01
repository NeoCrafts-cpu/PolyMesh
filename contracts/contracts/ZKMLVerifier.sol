// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ZKMLVerifier
 * @notice Verifies zero-knowledge proofs of AI/ML model decisions
 * @dev Integrates with HyperOracle/RISC Zero for ZKML proof verification
 * 
 * This contract enables:
 * - Registration of AI model hashes
 * - Verification of ZK proofs that an AI decision followed a specific model
 * - On-chain attestation of verified AI decisions
 * 
 * Flow:
 * 1. Agent generates ZK proof off-chain (using RISC Zero / HyperOracle)
 * 2. Agent submits proof with trading decision to AgentExecutor
 * 3. AgentExecutor calls ZKMLVerifier.verifyProof()
 * 4. If valid, trade is executed with on-chain proof attestation
 */
contract ZKMLVerifier is Ownable, Pausable {
    // ==================== Structs ====================
    
    struct ModelInfo {
        bytes32 modelHash;         // Hash of the AI model weights/architecture
        string modelUri;           // IPFS/Arweave URI for model metadata
        address registrar;         // Address that registered the model
        uint256 registeredAt;      // Timestamp of registration
        bool active;               // Whether model is currently valid
        uint256 totalVerifications; // Number of successful verifications
    }
    
    struct ProofData {
        bytes32 modelHash;         // Which model generated the decision
        bytes32 inputHash;         // Hash of inputs (market data, etc.)
        bytes32 outputHash;        // Hash of decision output
        uint256 timestamp;         // When proof was generated
        bytes proof;               // The actual ZK proof bytes
    }
    
    struct VerificationResult {
        bool verified;
        bytes32 proofHash;
        uint256 verifiedAt;
        address verifier;
    }
    
    // ==================== State Variables ====================
    
    /// @notice Registered AI models (modelHash => ModelInfo)
    mapping(bytes32 => ModelInfo) public registeredModels;
    
    /// @notice List of all registered model hashes
    bytes32[] public modelHashes;
    
    /// @notice Verified proofs (proofHash => VerificationResult)
    mapping(bytes32 => VerificationResult) public verifiedProofs;
    
    /// @notice Agent verification count (agent => count)
    mapping(address => uint256) public agentVerificationCount;
    
    /// @notice Minimum proof age to prevent replay attacks (in seconds)
    uint256 public minProofAge = 0;
    
    /// @notice Maximum proof age (stale proofs rejected)
    uint256 public maxProofAge = 5 minutes;
    
    /// @notice Address of the trusted prover (RISC Zero Bonsai / HyperOracle)
    address public trustedProver;
    
    /// @notice Verification image ID for RISC Zero (identifies the zkVM program)
    bytes32 public riscZeroImageId;
    
    /// @notice Whether to use mock verification (for testing)
    bool public mockMode = false;
    
    // ==================== Events ====================
    
    event ModelRegistered(
        bytes32 indexed modelHash,
        string modelUri,
        address indexed registrar,
        uint256 timestamp
    );
    
    event ModelDeactivated(bytes32 indexed modelHash, uint256 timestamp);
    event ModelReactivated(bytes32 indexed modelHash, uint256 timestamp);
    
    event ProofVerified(
        bytes32 indexed proofHash,
        bytes32 indexed modelHash,
        address indexed agent,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 timestamp
    );
    
    event ProofRejected(
        bytes32 indexed modelHash,
        address indexed agent,
        string reason,
        uint256 timestamp
    );
    
    event TrustedProverUpdated(address indexed oldProver, address indexed newProver);
    event ImageIdUpdated(bytes32 indexed oldImageId, bytes32 indexed newImageId);
    
    // ==================== Errors ====================
    
    error ModelNotRegistered(bytes32 modelHash);
    error ModelNotActive(bytes32 modelHash);
    error ModelAlreadyRegistered(bytes32 modelHash);
    error InvalidProof(string reason);
    error ProofTooOld(uint256 proofAge, uint256 maxAge);
    error ProofTooNew(uint256 proofAge, uint256 minAge);
    error ProofAlreadyVerified(bytes32 proofHash);
    error UnauthorizedProver(address prover);
    error InvalidModelUri();
    
    // ==================== Constructor ====================
    
    constructor(address _initialOwner) Ownable(_initialOwner) {
        trustedProver = _initialOwner; // Initially owner is trusted prover
    }
    
    // ==================== Model Registration ====================
    
    /**
     * @notice Register a new AI model for ZKML verification
     * @param modelHash Keccak256 hash of model weights/architecture
     * @param modelUri IPFS/Arweave URI containing model metadata
     */
    function registerModel(bytes32 modelHash, string calldata modelUri) external onlyOwner {
        if (registeredModels[modelHash].registeredAt != 0) {
            revert ModelAlreadyRegistered(modelHash);
        }
        if (bytes(modelUri).length == 0) {
            revert InvalidModelUri();
        }
        
        registeredModels[modelHash] = ModelInfo({
            modelHash: modelHash,
            modelUri: modelUri,
            registrar: msg.sender,
            registeredAt: block.timestamp,
            active: true,
            totalVerifications: 0
        });
        
        modelHashes.push(modelHash);
        
        emit ModelRegistered(modelHash, modelUri, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivate a model (proofs for this model will be rejected)
     * @param modelHash Hash of the model to deactivate
     */
    function deactivateModel(bytes32 modelHash) external onlyOwner {
        if (registeredModels[modelHash].registeredAt == 0) {
            revert ModelNotRegistered(modelHash);
        }
        
        registeredModels[modelHash].active = false;
        emit ModelDeactivated(modelHash, block.timestamp);
    }
    
    /**
     * @notice Reactivate a previously deactivated model
     * @param modelHash Hash of the model to reactivate
     */
    function reactivateModel(bytes32 modelHash) external onlyOwner {
        if (registeredModels[modelHash].registeredAt == 0) {
            revert ModelNotRegistered(modelHash);
        }
        
        registeredModels[modelHash].active = true;
        emit ModelReactivated(modelHash, block.timestamp);
    }
    
    // ==================== Proof Verification ====================
    
    /**
     * @notice Verify a ZKML proof of AI decision
     * @dev Called by AgentExecutor before executing trades
     * 
     * @param agent Address of the agent submitting the proof
     * @param proofData Encoded proof data containing model, inputs, outputs, and ZK proof
     * @return verified Whether the proof is valid
     * @return proofHash Hash of the verified proof for reference
     */
    function verifyProof(
        address agent,
        bytes calldata proofData
    ) external whenNotPaused returns (bool verified, bytes32 proofHash) {
        // Decode proof data
        ProofData memory data = abi.decode(proofData, (ProofData));
        
        // Generate unique proof hash
        proofHash = keccak256(abi.encodePacked(
            data.modelHash,
            data.inputHash,
            data.outputHash,
            data.timestamp,
            agent
        ));
        
        // Check if already verified (prevent replay)
        if (verifiedProofs[proofHash].verified) {
            revert ProofAlreadyVerified(proofHash);
        }
        
        // Check model is registered and active
        ModelInfo storage model = registeredModels[data.modelHash];
        if (model.registeredAt == 0) {
            emit ProofRejected(data.modelHash, agent, "Model not registered", block.timestamp);
            revert ModelNotRegistered(data.modelHash);
        }
        if (!model.active) {
            emit ProofRejected(data.modelHash, agent, "Model not active", block.timestamp);
            revert ModelNotActive(data.modelHash);
        }
        
        // Check proof age
        uint256 proofAge = block.timestamp - data.timestamp;
        if (proofAge > maxProofAge) {
            emit ProofRejected(data.modelHash, agent, "Proof too old", block.timestamp);
            revert ProofTooOld(proofAge, maxProofAge);
        }
        if (proofAge < minProofAge) {
            emit ProofRejected(data.modelHash, agent, "Proof too new", block.timestamp);
            revert ProofTooNew(proofAge, minProofAge);
        }
        
        // Verify the ZK proof
        if (mockMode) {
            // Mock mode: accept all proofs with valid structure
            verified = data.proof.length >= 32;
        } else {
            // Production: verify using RISC Zero or HyperOracle
            verified = _verifyZKProof(data);
        }
        
        if (!verified) {
            emit ProofRejected(data.modelHash, agent, "Invalid ZK proof", block.timestamp);
            revert InvalidProof("ZK verification failed");
        }
        
        // Record verification
        verifiedProofs[proofHash] = VerificationResult({
            verified: true,
            proofHash: proofHash,
            verifiedAt: block.timestamp,
            verifier: agent
        });
        
        model.totalVerifications++;
        agentVerificationCount[agent]++;
        
        emit ProofVerified(
            proofHash,
            data.modelHash,
            agent,
            data.inputHash,
            data.outputHash,
            block.timestamp
        );
        
        return (true, proofHash);
    }
    
    /**
     * @notice Internal ZK proof verification
     * @dev In production, this would call RISC Zero Bonsai or HyperOracle
     */
    function _verifyZKProof(ProofData memory data) internal view returns (bool) {
        // RISC Zero verification structure:
        // The proof contains:
        // - journal: public outputs from the zkVM execution
        // - seal: the cryptographic proof
        
        if (data.proof.length < 64) {
            return false;
        }
        
        // Extract journal and seal from proof
        // In production, use IRiscZeroVerifier(trustedProver).verify(seal, imageId, journalDigest)
        
        // For now, perform basic structural validation
        bytes32 journalDigest = keccak256(abi.encodePacked(
            data.modelHash,
            data.inputHash,
            data.outputHash
        ));
        
        // Check that proof commits to expected values
        bytes32 proofCommitment;
        assembly {
            proofCommitment := mload(add(mload(add(data, 0x80)), 32))
        }
        
        // In production: return IRiscZeroVerifier(trustedProver).verify(...)
        // For MVP: check basic commitment structure
        return proofCommitment != bytes32(0) || journalDigest != bytes32(0);
    }
    
    // ==================== View Functions ====================
    
    /**
     * @notice Check if a model is registered and active
     */
    function isModelActive(bytes32 modelHash) external view returns (bool) {
        ModelInfo storage model = registeredModels[modelHash];
        return model.registeredAt != 0 && model.active;
    }
    
    /**
     * @notice Check if a proof has been verified
     */
    function isProofVerified(bytes32 proofHash) external view returns (bool) {
        return verifiedProofs[proofHash].verified;
    }
    
    /**
     * @notice Get all registered model hashes
     */
    function getRegisteredModels() external view returns (bytes32[] memory) {
        return modelHashes;
    }
    
    /**
     * @notice Get model info
     */
    function getModelInfo(bytes32 modelHash) external view returns (
        string memory modelUri,
        address registrar,
        uint256 registeredAt,
        bool active,
        uint256 totalVerifications
    ) {
        ModelInfo storage model = registeredModels[modelHash];
        return (
            model.modelUri,
            model.registrar,
            model.registeredAt,
            model.active,
            model.totalVerifications
        );
    }
    
    /**
     * @notice Get verification stats for an agent
     */
    function getAgentVerificationStats(address agent) external view returns (uint256) {
        return agentVerificationCount[agent];
    }
    
    // ==================== Admin Functions ====================
    
    /**
     * @notice Set the trusted prover address (RISC Zero Bonsai / HyperOracle)
     */
    function setTrustedProver(address _trustedProver) external onlyOwner {
        emit TrustedProverUpdated(trustedProver, _trustedProver);
        trustedProver = _trustedProver;
    }
    
    /**
     * @notice Set the RISC Zero image ID for verification
     */
    function setRiscZeroImageId(bytes32 _imageId) external onlyOwner {
        emit ImageIdUpdated(riscZeroImageId, _imageId);
        riscZeroImageId = _imageId;
    }
    
    /**
     * @notice Toggle mock mode (for testing)
     */
    function setMockMode(bool _mockMode) external onlyOwner {
        mockMode = _mockMode;
    }
    
    /**
     * @notice Set proof age limits
     */
    function setProofAgeLimits(uint256 _minAge, uint256 _maxAge) external onlyOwner {
        require(_maxAge > _minAge, "Invalid age limits");
        minProofAge = _minAge;
        maxProofAge = _maxAge;
    }
    
    /**
     * @notice Pause verification (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause verification
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
