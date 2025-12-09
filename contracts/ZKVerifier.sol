// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ZKVerifier
 * @notice Verifies zkSNARK proofs for anonymous IOC submissions
 * @dev Integrates with auto-generated Groth16 verifier from SnarkJS
 * 
 * This contract wraps the Groth16 verifier and adds application-specific logic:
 * - Validates that Merkle root matches current contributor registry
 * - Ensures commitments are unique (prevents replay attacks)
 * - Links to PrivacyPreservingRegistry for state management
 */

// Interface for the auto-generated Groth16 verifier
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title ZKVerifier
 * @notice Application-layer verification logic for zkSNARK proofs
 */
contract ZKVerifier {
    // ============ State Variables ============
    
    /// @notice Address of the auto-generated Groth16 verifier contract
    IGroth16Verifier public immutable groth16Verifier;
    
    /// @notice Address of the PrivacyPreservingRegistry contract
    address public registry;
    
    /// @notice Owner address for access control
    address public owner;
    
    /// @notice Tracks used commitments to prevent replay attacks
    mapping(uint256 => bool) public usedCommitments;
    
    /// @notice Current Merkle root of registered contributors
    uint256 public currentMerkleRoot;
    
    /// @notice Tracks valid Merkle roots (historical + current)
    mapping(uint256 => bool) public validMerkleRoots;
    
    // ============ Events ============
    
    event ProofVerified(
        uint256 indexed commitment,
        uint256 merkleRoot,
        address verifier,
        uint256 timestamp
    );
    
    event CommitmentUsed(
        uint256 indexed commitment,
        uint256 timestamp
    );
    
    event MerkleRootUpdated(
        uint256 oldRoot,
        uint256 newRoot,
        uint256 timestamp
    );
    
    event RegistryUpdated(
        address oldRegistry,
        address newRegistry
    );
    
    // ============ Errors ============
    
    error InvalidProof();
    error CommitmentAlreadyUsed();
    error InvalidMerkleRoot();
    error UnauthorizedCaller();
    error ZeroAddress();
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedCaller();
        _;
    }
    
    modifier onlyRegistry() {
        if (msg.sender != registry) revert UnauthorizedCaller();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the ZKVerifier with Groth16 verifier address
     * @param _groth16Verifier Address of the auto-generated Groth16 verifier
     * @param _initialMerkleRoot Initial Merkle root of contributors
     */
    constructor(
        address _groth16Verifier,
        uint256 _initialMerkleRoot
    ) {
        if (_groth16Verifier == address(0)) revert ZeroAddress();
        
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
        owner = msg.sender;
        currentMerkleRoot = _initialMerkleRoot;
        validMerkleRoots[_initialMerkleRoot] = true;
        
        emit MerkleRootUpdated(0, _initialMerkleRoot, block.timestamp);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Verify a zkSNARK proof for anonymous submission
     * @param commitment The commitment value (public output 1)
     * @param merkleRoot The Merkle root used in the proof (public output 2)
     * @param a The Groth16 proof component A (G1 point)
     * @param b The Groth16 proof component B (G2 point)
     * @param c The Groth16 proof component C (G1 point)
     * @return bool True if proof is valid and commitment is unused
     */
    function verifyAnonymousSubmission(
        uint256 commitment,
        uint256 merkleRoot,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c
    ) external returns (bool) {
        // 1. Check commitment hasn't been used
        if (usedCommitments[commitment]) {
            revert CommitmentAlreadyUsed();
        }
        
        // 2. Validate Merkle root is current or recent
        if (!validMerkleRoots[merkleRoot]) {
            revert InvalidMerkleRoot();
        }
        
        // 3. Prepare public signals for verification
        uint[2] memory pubSignals = [commitment, merkleRoot];
        
        // 4. Verify the zkSNARK proof
        bool proofValid = groth16Verifier.verifyProof(a, b, c, pubSignals);
        
        if (!proofValid) {
            revert InvalidProof();
        }
        
        // 5. Mark commitment as used
        usedCommitments[commitment] = true;
        
        emit ProofVerified(commitment, merkleRoot, msg.sender, block.timestamp);
        emit CommitmentUsed(commitment, block.timestamp);
        
        return true;
    }
    
    /**
     * @notice Verify proof without state changes (view function)
     * @dev Useful for frontend validation before submitting transaction
     */
    function verifyProofReadOnly(
        uint256 commitment,
        uint256 merkleRoot,
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c
    ) external view returns (bool) {
        // Check if commitment already used
        if (usedCommitments[commitment]) {
            return false;
        }
        
        // Check if Merkle root is valid
        if (!validMerkleRoots[merkleRoot]) {
            return false;
        }
        
        // Verify proof
        uint[2] memory pubSignals = [commitment, merkleRoot];
        return groth16Verifier.verifyProof(a, b, c, pubSignals);
    }
    
    /**
     * @notice Update the current Merkle root (called when new contributor registers)
     * @param newRoot The new Merkle root to set as current
     */
    function updateMerkleRoot(uint256 newRoot) external onlyRegistry {
        uint256 oldRoot = currentMerkleRoot;
        currentMerkleRoot = newRoot;
        validMerkleRoots[newRoot] = true;
        
        emit MerkleRootUpdated(oldRoot, newRoot, block.timestamp);
    }
    
    /**
     * @notice Invalidate an old Merkle root (for security or cleanup)
     * @param root The root to invalidate
     */
    function invalidateMerkleRoot(uint256 root) external onlyOwner {
        validMerkleRoots[root] = false;
    }
    
    /**
     * @notice Set the registry contract address
     * @param _registry New registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        
        address oldRegistry = registry;
        registry = _registry;
        
        emit RegistryUpdated(oldRegistry, _registry);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a commitment has been used
     */
    function isCommitmentUsed(uint256 commitment) external view returns (bool) {
        return usedCommitments[commitment];
    }
    
    /**
     * @notice Check if a Merkle root is valid
     */
    function isMerkleRootValid(uint256 root) external view returns (bool) {
        return validMerkleRoots[root];
    }
    
    /**
     * @notice Get verifier contract address
     */
    function getGroth16Verifier() external view returns (address) {
        return address(groth16Verifier);
    }
}
