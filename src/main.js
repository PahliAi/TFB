// Main Application Entry Point
import { UploadZone } from './components/UploadZone.js';
import { WorkflowCanvasManager } from './components/WorkflowCanvasManager.js';
import { OutputZone } from './components/OutputZone.js';
import { VoiceInput } from './components/VoiceInput.js';
import { ToolPalette } from './components/ToolPalette.js';
import { OpenAIService } from './services/OpenAIService.js';
import { FileProcessor } from './services/FileProcessor.js';
import { WorkflowEngine } from './services/WorkflowEngine.js';
import { UIUtils } from './utils/UIUtils.js';
import { EventBus } from './utils/EventBus.js';
import { OutputNaming } from './services/OutputNaming.js';
import { SimpleResize } from './services/SimpleResize.js';
import { InputFilesManager } from './services/InputFilesManager.js';
import { TextFilesManager } from './services/TextFilesManager.js';
import { OutputRouter } from './services/OutputRouter.js';
import { NodeColorManager } from './services/NodeColorManager.js';
import { ToolStyleManager } from './services/ToolStyleManager.js';
import { ScrollManager } from './utils/ScrollManager.js';
import { CascadingDeleteManager } from './services/CascadingDeleteManager.js';
import { ConnectionManager } from './services/ConnectionManager.js';
import { CanvasZoomManager } from './services/CanvasZoomManager.js';
import { NodeDataManager } from './services/NodeDataManager.js';
import { NodeUIManager } from './services/NodeUIManager.js';
import { TextualFlowManager } from './services/TextualFlowManager.js';
import { Config } from './config/config.js';

class ToolFlowBuilder {
    constructor() {
        console.log('ToolFlowBuilder constructor started');
        this.eventBus = new EventBus();
        console.log('EventBus created');
        this.initializeComponents();
        console.log('Components initialized');
        this.initializeServices();
        console.log('Services initialized');
        this.initializeResize();
        console.log('Resize initialized');
        this.setupEventListeners();
        console.log('Event listeners setup');
        this.initializeApp();
        console.log('App initialized');
    }

    initializeComponents() {
        console.log('Initializing components...');
        // Initialize CascadingDeleteManager and ConnectionManager early since other managers need them
        this.cascadingDeleteManager = new CascadingDeleteManager(this.eventBus);
        console.log('CascadingDeleteManager created');
        
        this.connectionManager = new ConnectionManager(this.eventBus);
        console.log('ConnectionManager created');
        
        this.canvasZoomManager = new CanvasZoomManager(this.eventBus);
        console.log('CanvasZoomManager created');
        
        // NEW ARCHITECTURE: Initialize NodeDataManager and NodeUIManager
        this.nodeDataManager = new NodeDataManager(this.eventBus);
        console.log('NodeDataManager created');
        
        this.nodeUIManager = new NodeUIManager(this.eventBus);
        console.log('NodeUIManager created');
        
        // Initialize V4 managers first
        this.inputFilesManager = new InputFilesManager(this.eventBus);
        console.log('InputFilesManager created');
        this.textFilesManager = new TextFilesManager(this.eventBus);
        console.log('TextFilesManager created');
        
        // Initialize components with V4 managers
        this.uploadZone = new UploadZone(this.eventBus, this.inputFilesManager, this.textFilesManager);
        console.log('UploadZone created');
        this.workflowCanvas = new WorkflowCanvasManager(this.eventBus);
        console.log('WorkflowCanvasManager created');
        this.outputZone = new OutputZone(this.eventBus);
        console.log('OutputZone created - this should trigger initialize()');
        this.voiceInput = new VoiceInput(this.eventBus);
        console.log('VoiceInput created');
        this.toolPalette = new ToolPalette(this.eventBus);
        console.log('ToolPalette created');
        
        // Initialize centralized styling manager
        this.toolStyleManager = new ToolStyleManager(this.toolPalette);
        console.log('ToolStyleManager created');
        
        // NEW ARCHITECTURE: Connect dependencies properly
        // Set up NodeUIManager dependencies
        this.nodeUIManager.setNodeDataManager(this.nodeDataManager);
        this.nodeUIManager.setToolPalette(this.toolPalette);
        this.nodeUIManager.setToolStyleManager(this.toolStyleManager);
        console.log('NodeUIManager dependencies connected');
        
        // Set up WorkflowCanvasManager dependencies 
        this.workflowCanvas.setNodeDataManager(this.nodeDataManager);
        this.workflowCanvas.setNodeUIManager(this.nodeUIManager);
        this.workflowCanvas.setConnectionManager(this.connectionManager);
        this.workflowCanvas.setToolPalette(this.toolPalette);
        console.log('WorkflowCanvasManager dependencies connected');
        
        // Connect other components
        this.textFilesManager.setToolStyleManager(this.toolStyleManager);
        this.outputZone.setToolStyleManager(this.toolStyleManager);
        console.log('ToolStyleManager connected to all components');
        
        // Connect CascadingDeleteManager to NEW components
        this.cascadingDeleteManager.setComponents(
            this.nodeDataManager,  // Changed from nodeManager
            this.workflowCanvas, 
            this.textFilesManager, 
            this.inputFilesManager,
            this.outputZone,
            this.connectionManager
        );
        console.log('CascadingDeleteManager connected to all components');
    }

