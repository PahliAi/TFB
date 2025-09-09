// WorkflowCanvasManager.js - Simplified canvas and workflow operations
// Handles ONLY canvas-specific functionality, delegates all node operations to managers
// SURGICAL PRECISION: Same functionality as WorkflowCanvas, just cleaned up

class WorkflowCanvasManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.connections = [];
        this.selectedNode = null;
        this.isConnecting = false;
        this.connectionStart = null;
        
        // Global drag state for label expansion functionality
        this.isDraggingGlobalState = false;
        
        // Dependencies (will be injected)
        this.nodeDataManager = null;
        this.nodeUIManager = null;
        this.connectionManager = null;
        this.toolPalette = null;

        this.initialize();
    }

    // ============================================================================
    // DEPENDENCY INJECTION
    // ============================================================================
    
    setNodeDataManager(nodeDataManager) {
        this.nodeDataManager = nodeDataManager;
    }
    
    setNodeUIManager(nodeUIManager) {
        this.nodeUIManager = nodeUIManager;
    }
    
    setConnectionManager(connectionManager) {
        this.connectionManager = connectionManager;
    }
    
    setToolPalette(toolPalette) {
        this.toolPalette = toolPalette;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    initialize() {
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        // Canvas event listeners
        canvas.addEventListener('dragover', this.handleCanvasDragOver.bind(this));
        canvas.addEventListener('drop', this.handleCanvasDrop.bind(this));
        canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Global drag state tracking for label expansion
        document.addEventListener('dragstart', (e) => {
            // Check if this is a label being dragged
            if (e.target.classList.contains('file-label') || 
                e.target.dataset.label || 
                e.dataTransfer.types.includes('application/x-text-file-label')) {
                this.isDraggingGlobalState = true;
            }
        });
        
        document.addEventListener('dragend', () => {
            this.isDraggingGlobalState = false;
        });
    }

    setupEventListeners() {
        // Listen for workflow generation
        this.eventBus.on('workflow-generated', this.renderWorkflow.bind(this));
        
        // Listen for node creation requests from canvas drops
        this.eventBus.on('node:create:request', this.handleNodeCreateRequest.bind(this));
        this.eventBus.on('node:delete:request', this.handleNodeDeleteRequest.bind(this));
        this.eventBus.on('node:inputs:clear', this.handleNodeInputsClear.bind(this));
        
        // Listen for node addition to hide welcome message
        this.eventBus.on('node-added', this.handleNodeAdded.bind(this));
        
        // Listen for output connections from OutputRouter
        this.eventBus.on('create-output-connection', this.handleCreateOutputConnection.bind(this));
        
        // Listen for connection events
        this.eventBus.on('connection-created', this.handleConnectionCreated.bind(this));
        
        // Listen for canvas notifications
        this.eventBus.on('show-canvas-notification', this.handleShowCanvasNotification.bind(this));
    }

    // ============================================================================
    // CANVAS DRAG AND DROP
    // ============================================================================

    handleCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleCanvasDrop(e) {
        e.preventDefault();
        
        const droppedId = e.dataTransfer.getData('text/plain');
        const toolType = e.dataTransfer.getData('application/x-tool-type');
        const fileName = e.dataTransfer.getData('application/x-file-name');
        const fileType = e.dataTransfer.getData('application/x-file-type');
        const fileLabel = e.dataTransfer.getData('application/x-file-label');
        const selectedLabels = e.dataTransfer.getData('application/x-selected-labels');

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (selectedLabels) {
            // This is a label drag from a node - don't create new nodes
            console.log('Labels dropped on canvas - ignoring (should drop on nodes only)');
            return;
        } else if (toolType) {
            // Dropped a tool from the palette - create tool node
            this.createToolNode(toolType, { x, y });
        } else if (droppedId && fileName) {
            // Check if we have existing nodes that could accept this file
            const compatibleNodes = this.findCompatibleNodes(fileType);
            
            if (compatibleNodes.length > 0) {
                // Show a message suggesting to drop on existing nodes instead
                this.showDropSuggestion(compatibleNodes, fileLabel);
            } else {
                // Emit event for V4 architecture to handle
                this.eventBus.emit('file-dropped-on-canvas', {
                    fileLabel: fileLabel,
                    position: { x, y }
                });
            }
        }
    }

    createToolNode(toolType, position) {
        console.log(`🎯 WorkflowCanvasManager.createToolNode: ${toolType} at position`, position);
        
        // Center the node at the cursor position (nodes are typically 112px wide x 70px high)
        const centeredPosition = {
            x: position.x - 56, // Half of typical node width
            y: position.y - 35  // Half of typical node height
        };
        
        // Delegate to NodeDataManager for creation
        return this.nodeDataManager?.createNode(toolType, centeredPosition);
    }

    // ============================================================================
    // NODE COMPATIBILITY CHECKING
    // ============================================================================

    findCompatibleNodes(fileType) {
        // Delegate to NodeDataManager
        if (!this.nodeDataManager) return [];
        
        const allNodes = this.nodeDataManager.getAllNodes();
        const compatibleNodeTypes = this.getCompatibleNodeTypes(fileType);
        return allNodes.filter(node => compatibleNodeTypes.includes(node.type));
    }
    
    getCompatibleNodeTypes(fileType) {
        const typeMapping = {
            'application/pdf': ['pdf2text'],
            'audio/mpeg': ['audio2text'],
            'audio/wav': ['audio2text'],
            'audio/mp4': ['audio2text'],
            'video/mp4': ['audio2text', 'video2text'],
            'image/png': ['image2text'],
            'image/jpeg': ['image2text'],
            'image/jpg': ['image2text'],
            'text/plain': ['summarizer', 'translator', 'analyzer', 'join', 'text2pdf', 'text2docx']
        };
        
        return typeMapping[fileType] || [];
    }

    showDropSuggestion(compatibleNodes, fileLabel) {
        // Highlight compatible nodes briefly
        compatibleNodes.forEach(node => {
            const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
            if (nodeElement) {
                nodeElement.classList.add('bg-yellow-100', 'border-yellow-400');
                setTimeout(() => {
                    nodeElement.classList.remove('bg-yellow-100', 'border-yellow-400');
                }, 2000);
            }
        });

        // Show a brief message
        this.eventBus.emit('status-update', `File ${fileLabel} can be dropped on highlighted nodes, or create a new node here.`);
    }

    // ============================================================================
    // CONNECTION MANAGEMENT
    // ============================================================================

    startConnection(fromNode) {
        this.isConnecting = true;
        this.connectionStart = fromNode;
        
        // Visual feedback
        document.body.style.cursor = 'crosshair';
    }

    endConnection(toNode) {
        if (!this.isConnecting || !this.connectionStart || this.connectionStart.id === toNode.id) {
            this.cancelConnection();
            return;
        }

        // Create connection
        const connection = {
            id: `conn_${Date.now()}`,
            from: this.connectionStart.id,
            to: toNode.id,
            fileName: this.connectionStart.outputLabels[0] || 'output.txt'
        };

        this.connections.push(connection);
        
        // Update target node inputs through NodeDataManager
        this.eventBus.emit('node:label:add', { nodeId: toNode.id, label: connection.fileName });

        // Connection rendering handled by ConnectionManager
        this.eventBus.emit('connection-created', connection);
        this.cancelConnection();
    }

    cancelConnection() {
        this.isConnecting = false;
        this.connectionStart = null;
        document.body.style.cursor = 'default';
    }

    addConnection(connectionData) {
        this.connections.push(connectionData);
        // Connection rendering handled by ConnectionManager
        this.eventBus.emit('connection-created', connectionData);
    }
    
    // Method called by TextFilesManager to create the actual connection
    createConnection(sourceNodeId, targetNodeId, fileName) {
        // Find the source and target nodes
        const sourceNode = this.nodeDataManager?.getNodeById(sourceNodeId);
        const targetNode = this.nodeDataManager?.getNodeById(targetNodeId);
        
        if (!sourceNode || !targetNode) {
            console.log(`Source node ${sourceNodeId} or target node ${targetNodeId} not found`);
            return;
        }
        
        // Check if connection already exists
        const existingConnection = this.connections.find(c => 
            c.from === sourceNode.id && c.to === targetNode.id && c.fileName === fileName
        );
        
        if (existingConnection) {
            console.log(`Connection already exists between ${sourceNode.id} and ${targetNode.id} for ${fileName}`);
            return;
        }
        
        // Create the connection
        const connection = {
            id: `conn_${Date.now()}`,
            from: sourceNode.id,
            to: targetNode.id,
            fileName: fileName
        };
        
        this.connections.push(connection);
        // Connection rendering handled by ConnectionManager
        
        console.log(`✅ Created connection from ${sourceNode.id} to ${targetNode.id} via ${fileName}`);
        this.eventBus.emit('connection-created', connection);
        
        return connection;
    }

    // ============================================================================
    // WORKFLOW OPERATIONS
    // ============================================================================

    renderWorkflow(workflow) {
        this.clear();
        
        // Add nodes through NodeDataManager
        if (workflow.nodes) {
            workflow.nodes.forEach(nodeData => {
                this.nodeDataManager?.addNode(nodeData);
            });
        }

        // Add connections
        if (workflow.connections) {
            workflow.connections.forEach(connectionData => {
                this.connections.push(connectionData);
                // Connection rendering handled by ConnectionManager
            });
        }

        this.hideWelcomeMessage();
    }

    exportWorkflow() {
        const nodes = this.nodeDataManager?.getAllNodes() || [];
        const inputFiles = window.toolFlowBuilder?.uploadZone.getFiles() || [];
        const textFiles = window.toolFlowBuilder?.textFilesManager.getTextFileLabels() || [];
        const outputs = window.toolFlowBuilder?.outputZone.getOutputs() || [];
        
        // V4 JSON Format - matches design/workflow-json-format-v4.md
        return {
            format: "toolflowbuilder-v4",
            version: "4.0.0",
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            
            metadata: {
                name: "Exported Workflow",
                description: "User-created workflow exported from ToolFlowBuilder",
                author: "user",
                tags: ["export", "v4"],
                status: nodes.length > 0 ? "designed" : "empty"
            },
            
            systemPrompt: {
                objective: "Process uploaded files through the defined workflow actions",
                constraints: [
                    "Maintain file quality and formatting",
                    "Process files in dependency order",
                    "Generate requested output formats"
                ],
                outputRequirements: outputs.map(o => `Generate ${o.businessName || o.label}`)
            },
            
            inputFiles: inputFiles.map(file => ({
                id: file.label,
                label: file.label,
                originalName: file.name,
                type: file.type,
                size: file.size,
                category: file.category,
                uploadedAt: new Date().toISOString()
            })),
            
            textFiles: textFiles.map(textFile => ({
                id: textFile.label,
                label: textFile.label,
                sourceFile: textFile.label.replace('.txt', ''),
                generatedAt: new Date().toISOString(),
                status: "ready"
            })),
            
            actions: nodes.map(node => ({
                id: node.id,
                type: node.type,
                name: `${this.getToolName(node.type)} - ${node.id}`,
                inputs: node.inputLabels || [],
                outputs: node.outputLabels || [],
                parameters: {
                    userPrompt: node.userPrompt || "",
                    ...node.params
                },
                position: node.position,
                status: node.state === 'completed' ? 'completed' : 'ready'
            })),
            
            connections: this.connections.map(conn => ({
                id: conn.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                from: conn.from,
                to: conn.to,
                fromType: conn.fromType || "action",
                toType: conn.toType || "action",
                label: conn.fileName || conn.label
            })),
            
            outputFiles: outputs.map(output => ({
                id: `output_${output.id}`,
                filename: output.businessName || output.label,
                systemName: output.label,
                type: this.getOutputFileType(output.fileType),
                sourceAction: output.sourceNodeId || "direct",
                status: "pending"
            })),
            
            execution: {
                status: "not_started",
                progress: 0,
                currentAction: null,
                errors: [],
                warnings: []
            },
            
            statistics: {
                totalInputFiles: inputFiles.length,
                totalTextFiles: textFiles.length,
                totalActions: nodes.length,
                totalConnections: this.connections.length,
                totalOutputFiles: outputs.length
            }
        };
    }
    
    getToolName(toolType) {
        // Get display name for tool types
        const toolNames = {
            'pdf2text': 'PDF to Text',
            'audio2text': 'Audio to Text',
            'image2text': 'Image to Text',
            'video2text': 'Video to Text',
            'webscraper': 'Web Scraper',
            'summarizer': 'Summarize',
            'translator': 'Translate',
            'analyzer': 'Analyze',
            'join': 'Join',
            'text2pdf': 'Text to PDF',
            'text2docx': 'Text to Word'
        };
        return toolNames[toolType] || toolType;
    }
    
    getOutputFileType(fileType) {
        // Map output file types to MIME types
        const typeMap = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'html': 'text/html',
            'json': 'application/json'
        };
        return typeMap[fileType] || 'application/octet-stream';
    }

    // ============================================================================
    // CANVAS STATE MANAGEMENT
    // ============================================================================

    handleCanvasClick(e) {
        if (e.target.id === 'canvas') {
            this.selectedNode = null;
            // Remove selection visual feedback if any
        }
    }

    clear() {
        const canvas = document.getElementById('canvas');
        
        if (canvas) {
            // Remove all node elements
            const nodes = canvas.querySelectorAll('.node');
            nodes.forEach(node => node.remove());
        }
        
        // Clear internal state (ConnectionManager handles SVG cleanup)
        this.nodeDataManager?.clearAllNodes();
        this.connections = [];
        this.selectedNode = null;
        
        // Always show welcome message after clearing
        this.showWelcomeMessage();
    }

    hideWelcomeMessage() {
        const welcomeMsg = document.getElementById('canvasWelcome');
        if (welcomeMsg) {
            welcomeMsg.style.display = 'none';
        }
    }

    showWelcomeMessage() {
        const welcomeMsg = document.getElementById('canvasWelcome');
        if (welcomeMsg) {
            // Only show welcome message if no nodes exist
            const hasNodes = this.nodeDataManager?.getAllNodes().length > 0;
            if (!hasNodes) {
                welcomeMsg.style.display = 'flex';
            }
        }
    }

    // ============================================================================
    // CANVAS NOTIFICATION SYSTEM
    // ============================================================================
    
    showCanvasNotification(type, message, duration = 5000) {
        const notification = document.getElementById('canvasNotification');
        const icon = notification.querySelector('.notification-icon');
        const text = notification.querySelector('.notification-text');
        
        if (!notification || !icon || !text) return;
        
        // Set icon based on type
        const icons = {
            error: '❌',
            warning: '⚠️', 
            info: 'ℹ️',
            success: '✅'
        };
        
        // Update notification content
        icon.textContent = icons[type] || 'ℹ️';
        text.textContent = message;
        
        // Reset classes and add new type
        notification.className = `canvas-notification ${type}`;
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideCanvasNotification();
            }, duration);
        }
    }
    
    hideCanvasNotification() {
        const notification = document.getElementById('canvasNotification');
        if (notification) {
            notification.classList.add('hidden');
        }
    }

    // ============================================================================
    // ACCESS METHODS (Public API)
    // ============================================================================

    getNodes() {
        return this.nodeDataManager?.getAllNodes() || [];
    }

    getConnections() {
        return this.connections;
    }

    getNodeById(nodeId) {
        return this.nodeDataManager?.getNodeById(nodeId);
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    handleNodeCreateRequest({ toolType, position, userPrompt }) {
        const nodeData = this.nodeDataManager?.createNode(toolType, position);
        if (nodeData && userPrompt) {
            this.nodeDataManager?.updateNodePrompt(nodeData.id, userPrompt);
        }
    }
    
    handleNodeDeleteRequest({ nodeId }) {
        // Remove connections from WorkflowCanvas tracking (ConnectionManager handles cleanup)
        this.connections = this.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
        
        // Delegate node deletion to NodeDataManager
        this.nodeDataManager?.deleteNode(nodeId, false);
    }
    
    handleNodeInputsClear({ nodeId }) {
        this.nodeDataManager?.clearNodeInputs(nodeId);
    }

    handleCreateOutputConnection(connection) {
        // Add the output connection to our connections array and render it
        this.addConnection({
            id: connection.id,
            from: connection.from,
            to: connection.to,
            fileName: connection.label,
            outputId: connection.outputId
        });
    }
    
    handleConnectionCreated(connectionData) {
        // Legacy event - ensure connection is tracked
        if (connectionData.from && connectionData.to && connectionData.fileName) {
            const existingConnection = this.connections.find(c => 
                c.from === connectionData.from && 
                c.to === connectionData.to && 
                c.fileName === connectionData.fileName
            );
            
            if (!existingConnection) {
                this.connections.push(connectionData);
            }
        }
    }
    
    handleShowCanvasNotification({ type, message }) {
        // Handle canvas notification requests
        this.showCanvasNotification(type, message);
    }
    
    handleNodeAdded(nodeData) {
        // Hide welcome message when first node is added
        this.hideWelcomeMessage();
    }
}

export { WorkflowCanvasManager };