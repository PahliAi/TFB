// ConnectionManager - Unified connection management system
// Handles ALL connection types: Input Files → Nodes, Nodes → Nodes, Nodes → Output Files, Text Files → Nodes

class ConnectionManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.connections = [];
        this.connectionsVisible = true;
        this.canvas = null;
        this.svg = null;
        
        this.initialize();
    }
    
    initialize() {
        this.setupCanvas();
        this.setupEventListeners();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        this.svg = document.getElementById('connectionSvg');
        
        if (!this.svg && this.canvas) {
            // Create SVG element for connections if it doesn't exist
            this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.svg.id = 'connectionSvg';
            this.svg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            `;
            
            // Add arrow marker for connection endings
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.id = 'arrowhead';
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0,0 10,3.5 0,7');
            polygon.setAttribute('fill', '#6366f1');
            
            marker.appendChild(polygon);
            defs.appendChild(marker);
            this.svg.appendChild(defs);
            this.canvas.appendChild(this.svg);
        }
    }
    
    setupEventListeners() {
        // Listen for all connection creation events
        this.eventBus.on('create-connection-from-label', this.handleCreateConnectionFromLabel.bind(this));
        this.eventBus.on('create-output-connection', this.handleCreateOutputConnection.bind(this));
        this.eventBus.on('connection-created', this.handleConnectionCreated.bind(this));
        
        // Listen for node/element position changes to redraw connections
        this.eventBus.on('node-moved', this.redrawAllConnections.bind(this));
        this.eventBus.on('node-deleted', this.handleNodeDeleted.bind(this));
        this.eventBus.on('label-moved', this.redrawAllConnections.bind(this));
        
        // Toggle connection visibility
        this.eventBus.on('toggle-connections', this.toggleConnectionsVisibility.bind(this));
        
        // Setup mutation observer for automatic redrawing when DOM changes
        this.setupDOMObserver();
        
        // Setup periodic redraw to catch any missed movements
        this.startPeriodicRedraw();
    }
    
    // UNIFIED CONNECTION CREATION METHODS
    
    /**
     * Create connection between any two entities
     * @param {string} fromType - 'input-file', 'text-file', 'node'
     * @param {string} fromId - ID of source entity
     * @param {string} toType - 'node', 'output-zone'
     * @param {string} toId - ID of target entity
     * @param {string} fileName - File/label name being passed
     * @param {object} metadata - Additional connection metadata
     */
    createConnection(fromType, fromId, toType, toId, fileName, metadata = {}) {
        // Check if connection already exists
        const existingConnection = this.connections.find(c => 
            c.from.type === fromType && c.from.id === fromId &&
            c.to.type === toType && c.to.id === toId &&
            c.fileName === fileName
        );
        
        if (existingConnection) {
            console.log('Connection already exists:', existingConnection.id);
            return existingConnection;
        }
        
        const connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            from: { type: fromType, id: fromId },
            to: { type: toType, id: toId },
            fileName: fileName,
            metadata: metadata,
            createdAt: Date.now()
        };
        
        this.connections.push(connection);
        this.renderConnection(connection);
        
        console.log('Created connection:', connection.id, `${fromType}:${fromId} → ${toType}:${toId} (${fileName})`);
        
        this.eventBus.emit('connection-established', connection);
        return connection;
    }
    
    // EVENT HANDLERS FOR LEGACY COMPATIBILITY
    
    handleCreateConnectionFromLabel(data) {
        const { label, targetNodeId, sourceData } = data;
        
        // If sourceData is provided (from TextFilesManager), use it directly
        if (sourceData) {
            if (sourceData.sourceNodeId && sourceData.sourceType === 'node-output') {
                // This is a text file from a node output - create node-to-node connection
                this.createConnection('node', sourceData.sourceNodeId, 'node', targetNodeId, label, {
                    sourceType: 'text-file',
                    intermediate: true
                });
            } else {
                // This is an uploaded text file - create text-file-to-node connection
                this.createConnection('text-file', label, 'node', targetNodeId, label, {
                    sourceType: 'uploaded-file',
                    originalLabel: sourceData.originalLabel
                });
            }
            return;
        }
        
        // Legacy fallback - Find the source of this label (could be text-file or input-file)
        const textFileLabel = this.findTextFileLabelByName(label);
        
        if (textFileLabel && textFileLabel.sourceNodeId) {
            // This is a text file from a node output
            this.createConnection('node', textFileLabel.sourceNodeId, 'node', targetNodeId, label, {
                sourceType: 'text-file',
                intermediate: true
            });
        } else {
            // This might be from input files - emit event to check
            this.eventBus.emit('find-input-file-source', { label, targetNodeId });
        }
    }
    
    handleCreateOutputConnection(connectionData) {
        this.createConnection(
            'node', 
            connectionData.from, 
            'output-zone', 
            connectionData.to, 
            connectionData.label,
            { outputId: connectionData.outputId }
        );
    }
    
    handleConnectionCreated(connectionData) {
        // Legacy event - convert to new format
        if (connectionData.from && connectionData.to && connectionData.fileName) {
            this.createConnection('node', connectionData.from, 'node', connectionData.to, connectionData.fileName);
        }
    }
    
    handleNodeDeleted(nodeId) {
        // Remove all connections involving this node
        const connectionsToRemove = this.connections.filter(c => 
            (c.from.type === 'node' && c.from.id === nodeId) ||
            (c.to.type === 'node' && c.to.id === nodeId)
        );
        
        connectionsToRemove.forEach(conn => this.removeConnection(conn.id));
    }
    
    // CONNECTION RENDERING
    
    renderConnection(connection) {
        if (!this.svg || !this.connectionsVisible) return;
        
        const positions = this.getConnectionPositions(connection);
        if (!positions) return;
        
        this.drawConnectionPath(connection, positions.from, positions.to);
    }
    
    getConnectionPositions(connection) {
        const fromPos = this.getEntityPosition(connection.from.type, connection.from.id);
        const toPos = this.getEntityPosition(connection.to.type, connection.to.id);
        
        if (!fromPos || !toPos) return null;
        
        return { from: fromPos, to: toPos };
    }
    
    getEntityPosition(entityType, entityId) {
        switch (entityType) {
            case 'node':
                return this.getNodePosition(entityId);
            case 'input-file':
                return this.getInputFilePosition(entityId);
            case 'text-file':
                return this.getTextFilePosition(entityId);
            case 'output-zone':
                return this.getOutputZonePosition();
            default:
                console.warn('Unknown entity type for position:', entityType);
                return null;
        }
    }
    
    getNodePosition(nodeId) {
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeElement) return null;
        
        const rect = nodeElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        return {
            x: rect.left - canvasRect.left,  // Left edge of node
            y: rect.top - canvasRect.top + rect.height / 2,  // Vertical center
            width: rect.width,
            height: rect.height
        };
    }
    
    getInputFilePosition(fileId) {
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (!fileElement) return null;
        
        const rect = fileElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        return {
            x: rect.right - canvasRect.left,
            y: rect.top - canvasRect.top + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }
    
    getTextFilePosition(fileName) {
        const textFileElement = document.querySelector(`[data-label="${fileName}"]`);
        if (!textFileElement) {
            return null;
        }
        
        const rect = textFileElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        return {
            x: rect.right - canvasRect.left,
            y: rect.top - canvasRect.top + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }
    
    getOutputZonePosition() {
        const outputZone = document.getElementById('outputZone') || document.getElementById('outputList');
        if (!outputZone) return null;
        
        const rect = outputZone.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        return {
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    }
    
    drawConnectionPath(connection, fromPos, toPos) {
        // Calculate connection points based on entity type
        let startX;
        
        if (connection.from.type === 'text-file' || connection.from.type === 'input-file') {
            // For files, fromPos.x is already the right edge
            startX = fromPos.x;
        } else {
            // For nodes, connect from right edge
            startX = fromPos.x + fromPos.width;
        }
        
        const startY = fromPos.y;
        const endX = toPos.x;      // Left edge of target node
        const endY = toPos.y;
        
        // Create curved path with moderate control points
        const midX = (startX + endX) / 2;
        const distance = Math.abs(endX - startX);
        const controlOffset = Math.min(30, distance * 0.3); // Adaptive curve based on distance
        const controlX1 = startX + controlOffset;
        const controlX2 = endX - controlOffset;
        
        const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;
        
        // Create path element
        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.id = `path-${connection.id}`;
        pathElement.setAttributeNS(null, 'd', pathData);
        pathElement.setAttributeNS(null, 'stroke', '#6366f1');
        pathElement.setAttributeNS(null, 'stroke-width', '2');
        pathElement.setAttributeNS(null, 'fill', 'none');
        pathElement.setAttributeNS(null, 'marker-end', 'url(#arrowhead)');
        pathElement.setAttributeNS(null, 'opacity', this.connectionsVisible ? '1' : '0');
        
        // Add hover effects
        pathElement.addEventListener('mouseenter', () => {
            pathElement.setAttributeNS(null, 'stroke', '#4f46e5');
            pathElement.setAttributeNS(null, 'stroke-width', '3');
        });
        
        pathElement.addEventListener('mouseleave', () => {
            pathElement.setAttributeNS(null, 'stroke', '#6366f1');
            pathElement.setAttributeNS(null, 'stroke-width', '2');
        });
        
        this.svg.appendChild(pathElement);
        
        // Don't show labels to keep connections clean
    }
    
    
    addConnectionLabel(connection, x, y, labelText = null) {
        const displayText = labelText || connection.fileName;
        
        // Background rectangle for label
        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const textWidth = displayText.length * 6 + 10;
        labelBg.id = `label-bg-${connection.id}`;
        labelBg.setAttributeNS(null, 'x', x - textWidth/2);
        labelBg.setAttributeNS(null, 'y', y - 8);
        labelBg.setAttributeNS(null, 'width', textWidth);
        labelBg.setAttributeNS(null, 'height', 16);
        labelBg.setAttributeNS(null, 'rx', 3);
        labelBg.setAttributeNS(null, 'fill', 'white');
        labelBg.setAttributeNS(null, 'stroke', '#e5e7eb');
        labelBg.setAttributeNS(null, 'stroke-width', '1');
        labelBg.setAttributeNS(null, 'opacity', this.connectionsVisible ? '1' : '0');
        
        // Text label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.id = `label-${connection.id}`;
        label.setAttributeNS(null, 'x', x);
        label.setAttributeNS(null, 'y', y + 3);
        label.setAttributeNS(null, 'text-anchor', 'middle');
        label.setAttributeNS(null, 'font-size', '10');
        label.setAttributeNS(null, 'font-family', 'Arial, sans-serif');
        label.setAttributeNS(null, 'fill', '#374151');
        label.setAttributeNS(null, 'opacity', this.connectionsVisible ? '1' : '0');
        label.textContent = displayText;
        
        this.svg.appendChild(labelBg);
        this.svg.appendChild(label);
    }
    
    // CONNECTION MANAGEMENT
    
    removeConnection(connectionId) {
        this.connections = this.connections.filter(c => c.id !== connectionId);
        
        // Remove visual elements
        const pathElement = document.getElementById(`path-${connectionId}`);
        const labelElement = document.getElementById(`label-${connectionId}`);
        const labelBgElement = document.getElementById(`label-bg-${connectionId}`);
        
        if (pathElement) pathElement.remove();
        if (labelElement) labelElement.remove();
        if (labelBgElement) labelBgElement.remove();
        
        this.eventBus.emit('connection-removed', connectionId);
    }
    
    redrawAllConnections() {
        // Clear all visual connections
        if (this.svg) {
            const paths = this.svg.querySelectorAll('path:not([id="arrowhead"] *)');
            const labels = this.svg.querySelectorAll('text');
            const labelBgs = this.svg.querySelectorAll('rect');
            
            paths.forEach(p => p.remove());
            labels.forEach(l => l.remove());
            labelBgs.forEach(bg => bg.remove());
        }
        
        // Redraw all connections
        this.connections.forEach(connection => {
            this.renderConnection(connection);
        });
    }
    
    toggleConnectionsVisibility() {
        this.connectionsVisible = !this.connectionsVisible;
        
        if (this.svg) {
            this.svg.style.opacity = this.connectionsVisible ? '1' : '0';
        }
        
        this.eventBus.emit('connections-visibility-changed', this.connectionsVisible);
    }
    
    // DOM OBSERVATION FOR AUTOMATIC REDRAWING
    
    setupDOMObserver() {
        if (!this.canvas) return;
        
        // Observe changes to node positions and label positions
        this.observer = new MutationObserver((mutations) => {
            let shouldRedraw = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'style' || 
                     mutation.attributeName === 'data-x' || 
                     mutation.attributeName === 'data-y')) {
                    shouldRedraw = true;
                } else if (mutation.type === 'childList') {
                    // Check if nodes or labels were added/removed
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    if (addedNodes.some(n => n.nodeType === 1 && (n.matches('[data-node-id]') || n.matches('.file-label') || n.matches('.text-file-label'))) ||
                        removedNodes.some(n => n.nodeType === 1 && (n.matches('[data-node-id]') || n.matches('.file-label') || n.matches('.text-file-label')))) {
                        shouldRedraw = true;
                    }
                }
            });
            
            if (shouldRedraw) {
                // Debounce redraw to avoid excessive calls
                clearTimeout(this.redrawTimeout);
                this.redrawTimeout = setTimeout(() => {
                    this.redrawAllConnections();
                }, 50);
            }
        });
        
        // Observe the entire canvas area for changes
        this.observer.observe(this.canvas, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'data-x', 'data-y', 'data-node-id']
        });
    }
    
    startPeriodicRedraw() {
        // Redraw connections every 2 seconds to catch any missed changes
        this.periodicRedrawInterval = setInterval(() => {
            if (this.connections.length > 0) {
                this.redrawAllConnections();
            }
        }, 2000);
    }
    
    stopPeriodicRedraw() {
        if (this.periodicRedrawInterval) {
            clearInterval(this.periodicRedrawInterval);
            this.periodicRedrawInterval = null;
        }
    }
    
    destroy() {
        // Clean up observers and intervals
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.stopPeriodicRedraw();
        
        if (this.redrawTimeout) {
            clearTimeout(this.redrawTimeout);
        }
    }
    
    // UTILITY METHODS
    
    findTextFileLabelByName(labelName) {
        // Query the TextFilesManager for label data
        const textFileLabels = document.querySelectorAll('.text-file-label');
        for (const labelElement of textFileLabels) {
            if (labelElement.textContent.includes(labelName)) {
                return {
                    sourceNodeId: labelElement.dataset.sourceNodeId,
                    label: labelName
                };
            }
        }
        return null;
    }
    
    getConnectionsForNode(nodeId) {
        return this.connections.filter(c => 
            (c.from.type === 'node' && c.from.id === nodeId) ||
            (c.to.type === 'node' && c.to.id === nodeId)
        );
    }
    
    getAllConnections() {
        return [...this.connections];
    }
    
    clearAllConnections() {
        this.connections.forEach(c => this.removeConnection(c.id));
        this.connections = [];
    }
}

export { ConnectionManager };