    initializeServices() {
        this.openAIService = new OpenAIService();
        this.fileProcessor = new FileProcessor();
        this.workflowEngine = new WorkflowEngine(this.eventBus, this.openAIService);
        this.outputNaming = new OutputNaming();
        this.outputNaming.init(this.eventBus);
        
        // V4 services initialized above with managers
        
        // Initialize remaining V4 services
        this.outputRouter = new OutputRouter(this.eventBus, this.textFilesManager);
        this.nodeColorManager = new NodeColorManager(this.eventBus, this.toolPalette);
        this.nodeColorManager.setNodeDataManager(this.nodeDataManager);
        this.scrollManager = new ScrollManager();
        
        // Connect WorkflowEngine to OutputZone for business names
        this.workflowEngine.setOutputZone(this.outputZone);
        
        // Connect WorkflowEngine to ToolPalette for system prompts
        this.workflowEngine.setToolPalette(this.toolPalette);
        
        // Initialize TextualFlowManager for textual workflow mode
        this.textualFlowManager = new TextualFlowManager(
            this.eventBus, 
            this.workflowEngine, 
            this.toolPalette
        );
        
        // Connect TextualFlowManager to InputFilesManager for file metadata
        this.textualFlowManager.setInputFilesManager(this.inputFilesManager);
        console.log('TextualFlowManager created and connected to InputFilesManager');
    }

    initializeResize() {
        this.simpleResize = new SimpleResize();
    }

    setupEventListeners() {
        // File upload events
        this.eventBus.on('files-uploaded', this.handleFilesUploaded.bind(this));
        this.eventBus.on('files-cleared', this.handleFilesCleared.bind(this));

        // Workflow events
        this.eventBus.on('workflow-generated', this.handleWorkflowGenerated.bind(this));
        this.eventBus.on('workflow-executed', this.handleWorkflowExecuted.bind(this));
        this.eventBus.on('node-added', this.handleNodeAdded.bind(this));
        this.eventBus.on('node-deleted', this.handleNodeDeleted.bind(this));
        this.eventBus.on('connection-created', this.handleConnectionCreated.bind(this));

        // Voice input events
        this.eventBus.on('voice-transcript', this.handleVoiceTranscript.bind(this));

        // UI events
        this.eventBus.on('status-update', this.handleStatusUpdate.bind(this));
        this.eventBus.on('error', this.handleError.bind(this));

        // Label movement events
        this.eventBus.on('move-label-to-node', this.handleMoveLabelToNode.bind(this));
        
        // Output zone events
        this.eventBus.on('output-added', this.handleOutputAdded.bind(this));

        // Button event listeners
        this.setupButtonListeners();
    }

