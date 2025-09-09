// NodeColorManager - V4 Node Color System
// Manages Red/Yellow/Green node states based on prompt requirements

class NodeColorManager {
    constructor(eventBus, toolPalette) {
        this.eventBus = eventBus;
        this.toolPalette = toolPalette;
        this.nodeStates = new Map(); // nodeId -> color state
        this.nodeDataManager = null; // Will be set by main.js
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for node rendering completion (fired after DOM creation)
        this.eventBus.on('node-rendered', this.handleNodeCreated.bind(this));
        
        // Listen for prompt changes
        this.eventBus.on('node-prompt-updated', this.handleNodePromptUpdated.bind(this));
        
        // Listen for node input changes
        this.eventBus.on('node-inputs-changed', this.handleNodeInputsChanged.bind(this));
    }
    
    handleNodeCreated(nodeData) {
        // Ensure inputLabels is initialized
        if (!nodeData.inputLabels) nodeData.inputLabels = [];
        
        console.log(`🎨 NodeColorManager: Evaluating new ${nodeData.type} node ${nodeData.id} with ${nodeData.inputLabels.length} inputs`);
        
        // Evaluate initial node color state
        const colorState = this.evaluateNodeColor(nodeData);
        console.log(`🎨 NodeColorManager: Node ${nodeData.id} evaluated as ${colorState.color}: ${colorState.message}`);
        
        this.updateNodeColor(nodeData.id, colorState);
    }
    
    handleNodePromptUpdated(updateData) {
        const { nodeId, userPrompt } = updateData;
        
        // Re-evaluate color after prompt change
        const nodeData = this.getNodeData(nodeId);
        if (nodeData) {
            nodeData.userPrompt = userPrompt;
            const colorState = this.evaluateNodeColor(nodeData);
            this.updateNodeColor(nodeId, colorState);
        }
    }
    
    handleNodeInputsChanged(changeData) {
        const { nodeId } = changeData;
        
        console.log(`🎨 NodeColorManager: Input changed for node ${nodeId}`);
        
        // Re-evaluate color after input changes
        const nodeData = this.getNodeData(nodeId);
        if (nodeData) {
            console.log(`🎨 NodeColorManager: Re-evaluating ${nodeData.type} node ${nodeId} with ${nodeData.inputLabels ? nodeData.inputLabels.length : 0} inputs`);
            const colorState = this.evaluateNodeColor(nodeData);
            console.log(`🎨 NodeColorManager: Node ${nodeId} re-evaluated as ${colorState.color}: ${colorState.message}`);
            this.updateNodeColor(nodeId, colorState);
        } else {
            console.warn(`🎨 NodeColorManager: Could not get node data for ${nodeId}`);
        }
    }
    
    evaluateNodeColor(nodeData) {
        const toolDef = this.toolPalette.findToolById(nodeData.type);
        if (!toolDef) return 'red'; // Unknown tool = error state
        
        const promptRequirement = this.getPromptRequirement(nodeData.type);
        const hasUserPrompt = nodeData.userPrompt && nodeData.userPrompt.trim().length > 0;
        const hasInputs = nodeData.inputLabels && nodeData.inputLabels.length > 0;
        const inputCount = nodeData.inputLabels ? nodeData.inputLabels.length : 0;
        
        console.log(`🎨 NodeColorManager: Evaluating ${nodeData.type} - inputs: ${inputCount}, hasPrompt: ${hasUserPrompt}, promptReq: ${promptRequirement}`);
        
        // Check minimum input requirements first (higher priority than prompts)
        const inputRules = this.getInputRules(nodeData.type);
        if (inputCount < inputRules.minInputs) {
            console.log(`🎨 NodeColorManager: ${nodeData.type} needs ${inputRules.minInputs} inputs, has ${inputCount} -> RED`);
            return {
                color: 'red',
                status: 'error',
                message: `${nodeData.type} requires at least ${inputRules.minInputs} input${inputRules.minInputs > 1 ? 's' : ''}`,
                canExecute: false
            };
        }
        
        // Color logic based on V4 specifications
        switch (promptRequirement) {
            case 'mandatory':
                // RED: Missing required prompt (translate, analyze)
                if (!hasUserPrompt) {
                    return {
                        color: 'red',
                        status: 'error',
                        message: this.getErrorMessage(nodeData.type),
                        canExecute: false
                    };
                }
                break;
                
            case 'optional':
                // YELLOW: Optional prompt not provided (summarize, join)
                if (!hasUserPrompt) {
                    return {
                        color: 'yellow',
                        status: 'warning',
                        message: this.getDefaultMessage(nodeData.type),
                        canExecute: true
                    };
                }
                break;
                
            case 'none':
                // GREEN: No prompt needed (input2text, text2Output tools)
                break;
        }
        
        // GREEN: All requirements met
        return {
            color: 'green',
            status: 'ready',
            message: 'Ready to execute',
            canExecute: true
        };
    }
    
    getPromptRequirement(toolType) {
        // V4 Tool prompt requirements
        const requirements = {
            // input2text: No prompts needed
            'pdf2text': 'none',
            'audio2text': 'none', 
            'image2text': 'none',
            'video2text': 'none',
            'webscraper': 'mandatory',   // Must specify URL to scrape
            
            // textProcessing: Mixed requirements
            'translator': 'mandatory',    // Must specify target language
            'analyzer': 'mandatory',      // Must specify analysis type
            'summarizer': 'optional',     // Can use default brief summary
            'join': 'optional',          // Can use default separator
            
            // text2Output: No prompts needed
            'text2pdf': 'none',
            'text2docx': 'none'
        };
        
        return requirements[toolType] || 'none';
    }
    
