/**
 * TextualFlowManager - Converts visual workflows to textual step-by-step representation
 * 
 * This service provides an alternative view to the visual workflow editor,
 * showing the same workflow as a readable, sequential list of processing steps.
 * 
 * Key Features:
 * - Converts visual workflow to execution JSON format
 * - Renders textual steps in table-like layout
 * - Shows file flow relationships clearly
 * - Handles user prompts and tool information
 * - Provides empty state for workflows with no steps
 * 
 * Risk Level: ZERO - Completely new service, no existing code modification
 */

class TextualFlowManager {
    constructor(eventBus, workflowEngine, toolPalette) {
        this.eventBus = eventBus;
        this.workflowEngine = workflowEngine;
        this.toolPalette = toolPalette;
        this.inputFilesManager = null; // Will be set via setInputFilesManager()
        this.currentSteps = [];
        this.setupEventListeners();
    }
    
    /**
     * Set InputFilesManager reference for accessing file metadata
     */
    setInputFilesManager(inputFilesManager) {
        this.inputFilesManager = inputFilesManager;
    }
    
    /**
     * Initialize event listeners for textual mode activation and workflow updates
     */
    setupEventListeners() {
        this.eventBus.on('mode:textual:activate', this.handleTextualActivation.bind(this));
        this.eventBus.on('workflow:updated', this.handleWorkflowUpdate.bind(this));
    }
    
    /**
     * Handle activation of textual mode - generate and render steps
     */
    async handleTextualActivation() {
        try {
            console.log('🔄 TextualFlowManager: Activating textual mode...');
            
            // Get file metadata from InputFilesManager (filenames only)
            const files = this.getUploadedFileMetadata();
            console.log('📁 Files found:', files);
            
            // Get current workflow - first try generated workflow, then export canvas
            let currentWorkflow = this.workflowEngine.getCurrentWorkflow();
            console.log('📋 Generated workflow:', currentWorkflow);
            
            if (!currentWorkflow) {
                // No generated workflow, export current canvas state
                currentWorkflow = window.toolFlowBuilder?.workflowCanvas?.exportWorkflow();
                console.log('🎨 Canvas workflow:', currentWorkflow);
            }
            
            if (!currentWorkflow || (!currentWorkflow.nodes && !currentWorkflow.actions) || 
                (currentWorkflow.nodes && currentWorkflow.nodes.length === 0) ||
                (currentWorkflow.actions && currentWorkflow.actions.length === 0)) {
                console.log('❌ No workflow or empty workflow, showing empty state');
                this.showEmptyState();
                return;
            }
            
            if (!files || files.length === 0) {
                console.log('❌ No files found, showing empty state');
                this.showEmptyState();
                return;
            }
            
            console.log('✅ Converting workflow to action JSON...');
            // Convert Visual JSON (V4) to Action JSON (execution format)
            const executionJSON = this.workflowEngine.convertVisualToActionJSON(currentWorkflow, files);
            console.log('📄 Execution JSON:', executionJSON);
            
            // Render the textual steps
            this.renderTextualSteps(executionJSON);
            
        } catch (error) {
            console.error('❌ Textual mode activation failed:', error);
            this.showEmptyState();
        }
    }
    
    /**
     * Handle workflow updates - refresh textual view if currently active
     */
    handleWorkflowUpdate() {
        const textualCanvas = document.getElementById('textualCanvas');
        if (textualCanvas && textualCanvas.classList.contains('active')) {
            // Textual mode is active, refresh the view
            this.handleTextualActivation();
        }
    }
    
    /**
     * Get uploaded file metadata (filenames) from InputFilesManager
     * Returns array of objects with { name: string } structure
     */
    getUploadedFileMetadata() {
        if (!this.inputFilesManager) {
            console.warn('InputFilesManager not connected to TextualFlowManager');
            return [];
        }
        
        // Get input file labels from InputFilesManager
        const inputFileLabels = this.inputFilesManager.getInputFileLabels();
        
        // Convert to the format expected by convertWorkflowToAPIJSON
        // Map each label to a file object with name property
        return inputFileLabels.map(label => ({
            name: label.originalName,
            size: label.fileSize,
            type: label.fileType,
            label: label.label // Keep the A, B, C label for reference
        }));
    }
    