    setupButtonListeners() {
        // New layout button IDs
        const generateFlowBtn = document.getElementById('generateFlowBtn');
        const describeFlowBtn = document.getElementById('describeFlowBtn');
        const executeBtn = document.getElementById('executeWorkflowBtn');
        const clearCanvasBtn = document.getElementById('clearCanvasBtn');
        const exportWorkflowBtn = document.getElementById('exportWorkflowBtn');
        const textInput = document.getElementById('textInput');

        generateFlowBtn?.addEventListener('click', this.handleGenerateFlow.bind(this));
        describeFlowBtn?.addEventListener('click', this.handleDescribeFlow.bind(this));
        executeBtn?.addEventListener('click', this.handleExecuteWorkflow.bind(this));
        clearCanvasBtn?.addEventListener('click', this.handleClearCanvas.bind(this));
        exportWorkflowBtn?.addEventListener('click', this.handleExportWorkflow.bind(this));
        
        const toggleConnectionsBtn = document.getElementById('toggleConnectionsBtn');
        toggleConnectionsBtn?.addEventListener('click', this.handleToggleConnections.bind(this));
        
        // Mode toggle buttons
        const visualModeBtn = document.getElementById('visualModeBtn');
        const textualModeBtn = document.getElementById('textualModeBtn');
        const debugCacheBtn = document.getElementById('debugCacheBtn');
        visualModeBtn?.addEventListener('click', this.handleSwitchToVisualMode.bind(this));
        textualModeBtn?.addEventListener('click', this.handleSwitchToTextualMode.bind(this));
        debugCacheBtn?.addEventListener('click', this.handleDebugCacheInspector.bind(this));
        
        // Text input changes enable/disable generate button
        textInput?.addEventListener('input', this.handleTextInputChange.bind(this));
        
        // Enable drag and drop on text input
        this.setupTextInputDragAndDrop();
    }

