// NodeDataManager.js - Pure node data management and state
// Handles all node CRUD operations, state management, and validation logic
// NO DOM dependencies - pure data operations only

class NodeDataManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.nodes = [];
        this.nextNodeId = 1;
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for data-related events only
        this.eventBus.on('node:data:get', this.handleGetNodeData.bind(this));
        this.eventBus.on('node:data:export', this.handleExportNodes.bind(this));
        this.eventBus.on('node:data:import', this.handleImportNodes.bind(this));
        this.eventBus.on('node:data:clear', this.handleClearAllNodes.bind(this));
        
        // Listen for label management events
        this.eventBus.on('node:label:add', this.handleAddLabel.bind(this));
        this.eventBus.on('node:label:remove', this.handleRemoveLabel.bind(this));
        this.eventBus.on('node:prompt:update', this.handlePromptUpdate.bind(this));
        
        // Listen for cleanup requests
        this.eventBus.on('node:cleanup:check', this.handleCleanupCheck.bind(this));
        this.eventBus.on('node:cleanup:auto', this.handleAutoCleanup.bind(this));
    }
    
    // ============================================================================
    // NODE LIFECYCLE OPERATIONS
    // ============================================================================
    
    createNode(toolType, position) {
        console.log(`📊 NodeDataManager: Creating node ${toolType} at`, position);
        
        const nodeData = {
            id: `node_${this.nextNodeId++}`,
            type: toolType,
            position: { ...position },
            inputLabels: [],
            outputLabels: [],
            params: {},
            userPrompt: '',
            isProcessing: false,
            hasError: false,
            isManuallyCreated: true, // For auto-cleanup logic
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        console.log(`📊 NodeDataManager: Created node data`, nodeData);
        this.addNode(nodeData);
        return nodeData;
    }
    
    addNode(nodeData) {
        // Validate node data
        if (!nodeData.id || !nodeData.type) {
            console.error('Invalid node data:', nodeData);
            return null;
        }
        
        // Check for duplicate IDs
        if (this.getNodeById(nodeData.id)) {
            console.error(`Node with ID ${nodeData.id} already exists`);
            return null;
        }
        
        // Ensure required fields exist
        if (!nodeData.inputLabels) nodeData.inputLabels = [];
        if (!nodeData.outputLabels) nodeData.outputLabels = [];
        if (!nodeData.params) nodeData.params = {};
        if (!nodeData.userPrompt) nodeData.userPrompt = '';
        if (nodeData.isProcessing === undefined) nodeData.isProcessing = false;
        if (nodeData.hasError === undefined) nodeData.hasError = false;
        if (!nodeData.createdAt) nodeData.createdAt = Date.now();
        nodeData.updatedAt = Date.now();
        
        this.nodes.push(nodeData);
        
        // Emit events for other systems
        this.eventBus.emit('node-added', nodeData);
        this.eventBus.emit('node:state:evaluate', nodeData);
        
        console.log(`📊 NodeDataManager: Added node ${nodeData.id} (${nodeData.type})`);
        return nodeData;
    }
    
    removeNode(nodeId) {
        console.log(`📊 NodeDataManager: Removing node ${nodeId}`);
        
        const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) {
            console.warn(`Node ${nodeId} not found for removal`);
            return false;
        }
        
        const nodeData = this.nodes[nodeIndex];
        
        // Before removing node, trigger cascading delete for each output label
        if (nodeData.outputLabels && nodeData.outputLabels.length > 0) {
            console.log(`📊 NodeDataManager: Node ${nodeId} has ${nodeData.outputLabels.length} output labels, triggering cascading deletes`);
            nodeData.outputLabels.forEach(outputLabel => {
                // Use the CascadingDeleteManager to properly delete each output label
                this.eventBus.emit('request-cascading-delete', {
                    label: outputLabel,
                    source: 'node-output-cleanup'
                });
            });
        }
        
        this.nodes.splice(nodeIndex, 1);
        
        // Emit events for cleanup
        this.eventBus.emit('node:removed', nodeData);
        this.eventBus.emit('node-deleted', nodeId);
        
        console.log(`📊 NodeDataManager: Removed node ${nodeId}`);
        return true;
    }
    
    deleteNode(nodeId, isAutoCleanup = false) {
        const nodeData = this.getNodeById(nodeId);
        if (!nodeData) {
            console.warn(`Node ${nodeId} not found for deletion`);
            return false;
        }
        
        if (!isAutoCleanup) {
            console.log(`📊 NodeDataManager: Manual delete request for ${nodeId}`);
            // Emit cascade delete request for manual deletions
            this.eventBus.emit('request-cascade-delete', {
                type: 'node',
                id: nodeId,
                nodeData: nodeData
            });
        } else {
            console.log(`📊 NodeDataManager: Auto-cleanup delete for ${nodeId}`);
            this.removeNode(nodeId);
        }
        
        return true;
    }
    
    // ============================================================================
    // NODE ACCESS METHODS
    // ============================================================================
    
    getAllNodes() {
        return [...this.nodes];
    }
    
    getNodeById(nodeId) {
        return this.nodes.find(n => n.id === nodeId) || null;
    }
    
    getNodesByType(nodeType) {
        return this.nodes.filter(n => n.type === nodeType);
    }
    
    getNodeCount() {
        return this.nodes.length;
    }
    
    getNodesByInputLabel(label) {
        return this.nodes.filter(n => 
            n.inputLabels && n.inputLabels.includes(label)
        );
    }
    
    getNodesByOutputLabel(label) {
        return this.nodes.filter(n => 
            n.outputLabels && n.outputLabels.includes(label)
        );
    }
    
    // ============================================================================
    // NODE STATE MANAGEMENT  
    // ============================================================================
    
    updateNodePosition(nodeId, position) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        node.position = { ...position };
        node.updatedAt = Date.now();
        
        this.eventBus.emit('node:position:changed', { nodeId, position });
        return true;
    }
    
    updateNodePrompt(nodeId, userPrompt) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        node.userPrompt = userPrompt || '';
        node.updatedAt = Date.now();
        
        this.eventBus.emit('node-prompt-updated', { nodeId, userPrompt });
        this.eventBus.emit('node:state:evaluate', node);
        return true;
    }
    
    setNodeProcessing(nodeId, isProcessing, error = null) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        node.isProcessing = isProcessing;
        node.hasError = !!error;
        node.updatedAt = Date.now();
        
        this.eventBus.emit('node:processing:changed', { nodeId, isProcessing, error });
        return true;
    }
    
    // ============================================================================
    // LABEL MANAGEMENT
    // ============================================================================
    
    addLabelToNode(nodeId, label) {
        const node = this.getNodeById(nodeId);
        if (!node) {
            console.error(`Node ${nodeId} not found for adding label ${label}`);
            return false;
        }
        
        // Validate input first
        const validation = this.validateNodeInput(node, label);
        if (!validation.canAccept) {
            console.warn(`Rejected label ${label} for node ${nodeId}: ${validation.message}`);
            this.eventBus.emit('node:validation:failed', { nodeId, label, reason: validation.message });
            return false;
        }
        
        if (!node.inputLabels) node.inputLabels = [];
        
        // Prevent duplicates
        if (!node.inputLabels.includes(label)) {
            node.inputLabels.push(label);
            node.updatedAt = Date.now();
            
            console.log(`📊 NodeDataManager: Added label ${label} to node ${nodeId}`);
            
            // Update outputs and evaluate state
            this.updateNodeOutputs(node);
            this.eventBus.emit('node:state:evaluate', node);
            this.eventBus.emit('node-inputs-changed', { nodeId, label, action: 'added' });
            
            return true;
        }
        
        return false;
    }
    
    removeLabelFromNode(nodeId, label) {
        const node = this.getNodeById(nodeId);
        if (!node || !node.inputLabels) return false;
        
        const index = node.inputLabels.indexOf(label);
        if (index > -1) {
            node.inputLabels.splice(index, 1);
            node.updatedAt = Date.now();
            
            console.log(`📊 NodeDataManager: Removed label ${label} from node ${nodeId}`);
            
            // Update outputs and evaluate state
            this.updateNodeOutputs(node);
            this.eventBus.emit('node:state:evaluate', node);
            this.eventBus.emit('node-inputs-changed', { nodeId, label, action: 'removed' });
            
            // Check for auto-cleanup
            setTimeout(() => {
                this.checkNodeForCleanup(nodeId);
            }, 100);
            
            return true;
        }
        
        return false;
    }
    
    clearNodeInputs(nodeId) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        const hadInputs = node.inputLabels && node.inputLabels.length > 0;
        
        node.inputLabels = [];
        node.outputLabels = [];
        node.updatedAt = Date.now();
        
        if (hadInputs) {
            this.eventBus.emit('node:inputs:cleared', { nodeId });
            this.eventBus.emit('node:state:evaluate', node);
        }
        
        return true;
    }
    
    // ============================================================================
    // INPUT VALIDATION
    // ============================================================================
    
    validateNodeInput(nodeData, newInputLabel) {
        const inputRules = this.getInputRules(nodeData.type);
        const currentInputs = nodeData.inputLabels || [];
        
        // Check input type compatibility
        const inputTypeValid = this.isInputTypeValid(nodeData.type, newInputLabel);
        if (!inputTypeValid) {
            return {
                canAccept: false,
                reason: 'incompatible_type',
                message: `${nodeData.type} doesn't accept ${this.getFileExtension(newInputLabel)} files`
            };
        }
        
        // Check max inputs limit
        if (inputRules && inputRules.maxInputs && currentInputs.length >= inputRules.maxInputs) {
            return {
                canAccept: false,
                reason: 'max_inputs_exceeded', 
                message: `${nodeData.type} accepts maximum ${inputRules.maxInputs} input(s)`
            };
        }
        
        // Check for duplicates
        if (currentInputs.includes(newInputLabel)) {
            return {
                canAccept: false,
                reason: 'duplicate_input',
                message: `Input ${newInputLabel} already added to this node`
            };
        }
        
        // Check prompt requirements
        const promptRequirement = this.getNodePromptRequirement(nodeData.type);
        if (promptRequirement === 'mandatory' && !this.hasValidUserPrompt(nodeData)) {
            const specificMessages = {
                'translator': 'You have to add a user-prompt before you can drop a file in a translation node',
                'analyzer': 'You have to add a user-prompt before you can drop a file in an analyzer node',
                'webscraper': 'You have to add a URL prompt before you can use the webscraper node'
            };
            
            return {
                canAccept: false,
                reason: 'missing_mandatory_prompt',
                message: specificMessages[nodeData.type] || `${nodeData.type} requires a user prompt before accepting inputs`
            };
        }
        
        return {
            canAccept: true,
            reason: 'valid'
        };
    }
    
    getInputRules(nodeType) {
        const rules = {
            'pdf2text': { acceptedTypes: ['.pdf'], minInputs: 1, maxInputs: null },
            'audio2text': { acceptedTypes: ['.mp3', '.wav', '.m4a', '.mp4'], minInputs: 1, maxInputs: null },
            'image2text': { acceptedTypes: ['.jpg', '.png', '.jpeg', '.gif'], minInputs: 1, maxInputs: null },
            'video2text': { acceptedTypes: ['.mp4', '.avi', '.mov'], minInputs: 1, maxInputs: null },
            'summarizer': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'translator': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'analyzer': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'join': { acceptedTypes: ['.txt'], minInputs: 2, maxInputs: null },
            'text2pdf': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'text2docx': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'text2template': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: 1 }
        };
        
        return rules[nodeType] || { acceptedTypes: [], minInputs: 0, maxInputs: null };
    }
    
    isInputTypeValid(nodeType, inputLabel) {
        const rules = this.getInputRules(nodeType);
        const fileExtension = this.getFileExtension(inputLabel);
        return rules.acceptedTypes.includes(fileExtension);
    }
    
    getFileExtension(fileName) {
        if (!fileName || typeof fileName !== 'string') return '';
        const lastDot = fileName.lastIndexOf('.');
        return lastDot >= 0 ? fileName.substring(lastDot).toLowerCase() : '';
    }
    
    getNodePromptRequirement(nodeType) {
        const promptRequirements = {
            'summarizer': 'optional',
            'translator': 'mandatory', 
            'analyzer': 'mandatory',
            'text2template': 'mandatory'
        };
        
        return promptRequirements[nodeType] || 'optional';
    }
    
    hasValidUserPrompt(nodeData) {
        return nodeData.userPrompt && nodeData.userPrompt.trim().length > 0;
    }
    
    canNodeAcceptInput(nodeId, newInputLabel) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        const validation = this.validateNodeInput(node, newInputLabel);
        return validation.canAccept;
    }
    
    // ============================================================================
    // OUTPUT GENERATION
    // ============================================================================
    
    updateNodeOutputs(nodeData) {
        if (!nodeData.inputLabels || nodeData.inputLabels.length === 0) {
            nodeData.outputLabels = [];
            return;
        }
        
        // Only generate outputs if node has minimum required inputs
        const inputRules = this.getInputRules(nodeData.type);
        const hasMinInputs = nodeData.inputLabels.length >= inputRules.minInputs;
        
        if (hasMinInputs) {
            // For combined flows (join, analyzer), remove previous outputs
            const isCombinedFlow = ['join', 'analyzer'].includes(nodeData.type);
            
            if (isCombinedFlow && nodeData.outputLabels && nodeData.outputLabels.length > 0) {
                nodeData.outputLabels.forEach(oldOutput => {
                    this.eventBus.emit('remove-text-file-label', {
                        fileName: oldOutput,
                        sourceNodeId: nodeData.id
                    });
                });
            }
            
            // Generate new output labels
            const newOutputs = this.generateSimulatedOutputs(nodeData);
            nodeData.outputLabels = newOutputs;
            
            // Emit events for label creation
            newOutputs.forEach(outputLabel => {
                this.eventBus.emit('node-output-created', {
                    fileName: outputLabel,
                    nodeId: nodeData.id,
                    nodeType: nodeData.type,
                    sourceLabels: nodeData.inputLabels
                });
            });
            
            console.log(`📊 NodeDataManager: Generated outputs for ${nodeData.id}:`, newOutputs);
        } else {
            nodeData.outputLabels = [];
        }
        
        nodeData.updatedAt = Date.now();
    }
    
    generateSimulatedOutputs(nodeData) {
        const { type, inputLabels, userPrompt } = nodeData;
        
        switch (type) {
            case 'pdf2text':
            case 'audio2text': 
            case 'image2text':
            case 'video2text':
                return this.outputIndividualFiles(inputLabels, '.txt');
                
            case 'translator':
                const targetLang = this.parseLanguageFromPrompt(userPrompt);
                if (targetLang) {
                    return this.outputIndividualFiles(inputLabels, `-${targetLang}.txt`);
                }
                return [];
                
            case 'summarizer':
                return this.outputIndividualFiles(inputLabels, '-sum.txt');
                
            case 'analyzer':
                if (userPrompt && userPrompt.trim()) {
                    return this.outputCombinedFiles(inputLabels, '-anl.txt');
                }
                return [];
                
            case 'join':
                return this.outputCombinedFiles(inputLabels, '-joi.txt');
                
            case 'text2pdf':
                return this.outputIndividualFiles(inputLabels, '.pdf');
                
            case 'text2docx':
                return this.outputIndividualFiles(inputLabels, '.docx');
                
            case 'text2template':
                if (userPrompt && userPrompt.trim()) {
                    return this.outputIndividualFiles(inputLabels, '-filled.txt');
                }
                return [];
        }
        
        return [];
    }
    
    outputIndividualFiles(inputLabels, suffix) {
        return inputLabels.map(input => {
            const baseLabel = input.replace(/\.txt$/, '');
            return `${baseLabel}${suffix}`;
        });
    }
    
    outputCombinedFiles(inputLabels, suffix) {
        const combinedLabel = inputLabels.map(label => label.replace(/\.txt$/, '')).join('');
        return [`${combinedLabel}${suffix}`];
    }
    
    parseLanguageFromPrompt(userPrompt) {
        if (!userPrompt || !userPrompt.trim()) return null;
        
        const languageMap = {
            'french': 'fr', 'france': 'fr', 'russian': 'ru', 'russia': 'ru', 
            'german': 'de', 'germany': 'de', 'spanish': 'es', 'spain': 'es',
            'italian': 'it', 'italy': 'it', 'portuguese': 'pt', 'portugal': 'pt',
            'chinese': 'zh', 'china': 'zh', 'japanese': 'jp', 'japan': 'jp',
            'korean': 'kr', 'korea': 'kr', 'arabic': 'ar', 'english': 'en',
            'dutch': 'nl', 'polish': 'pl', 'swedish': 'se', 'norwegian': 'no',
            'danish': 'dk'
        };
        
        const prompt = userPrompt.toLowerCase().trim();
        for (const [language, code] of Object.entries(languageMap)) {
            if (prompt.includes(language)) {
                return code;
            }
        }
        
        const codeMatch = prompt.match(/\b([a-z]{2})\b/);
        return codeMatch ? codeMatch[1] : 'xx';
    }
    
    // ============================================================================
    // AUTO-CLEANUP LOGIC
    // ============================================================================
    
    checkNodeForCleanup(nodeId) {
        const node = this.getNodeById(nodeId);
        if (!node) return false;
        
        const hasInputs = node.inputLabels && node.inputLabels.length > 0;
        
        if (!hasInputs && node.isManuallyCreated) {
            console.log(`📊 NodeDataManager: Auto-cleanup removing empty node ${nodeId}`);
            this.deleteNode(nodeId, true);
            return true;
        }
        
        return false;
    }
    
    checkAndCleanupEmptyNodes() {
        const nodesToRemove = [];
        
        this.nodes.forEach(node => {
            const hasInputs = node.inputLabels && node.inputLabels.length > 0;
            if (!hasInputs && node.isManuallyCreated) {
                nodesToRemove.push(node);
            }
        });
        
        nodesToRemove.forEach(node => {
            this.deleteNode(node.id, true);
        });
        
        if (nodesToRemove.length > 0) {
            this.eventBus.emit('status-update', `Auto-cleaned ${nodesToRemove.length} empty node(s)`);
        }
        
        return nodesToRemove.length;
    }
    
    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================
    
    clearAllNodes() {
        const nodeIds = this.nodes.map(n => n.id);
        nodeIds.forEach(id => this.removeNode(id));
        
        console.log(`📊 NodeDataManager: Cleared all nodes`);
        return nodeIds.length;
    }
    
    exportNodes() {
        return this.nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: { ...node.position },
            inputLabels: [...(node.inputLabels || [])],
            outputLabels: [...(node.outputLabels || [])],
            userPrompt: node.userPrompt || '',
            params: { ...node.params },
            isManuallyCreated: node.isManuallyCreated,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt
        }));
    }
    
    importNodes(nodesData) {
        this.clearAllNodes();
        
        nodesData.forEach(nodeData => {
            // Update nextNodeId to avoid conflicts
            const nodeIdNumber = parseInt(nodeData.id.replace('node_', ''));
            this.nextNodeId = Math.max(this.nextNodeId, nodeIdNumber + 1);
            
            this.addNode(nodeData);
        });
        
        console.log(`📊 NodeDataManager: Imported ${nodesData.length} nodes`);
        return nodesData.length;
    }
    
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    handleGetNodeData({ nodeId, callback }) {
        const nodeData = this.getNodeById(nodeId);
        if (callback) callback(nodeData);
        return nodeData;
    }
    
    handleExportNodes({ callback }) {
        const exported = this.exportNodes();
        if (callback) callback(exported);
        return exported;
    }
    
    handleImportNodes({ nodesData }) {
        return this.importNodes(nodesData);
    }
    
    handleClearAllNodes() {
        return this.clearAllNodes();
    }
    
    handleAddLabel({ nodeId, label }) {
        return this.addLabelToNode(nodeId, label);
    }
    
    handleRemoveLabel({ nodeId, label }) {
        return this.removeLabelFromNode(nodeId, label);
    }
    
    handlePromptUpdate({ nodeId, userPrompt }) {
        return this.updateNodePrompt(nodeId, userPrompt);
    }
    
    handleCleanupCheck({ nodeId }) {
        if (nodeId) {
            return this.checkNodeForCleanup(nodeId);
        } else {
            return this.checkAndCleanupEmptyNodes();
        }
    }
    
    handleAutoCleanup() {
        return this.checkAndCleanupEmptyNodes();
    }
}

export { NodeDataManager };