    /**
     * Render textual steps from execution JSON
     */
    renderTextualSteps(executionJSON) {
        const container = document.getElementById('textualSteps');
        if (!container) {
            console.warn('Textual steps container not found');
            return;
        }
        
        container.innerHTML = '';
        
        if (!executionJSON.actions || executionJSON.actions.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Create headers
        const headers = this.createStepHeaders();
        container.appendChild(headers);
        
        // Create each step row
        executionJSON.actions.forEach((action, index) => {
            const stepElements = this.createStepElement(action, index + 1, executionJSON.fileMapping);
            stepElements.forEach(element => container.appendChild(element));
        });
    }
    
    /**
     * Create table headers for textual steps
     */
    createStepHeaders() {
        const headers = document.createElement('div');
        headers.className = 'step-headers';
        
        headers.innerHTML = `
            <div class="header-cell">Step</div>
            <div class="header-cell">Tool</div>
            <div class="header-cell">Input Files</div>
            <div class="header-cell">Output Files</div>
        `;
        
        return headers;
    }
    
    /**
     * Create step element(s) for a single action
     * Returns array of DOM elements (step row + optional prompt row)
     */
    createStepElement(action, stepNumber, fileMapping) {
        const elements = [];
        
        // Get tool definition from ToolPalette
        const toolDef = this.toolPalette?.findToolById(action.toolType) || {
            icon: '🔧',
            name: action.toolType,
            category: 'unknown'
        };
        
        // Create main step row
        const stepRow = document.createElement('div');
        stepRow.className = 'step-row';
        stepRow.dataset.step = stepNumber;
        
        // Check if this is the final deliverable (outputRequired: true)
        if (action.outputRequired) {
            stepRow.classList.add('final-deliverable');
        }
        
        // Map file codes (A, B, C) to actual names
        const inputFileNames = action.inputFiles.map(fileCode => 
            fileMapping[fileCode] || fileCode
        );
        
        // Determine tool category for color coding
        const toolCategory = this.getToolCategory(toolDef.category || action.toolType);
        
        stepRow.innerHTML = `
            <div class="step-number ${toolCategory}">${stepNumber}</div>
            <div class="step-tool">
                <span class="tool-icon">${toolDef.icon}</span>
                ${toolDef.name || this.formatToolName(action.toolType)}
            </div>
            <div class="step-files">
                ${inputFileNames.map(name => `<span class="file-tag">${name}</span>`).join('')}
            </div>
            <div class="step-outputs">
                <span class="file-tag ${action.outputRequired ? 'final' : 'output'}">${action.outputFile}</span>
            </div>
        `;
        
        elements.push(stepRow);
        
        // Add user prompt row if present
        if (action.toolUserPrompt && action.toolUserPrompt.trim()) {
            const promptRow = document.createElement('div');
            promptRow.className = 'user-prompt-row';
            
            promptRow.innerHTML = `
                <span class="prompt-label">User prompt:</span>
                <span class="prompt-text">${action.toolUserPrompt}</span>
            `;
            
            elements.push(promptRow);
        }
        
        return elements;
    }
    
    /**
     * Get tool category class name for color coding
     */
    getToolCategory(category) {
        const categoryMap = {
            'convert-to-text': 'convert-to-text',
            'process-text': 'process-text', 
            'convert-from-text': 'convert-from-text',
            'audio2text': 'convert-to-text',
            'video2text': 'convert-to-text',
            'pdf2text': 'convert-to-text',
            'image2text': 'convert-to-text',
            'analyzer': 'process-text',
            'join': 'process-text',
            'text2pdf': 'convert-from-text'
        };
        
        return categoryMap[category] || categoryMap[category?.toLowerCase()] || 'convert-to-text';
    }
    
    /**
     * Format tool type name for display
     */
    formatToolName(toolType) {
        const nameMap = {
            'audio2text': 'Audio→Text',
            'video2text': 'Video→Text', 
            'pdf2text': 'PDF→Text',
            'image2text': 'Image→Text',
            'text2pdf': 'Text→PDF',
            'analyzer': 'Analyze',
            'join': 'Join'
        };
        
        return nameMap[toolType] || toolType.charAt(0).toUpperCase() + toolType.slice(1);
    }
    
    /**
     * Show empty state when no workflow exists
     */
    showEmptyState() {
        const container = document.getElementById('textualSteps');
        if (!container) return;
        
        container.innerHTML = `
            <div class="textual-empty-state">
                <div class="empty-icon">📋</div>
                <h3>No Workflow Steps</h3>
                <p>Create a workflow in Visual mode to see the step-by-step breakdown here.</p>
            </div>
        `;
    }
    
    /**
     * Clear textual steps container
     */
    clearSteps() {
        const container = document.getElementById('textualSteps');
        if (container) {
            container.innerHTML = '';
        }
        this.currentSteps = [];
    }
    
    /**
     * Get current steps for external access
     */
    getCurrentSteps() {
        return this.currentSteps;
    }
}

export { TextualFlowManager };