    setupTextInputDragAndDrop() {
        const textInput = document.getElementById('textInput');
        if (!textInput) return;

        // Allow dropping on text input
        textInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            textInput.classList.add('border-blue-400', 'bg-blue-50');
        });

        textInput.addEventListener('dragleave', (e) => {
            textInput.classList.remove('border-blue-400', 'bg-blue-50');
        });

        textInput.addEventListener('drop', (e) => {
            e.preventDefault();
            textInput.classList.remove('border-blue-400', 'bg-blue-50');
            
            // Get file label from drag data
            const fileLabel = e.dataTransfer.getData('application/x-file-label');
            const fileName = e.dataTransfer.getData('application/x-file-name');
            
            if (fileLabel) {
                // Insert file label at cursor position
                const cursorPos = textInput.selectionStart;
                const textBefore = textInput.value.substring(0, cursorPos);
                const textAfter = textInput.value.substring(textInput.selectionEnd, textInput.value.length);
                
                // Insert the file label with space if needed
                const labelToInsert = fileLabel;
                const needsSpaceBefore = textBefore.length > 0 && textBefore[textBefore.length - 1] !== ' ';
                const needsSpaceAfter = textAfter.length > 0 && textAfter[0] !== ' ';
                
                const insertText = (needsSpaceBefore ? ' ' : '') + labelToInsert + (needsSpaceAfter ? ' ' : '');
                textInput.value = textBefore + insertText + textAfter;
                
                // Move cursor to end of inserted text
                const newCursorPos = cursorPos + insertText.length;
                textInput.setSelectionRange(newCursorPos, newCursorPos);
                textInput.focus();
                
                // Trigger input event to update buttons
                textInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // Event Handlers - V4 Architecture
    handleFilesUploaded(files) {
        console.log('V4 Files uploaded:', files);
        
        // V4 Flow: Files → InputFilesManager (File List Box) + Auto .txt creation (TextFiles Box)
        // The InputFilesManager will emit 'input-file-labels-created'
        // The TextFilesManager listens and auto-creates .txt labels
        
        // Trigger the V4 upload flow
        this.inputFilesManager.handleFilesUploaded(files);
        
        this.handleTextInputChange();
    }

    // OLD METHODS REMOVED - Backed up in LegacyMethods.js
    // V4 Architecture with InputFiles and TextFiles managers

    getConversionType(file) {
        switch (file.category) {
            case 'audio':
                return 'audio2text';
            case 'video':
                return 'video2audio';
            case 'pdf':
                return 'pdf2text';
            case 'image':
                return 'image2text';
            default:
                return null;
        }
    }

    handleFilesCleared() {
        console.log('Files cleared');
        this.handleTextInputChange();
        this.workflowCanvas.clear();
        this.outputZone.clear();
    }

    handleWorkflowGenerated(workflow) {
        console.log('Workflow generated:', workflow);
        this.workflowCanvas.renderWorkflow(workflow);
        this.handleTextInputChange(); // Update buttons since we now have a workflow
        this.updateExecuteButton(); // Check if workflow is ready to execute
        this.eventBus.emit('status-update', 'Workflow generated successfully! Click Execute to run it.');
    }

    handleWorkflowExecuted(results) {
        console.log('Workflow executed:', results);
        // Don't call displayResults for demo execution - outputs are already routed via 'output-added' events
        // Only call displayResults for regular workflow execution (future feature)
        this.eventBus.emit('status-update', 'Workflow executed successfully!');
    }

    handleNodeAdded(node) {
        console.log('Node added:', node);
        this.updateExecuteButton(); // Check if workflow is now valid
    }

    handleNodeDeleted(node) {
        console.log('Node deleted:', node);
        this.updateExecuteButton(); // Check if workflow is still valid
    }
    
    handleOutputAdded(output) {
        console.log('Output added:', output);
        this.updateExecuteButton(); // Check if workflow is now valid
    }

    handleConnectionCreated(connection) {
        console.log('Connection created:', connection);
    }

    handleVoiceTranscript(transcript) {
        console.log('Voice transcript:', transcript);
        // Auto-generate workflow from voice input
        this.generateWorkflowFromText(transcript);
    }

    handleStatusUpdate(message) {
        UIUtils.showStatus(message);
    }

    handleError(error) {
        console.error('Application error:', error);
        UIUtils.showError(error.message || 'An unexpected error occurred');
    }

    // Action Handlers
    handleTextInputChange() {
        const textInput = document.getElementById('textInput');
        const generateBtn = document.getElementById('generateFlowBtn');
        const describeBtn = document.getElementById('describeFlowBtn');
        
        const hasText = textInput?.value.trim().length > 0;
        const hasFiles = this.uploadZone.getFiles().length > 0;
        
        if (generateBtn) {
            generateBtn.disabled = !(hasText && hasFiles);
        }
        if (describeBtn) {
            describeBtn.disabled = !hasFiles; // Can describe existing workflow
        }
        
        // Update execute button based on workflow validation
        this.updateExecuteButton();
    }

    updateExecuteButton() {
        const executeBtn = document.getElementById('executeWorkflowBtn');
        if (!executeBtn) return;

        const workflow = this.workflowCanvas.exportWorkflow();
        const isValidWorkflow = this.validateWorkflow(workflow);
        
        executeBtn.disabled = !isValidWorkflow;
        
        if (isValidWorkflow) {
            // Add pulsing animation when ready
            executeBtn.classList.add('animate-pulse');
        } else {
            executeBtn.classList.remove('animate-pulse');
        }
    }

    validateWorkflow(workflow) {
        const files = this.uploadZone.getFiles();
        
        // Must have files uploaded
        if (files.length === 0) {
            return false;
        }
        
        // Must have at least one output file defined
        const outputs = this.outputZone.getOutputs();
        if (outputs.length === 0) {
            return false;
        }

        // SIMPLIFIED VALIDATION: Allow execution with just outputs (no nodes needed)
        // This supports direct TextFiles → OutputFiles workflows
        
        // If no workflow or no nodes, but we have outputs, allow execution
        if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
            return true; // Can execute with just text files → output files
        }
        
        // If there are nodes, validate them
        const nodesWithInputs = workflow.nodes.filter(node => 
            (node.fileInputs && node.fileInputs.length > 0) ||
            (node.inputLabels && node.inputLabels.length > 0)
        );
        
        // If nodes exist but none have inputs, workflow is invalid
        if (nodesWithInputs.length === 0) {
            return false;
        }
        
        // Check for loops (basic cycle detection)
        const hasLoops = this.detectWorkflowLoops(workflow);
        
        // Check for duplicate actions on same inputs
        const hasDuplicates = this.detectDuplicateActions(workflow);
        
        return !hasLoops && !hasDuplicates;
    }

    detectWorkflowLoops(workflow) {
        // Simple cycle detection using DFS
        const visited = new Set();
        const recStack = new Set();
        
        const dfs = (nodeId) => {
            if (recStack.has(nodeId)) return true; // Cycle found
            if (visited.has(nodeId)) return false;
            
            visited.add(nodeId);
            recStack.add(nodeId);
            
            const connections = workflow.connections?.filter(c => c.from === nodeId) || [];
            for (const conn of connections) {
                if (dfs(conn.to)) return true;
            }
            
            recStack.delete(nodeId);
            return false;
        };
        
        for (const node of workflow.nodes) {
            if (!visited.has(node.id) && dfs(node.id)) {
                return true;
            }
        }
        return false;
    }

    detectDuplicateActions(workflow) {
        // Check for duplicate node types on same inputs
        const nodesByInputs = new Map();
        
        for (const node of workflow.nodes) {
            const inputKey = node.inputLabels?.sort().join(',') || '';
            const typeInputKey = `${node.type}:${inputKey}`;
            
            if (nodesByInputs.has(typeInputKey)) {
                return true; // Duplicate found
            }
            nodesByInputs.set(typeInputKey, node);
        }
        return false;
    }

    tryRuleBasedGeneration(text, files) {
        const lowerText = text.toLowerCase();
        
        // Simple pattern matching for common workflows
        const patterns = [
            {
                pattern: /translate.*files?\s+([a-z,\s]+)\s+(?:into|to)\s+(\w+)/i,
                generator: (match) => this.generateTranslationWorkflow(match, files)
            },
            {
                pattern: /summarize.*files?\s+([a-z,\s]+)/i,
                generator: (match) => this.generateSummarizeWorkflow(match, files)
            },
            {
                pattern: /convert.*(?:audio|video).*(?:to\s+)?text/i,
                generator: () => this.generateConversionWorkflow(files)
            },
            {
                pattern: /analyze.*files?\s+([a-z,\s]+)/i,
                generator: (match) => this.generateAnalysisWorkflow(match, files)
            }
        ];
        
        for (const { pattern, generator } of patterns) {
            const match = text.match(pattern);
            if (match) {
                console.log(`Rule-based generation: matched pattern ${pattern}`);
                return generator(match);
            }
        }
        
        return null; // No pattern matched, fallback to AI
    }

    generateTranslationWorkflow(match, files) {
        const fileLabels = this.extractFileLabels(match[1]);
        const targetLanguage = match[2];
        
        if (fileLabels.length === 0) return null;
        
        const nodes = [];
        const connections = [];
        let nodeId = 1;
        
        fileLabels.forEach((label, index) => {
            const file = files.find(f => f.label === label.toUpperCase());
            if (!file) return;
            
            const y = 100 + (index * 100);
            
            // Add conversion node if needed
            if (file.category !== 'text') {
                const conversionType = this.getConversionType(file);
                if (conversionType) {
                    const convNode = {
                        id: `node_${nodeId++}`,
                        type: conversionType,
                        position: { x: 100, y },
                        inputs: [file.label],
                        outputs: [`${file.name.split('.')[0]}_text.txt`]
                    };
                    nodes.push(convNode);
                }
            }
            
            // Add translation node
            const translationNode = {
                id: `node_${nodeId++}`,
                type: 'translator',
                position: { x: 300, y },
                inputs: [],
                params: { language: targetLanguage },
                outputs: [`${file.name.split('.')[0]}_${targetLanguage}.txt`]
            };
            nodes.push(translationNode);
        });
        
        return this.createWorkflow(nodes, connections, files);
    }

    generateSummarizeWorkflow(match, files) {
        const fileLabels = this.extractFileLabels(match[1]);
        if (fileLabels.length === 0) return null;
        
        const nodes = [];
        let nodeId = 1;
        
        fileLabels.forEach((label, index) => {
            const file = files.find(f => f.label === label.toUpperCase());
            if (!file) return;
            
            const y = 100 + (index * 100);
            
            // Add conversion if needed, then summarizer
            if (file.category !== 'text') {
                const conversionType = this.getConversionType(file);
                if (conversionType) {
                    nodes.push({
                        id: `node_${nodeId++}`,
                        type: conversionType,
                        position: { x: 100, y },
                        inputs: [file.label],
                        outputs: [`${file.name.split('.')[0]}_text.txt`]
                    });
                }
            }
            
            nodes.push({
                id: `node_${nodeId++}`,
                type: 'summarizer',
                position: { x: 300, y },
                inputs: [],
                outputs: [`${file.name.split('.')[0]}_summary.txt`]
            });
        });
        
        return this.createWorkflow(nodes, [], files);
    }

    generateConversionWorkflow(files) {
        const nodes = [];
        let nodeId = 1;
        
        files.forEach((file, index) => {
            if (file.category === 'audio' || file.category === 'video') {
                const y = 100 + (index * 100);
                const conversionType = this.getConversionType(file);
                
                if (conversionType) {
                    nodes.push({
                        id: `node_${nodeId++}`,
                        type: conversionType,
                        position: { x: 100, y },
                        inputs: [file.label],
                        outputs: [`${file.name.split('.')[0]}_text.txt`]
                    });
                }
            }
        });
        
        return nodes.length > 0 ? this.createWorkflow(nodes, [], files) : null;
    }

    generateAnalysisWorkflow(match, files) {
        const fileLabels = this.extractFileLabels(match[1]);
        if (fileLabels.length === 0) return null;
        
        const nodes = [];
        let nodeId = 1;
        
        fileLabels.forEach((label, index) => {
            const file = files.find(f => f.label === label.toUpperCase());
            if (!file) return;
            
            const y = 100 + (index * 100);
            
            // Conversion + Analysis
            if (file.category !== 'text') {
                const conversionType = this.getConversionType(file);
                if (conversionType) {
                    nodes.push({
                        id: `node_${nodeId++}`,
                        type: conversionType,
                        position: { x: 100, y },
                        inputs: [file.label],
                        outputs: [`${file.name.split('.')[0]}_text.txt`]
                    });
                }
            }
            
            nodes.push({
                id: `node_${nodeId++}`,
                type: 'analyzer',
                position: { x: 300, y },
                inputs: [],
                outputs: [`${file.name.split('.')[0]}_analysis.txt`]
            });
        });
        
        return this.createWorkflow(nodes, [], files);
    }

    extractFileLabels(text) {
        // Extract file labels like "B", "A and C", "B, D and E"
        const labels = text.match(/[a-z]/gi) || [];
        return [...new Set(labels)]; // Remove duplicates
    }

    createWorkflow(nodes, connections, files) {
        return {
            id: `workflow_${Date.now()}`,
            name: 'Rule-based Generated Workflow',
            created: new Date().toISOString(),
            files: files.map((file, index) => ({
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                label: file.label
            })),
            nodes: nodes,
            connections: connections,
            metadata: {
                generated: true,
                ruleBasedGeneration: true,
                timestamp: Date.now()
            }
        };
    }

    async handleGenerateFlow() {
        const textInput = document.getElementById('textInput');
        const files = this.uploadZone.getFiles();
        const userText = textInput?.value.trim();

        if (!userText) {
            this.handleError({ message: 'Please describe what you want to do' });
            return;
        }
        if (files.length === 0) {
            this.handleError({ message: 'Please upload files first' });
            return;
        }

        try {
            this.eventBus.emit('status-update', 'Analyzing your description...');
            
            // Try rule-based generation first (faster, no API cost)
            const ruleBasedWorkflow = this.tryRuleBasedGeneration(userText, files);
            
            if (ruleBasedWorkflow) {
                this.eventBus.emit('status-update', 'Generated workflow using built-in rules (no AI needed)!');
                this.eventBus.emit('workflow-generated', ruleBasedWorkflow);
            } else {
                // Fallback to AI generation
                this.eventBus.emit('status-update', 'Using AI to generate complex workflow...');
                const workflow = await this.workflowEngine.generateWorkflowFromText(userText, files);
                this.eventBus.emit('workflow-generated', workflow);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    async handleDescribeFlow() {
        const workflow = this.workflowCanvas.exportWorkflow();
        const textInput = document.getElementById('textInput');
        
        if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
            this.handleError({ message: 'No workflow to describe - create one first' });
            return;
        }

        try {
            this.eventBus.emit('status-update', 'Describing current workflow...');
            const description = await this.workflowEngine.describeWorkflow(workflow);
            if (textInput) {
                textInput.value = description;
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    handleThemeToggle() {
        document.body.classList.toggle('dark');
        const themeIcon = document.getElementById('themeToggle');
        if (themeIcon) {
            themeIcon.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
        }
    }

    async handleClearCanvas() {
        // Use CascadingDeleteManager for consistent UX with confirmation modal
        const cleared = await this.cascadingDeleteManager.clearAllWorkflowNodes();
        
        if (cleared) {
            // CascadingDeleteManager already cleared nodes and outputZone
            // Just clear additional UI components
            this.connectionManager.clearAllConnections();
            this.nodeColorManager.clearAllStates();
            
            // Clear text input
            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.value = '';
            }
            
            // Update button states
            this.handleTextInputChange();
            
            console.log('🧹 Workflow cleared (input files preserved)');
        }
    }

    handleExportWorkflow() {
        const workflow = this.workflowCanvas.exportWorkflow();
        const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toolflowbuilder-v4_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📄 Exported V4 workflow JSON format');
    }

    handleToggleConnections() {
        this.eventBus.emit('toggle-connections');
        
        // Update button text
        const toggleBtn = document.getElementById('toggleConnectionsBtn');
        if (toggleBtn) {
            const currentText = toggleBtn.textContent;
            toggleBtn.textContent = currentText.includes('Hide') ? 'Show Connections' : 'Hide Connections';
        }
    }

    handleSwitchToVisualMode() {
        // Update mode toggle buttons
        document.getElementById('visualModeBtn')?.classList.add('active');
        document.getElementById('textualModeBtn')?.classList.remove('active');
        
        // Switch canvas views
        document.getElementById('visualCanvas')?.classList.add('active');
        document.getElementById('visualCanvas')?.classList.remove('hidden');
        document.getElementById('textualCanvas')?.classList.remove('active');
        document.getElementById('textualCanvas')?.classList.add('hidden');
        
        console.log('🎨 Switched to Visual mode');
    }

    handleSwitchToTextualMode() {
        // Update mode toggle buttons
        document.getElementById('textualModeBtn')?.classList.add('active');
        document.getElementById('visualModeBtn')?.classList.remove('active');
        
        // Switch canvas views
        document.getElementById('textualCanvas')?.classList.add('active');
        document.getElementById('textualCanvas')?.classList.remove('hidden');
        document.getElementById('visualCanvas')?.classList.remove('active');
        document.getElementById('visualCanvas')?.classList.add('hidden');
        
        // Sync toolbar states (Execute button enabled/disabled)
        this.syncToolbarStates();
        
        // Trigger textual flow generation
        this.eventBus.emit('mode:textual:activate');
        
        console.log('📋 Switched to Textual mode');
    }

    syncToolbarStates() {
        // Textual mode is now read-only, no toolbar sync needed
        // Method kept for potential future use
    }

    handleDebugCacheInspector() {
        // Get all relevant data for debugging
        const files = this.inputFilesManager?.getInputFileLabels() || [];
        const visualWorkflow = this.workflowCanvas?.exportWorkflow();
        const actionJSON = this.textualFlowManager ? 
            this.workflowEngine.convertVisualToActionJSON(visualWorkflow, files.map(f => ({
                name: f.originalName,
                size: f.fileSize,
                type: f.fileType,
                label: f.label
            }))) : null;

        // Create debug modal content
        const debugContent = `
            <div style="max-height: 70vh; overflow-y: auto; font-family: monospace; font-size: 12px;">
                <h3 style="margin-bottom: 1rem; color: #374151;">🔍 Cache Inspector</h3>
                
                <div style="margin-bottom: 2rem;">
                    <h4 style="color: #059669; margin-bottom: 0.5rem;">📁 Input Files (${files.length})</h4>
                    <pre style="background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto;">${JSON.stringify(files, null, 2)}</pre>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <h4 style="color: #3b82f6; margin-bottom: 0.5rem;">🎨 Visual JSON (json1) - Export Format</h4>
                    <pre style="background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto;">${JSON.stringify(visualWorkflow, null, 2)}</pre>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <h4 style="color: #f59e0b; margin-bottom: 0.5rem;">⚡ Action JSON (json2) - Textual Mode</h4>
                    <pre style="background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto;">${JSON.stringify(actionJSON, null, 2)}</pre>
                </div>
            </div>
        `;

        // Import UIUtils and show modal
        import('./utils/UIUtils.js').then(({ UIUtils }) => {
            UIUtils.createModal('🔍 Debug Cache Inspector', debugContent, [
                {
                    text: 'Close',
                    action: 'close',
                    className: 'background-color: #6b7280; color: white;',
                    handler: (e, modal) => UIUtils.removeModal(modal)
                }
            ]);
        });

        console.log('🔍 Debug Cache Inspector - Data logged to console');
        console.log('📁 Files:', files);
        console.log('🎨 Visual JSON:', visualWorkflow);
        console.log('⚡ Action JSON:', actionJSON);
    }

    // Utility Methods
    async handleExecuteWorkflow() {
        try {
            // V4: Support direct TextFiles → OutputFiles execution without requiring generated workflow
            const workflow = this.workflowCanvas.exportWorkflow();
            const isValid = this.validateWorkflow(workflow);
            
            if (!isValid) {
                this.handleError({ message: 'Please upload files and create output files first' });
                return;
            }

            this.eventBus.emit('status-update', 'Executing workflow...');
            
            // Check if there's a visual workflow on canvas or if it's easter egg demo
            const files = this.uploadZone.getFiles();
            
            if (this.isEasterEggScenario(files)) {
                // Execute easter egg demo workflow - prioritize this over visual workflow
                const results = await this.workflowEngine.executeDemoEasterEggWorkflow(files);
                this.eventBus.emit('workflow-executed', results);
            } else if (workflow && workflow.actions && workflow.actions.length > 0) {
                // Execute visual workflow from canvas (TODO: implement V4 format support)
                this.handleError({ message: 'Visual workflow execution not yet implemented for V4 format. Please use the easter egg demo files for now.' });
            } else {
                // No visual workflow and not easter egg - show error
                this.handleError({ message: 'Please create a visual workflow by adding nodes and connections on the canvas, or upload the demo files for the easter egg scenario' });
            }
        } catch (error) {
            this.handleError(error);
        }
    }





    async generateWorkflowFromText(text) {
        const files = this.uploadZone.getFiles();
        if (files.length === 0) {
            this.handleError({ message: 'Please upload files first' });
            return;
        }

        try {
            this.eventBus.emit('status-update', 'Generating workflow from voice input...');
            const workflow = await this.workflowEngine.generateWorkflowFromText(text, files);
            this.eventBus.emit('workflow-generated', workflow);
        } catch (error) {
            this.handleError(error);
        }
    }

    handleMoveLabelToNode(data) {
        const { label, sourceType, sourceNodeId, targetNodeId } = data;
        
        // V4: Direct event emission - WorkflowCanvas handles the actual move
        this.eventBus.emit('node:label:add', {
            nodeId: targetNodeId,
            label: label
        });
        
        if (sourceNodeId && sourceNodeId !== 'upload') {
            // If moving from another node, remove from source
            this.eventBus.emit('node:label:remove', {
                nodeId: sourceNodeId,
                label: label
            });
        }
        
        const sourceDesc = sourceNodeId ? `node ${sourceNodeId}` : sourceType;
        console.log(`Moving label ${label} from ${sourceDesc} to node ${targetNodeId}`);
        this.eventBus.emit('status-update', `Moved ${label} to node`);
    }

    // Apply feature flags for MVP
    applyFeatureFlags() {
        const features = Config.features;
        
        if (!features.textVoiceInput) {
            // Hide the entire text/voice input area
            const inputArea = document.querySelector('.input-area');
            if (inputArea) {
                inputArea.style.display = 'none';
                console.log('🔧 Text/Voice input area hidden by feature flag');
            }
        } else {
            // Individual button controls if input area is visible
            if (!features.generateButton) {
                const generateBtn = document.getElementById('generateFlowBtn');
                if (generateBtn) {
                    generateBtn.style.display = 'none';
                    console.log('🔧 Generate button hidden by feature flag');
                }
            }
            
            if (!features.voiceInput) {
                const voiceBtn = document.getElementById('voiceInputBtn');
                if (voiceBtn) {
                    voiceBtn.style.display = 'none';
                    console.log('🔧 Voice input button hidden by feature flag');
                }
            }
            
            if (!features.describeButton) {
                const describeBtn = document.getElementById('describeFlowBtn');
                if (describeBtn) {
                    describeBtn.style.display = 'none';
                    console.log('🔧 Describe button hidden by feature flag');
                }
            }
        }
    }

    // Initialization
    initializeApp() {
        console.log('ToolFlowBuilder initialized successfully');
        
        // Apply feature flags for MVP
        this.applyFeatureFlags();
        
        // Ensure clean state on page refresh
        this.handleClearCanvas();
        
        this.eventBus.emit('status-update', 'Ready to build workflows!');
        
        // Hide status after 3 seconds
        setTimeout(() => {
            UIUtils.hideStatus();
        }, 3000);
    }

    isEasterEggScenario(files) {
        // Check if the uploaded files match the easter egg demo pattern
        if (files.length === 0) return false;
        
        const easterEggFilenames = ['ForMyOwnPart.m4a', 'AllianzArena.mp4', 'AI_at_Allianz.txt'];
        const uploadedFilenames = files.map(f => f.name);
        
        // Check if any of the easter egg files are present
        return easterEggFilenames.some(filename => 
            uploadedFilenames.includes(filename)
        );
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, creating ToolFlowBuilder...');
    window.toolFlowBuilder = new ToolFlowBuilder();
});

// Export for debugging purposes
export { ToolFlowBuilder };