    getInputRules(nodeType) {
        // Reuse the same input rules as NodeDataManager
        const rules = {
            'pdf2text': { acceptedTypes: ['.pdf'], minInputs: 1, maxInputs: null },
            'audio2text': { acceptedTypes: ['.mp3', '.wav', '.m4a', '.mp4'], minInputs: 1, maxInputs: null },
            'image2text': { acceptedTypes: ['.jpg', '.png', '.jpeg', '.gif'], minInputs: 1, maxInputs: null },
            'video2text': { acceptedTypes: ['.mp4', '.avi', '.mov'], minInputs: 1, maxInputs: null },
            'webscraper': { acceptedTypes: [], minInputs: 0, maxInputs: null },
            'summarizer': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'translator': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'analyzer': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'join': { acceptedTypes: ['.txt'], minInputs: 2, maxInputs: null },
            'text2pdf': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'text2docx': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: null },
            'text2template': { acceptedTypes: ['.txt'], minInputs: 1, maxInputs: 1 }
        };
        
        return rules[nodeType] || { acceptedTypes: [], minInputs: 1, maxInputs: null };
    }
    
    getErrorMessage(toolType) {
        const messages = {
            'webscraper': 'URL required',
            'translator': 'Target language required',
            'analyzer': 'Analysis type required'
        };
        return messages[toolType] || 'Required prompt missing';
    }
    
    getDefaultMessage(toolType) {
        const messages = {
            'summarizer': 'Using default: Brief summary',
            'join': 'Using default: Standard separator'
        };
        return messages[toolType] || 'Using default settings';
    }
    
    updateNodeColor(nodeId, colorState) {
        // Store the state
        this.nodeStates.set(nodeId, colorState);
        
        // Update visual appearance
        this.applyNodeVisualState(nodeId, colorState);
        
        // Emit event for other systems
        this.eventBus.emit('node-color-updated', {
            nodeId,
            colorState,
            canExecute: colorState.canExecute
        });
    }
    
    applyNodeVisualState(nodeId, colorState) {
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeElement) {
            console.warn(`🎨 NodeColorManager: Could not find DOM element for node ${nodeId}`);
            return;
        }
        
        console.log(`🎨 NodeColorManager: Applying ${colorState.color} color to node ${nodeId}`);
        
        // Remove existing color classes
        nodeElement.classList.remove('node-red', 'node-yellow', 'node-green');
        
        // Add new color class
        nodeElement.classList.add(`node-${colorState.color}`);
        
        console.log(`🎨 NodeColorManager: Node ${nodeId} classes:`, nodeElement.className);
        
        // Update node status indicator
        this.updateNodeStatusIndicator(nodeElement, colorState);
    }
    
    updateNodeStatusIndicator(nodeElement, colorState) {
        // REMOVED: Visual status indicators (yellow ball, DEFAULT text, etc.)
        // The user requested to remove the 3 lines: yellow ball, DEFAULT, Using default...
        // Node status is now handled through background colors only
        
        // Remove any existing status indicator
        const statusIndicator = nodeElement.querySelector('.node-status-indicator');
        if (statusIndicator) {
            statusIndicator.remove();
        }
    }
    
    setNodeDataManager(nodeDataManager) {
        this.nodeDataManager = nodeDataManager;
    }
    
    getNodeData(nodeId) {
        if (!this.nodeDataManager) {
            console.error('NodeColorManager: NodeDataManager not set');
            return null;
        }
        return this.nodeDataManager.getNodeById(nodeId);
    }
    
    // Validation methods for workflow execution
    validateWorkflowExecution(nodes) {
        const validation = {
            canExecute: true,
            errors: [],
            warnings: [],
            summary: {
                total: nodes.length,
                ready: 0,
                warnings: 0,
                errors: 0
            }
        };
        
        nodes.forEach(node => {
            const colorState = this.nodeStates.get(node.id);
            if (!colorState) return;
            
            switch (colorState.color) {
                case 'red':
                    validation.canExecute = false;
                    validation.errors.push({
                        nodeId: node.id,
                        nodeType: node.type,
                        message: colorState.message
                    });
                    validation.summary.errors++;
                    break;
                    
                case 'yellow':
                    validation.warnings.push({
                        nodeId: node.id,
                        nodeType: node.type,
                        message: colorState.message
                    });
                    validation.summary.warnings++;
                    break;
                    
                case 'green':
                    validation.summary.ready++;
                    break;
            }
        });
        
        return validation;
    }
    
    // Public API methods
    getNodeColorState(nodeId) {
        return this.nodeStates.get(nodeId);
    }
    
    getAllNodeStates() {
        return Object.fromEntries(this.nodeStates);
    }
    
    forceUpdateAllNodes(nodes) {
        // Force re-evaluation of all nodes
        nodes.forEach(node => {
            const colorState = this.evaluateNodeColor(node);
            this.updateNodeColor(node.id, colorState);
        });
    }
    
    clearNodeState(nodeId) {
        this.nodeStates.delete(nodeId);
    }
    
    clearAllStates() {
        this.nodeStates.clear();
    }
}

export { NodeColorManager };