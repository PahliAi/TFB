// OutputRouter - V4 Smart Output Routing System
// Routes tool outputs: .txt files → TextFilesManager, others → Output Zone

class OutputRouter {
    constructor(eventBus, textFilesManager) {
        this.eventBus = eventBus;
        this.textFilesManager = textFilesManager;
        this.outputConnections = []; // Track connections to output zone
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for node processing completion
        this.eventBus.on('node-processing-complete', this.handleNodeProcessingComplete.bind(this));
        
        // Listen for manual promotion requests
        this.eventBus.on('promote-text-to-output', this.handlePromoteTextToOutput.bind(this));
    }
    
    handleNodeProcessingComplete(processData) {
        const { nodeId, inputLabels, outputLabels } = processData;
        
        if (!outputLabels || outputLabels.length === 0) return;
        
        // Route each output based on file type
        outputLabels.forEach(outputLabel => {
            this.routeOutput(nodeId, outputLabel, inputLabels);
        });
    }
    
    routeOutput(sourceNodeId, outputLabel, sourceInputLabels) {
        const fileName = outputLabel.fileName || outputLabel;
        
        if (this.isTextFile(fileName)) {
            // .txt files → TextFilesManager (textFiles Box)
            this.routeToTextFiles(sourceNodeId, outputLabel, sourceInputLabels);
        } else {
            // Non-.txt files → Output Zone (Final deliverables)
            this.routeToOutputZone(sourceNodeId, outputLabel, sourceInputLabels);
        }
    }
    
    routeToTextFiles(sourceNodeId, outputLabel, sourceInputLabels) {
        // Add to TextFilesManager without visual connections
        const textFileLabel = {
            id: outputLabel.fileName || outputLabel,
            label: outputLabel.fileName || outputLabel,
            originalLabel: sourceInputLabels ? sourceInputLabels.join('') : 'processed',
            sourceType: 'node-output',
            sourceNodeId: sourceNodeId,
            sourceInputLabels: sourceInputLabels || []
        };
        
        // Add to text files manager
        this.textFilesManager.addTextFileLabel(textFileLabel);
        
        console.log(`Routed ${textFileLabel.label} to TextFiles (textFiles Box)`);
        
        // Emit event for tracking
        this.eventBus.emit('text-output-routed', {
            label: textFileLabel.label,
            sourceNodeId: sourceNodeId,
            destination: 'text-files'
        });
    }
    
    routeToOutputZone(sourceNodeId, outputLabel, sourceInputLabels) {
        // Add to Output Zone with visual connection
        const outputItem = {
            id: outputLabel.fileName || outputLabel,
            label: outputLabel.fileName || outputLabel,
            systemName: outputLabel.fileName || outputLabel,
            businessName: this.generateBusinessName(outputLabel, sourceInputLabels),
            fileType: this.getFileType(outputLabel.fileName || outputLabel),
            sourceNodeId: sourceNodeId,
            sourceInputLabels: sourceInputLabels || [],
            isManuallyPromoted: false,
            createdAt: Date.now()
        };
        
        // Add to output zone
        this.addToOutputZone(outputItem);
        
        // Create visual connection from node to output zone
        this.createOutputConnection(sourceNodeId, outputItem);
        
        console.log(`Routed ${outputItem.label} to Output Zone`);
        
        // Emit event for tracking
        this.eventBus.emit('output-routed', {
            item: outputItem,
            sourceNodeId: sourceNodeId,
            destination: 'output-zone'
        });
    }
    
    handlePromoteTextToOutput(promotionData) {
        // V4 Feature: Manually promote .txt files to final output
        const { label, userFriendlyName } = promotionData;
        
        const textFileLabel = this.textFilesManager.getTextFileLabelByLabel(label);
        if (!textFileLabel) return;
        
        const outputItem = {
            id: label,
            label: label,
            systemName: label,
            businessName: userFriendlyName || this.generateBusinessName(label, []),
            fileType: 'text/plain',
            sourceNodeId: textFileLabel.sourceNodeId,
            sourceInputLabels: textFileLabel.sourceInputLabels || [],
            isManuallyPromoted: true,
            createdAt: Date.now()
        };
        
        this.addToOutputZone(outputItem);
        this.createOutputConnection(textFileLabel.sourceNodeId, outputItem);
        
        console.log(`Manually promoted ${label} to Output Zone`);
        
        this.eventBus.emit('text-promoted-to-output', outputItem);
    }
    
    isTextFile(fileName) {
        return fileName && fileName.endsWith('.txt');
    }
    
    getFileType(fileName) {
        if (!fileName) return 'unknown';
        
        const extension = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'txt': 'text/plain',
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv'
        };
        
        return typeMap[extension] || 'application/octet-stream';
    }
    
    generateBusinessName(outputLabel, sourceInputLabels) {
        // Generate user-friendly names for outputs
        const fileName = outputLabel.fileName || outputLabel;
        const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        
        if (sourceInputLabels && sourceInputLabels.length > 0) {
            return `${baseName} (from ${sourceInputLabels.join(', ')})`;
        }
        
        return baseName;
    }
    
    addToOutputZone(outputItem) {
        // Add item to the output zone UI
        const outputContainer = document.getElementById('outputList');
        if (!outputContainer) return;
        
        // Remove placeholder if it exists
        const placeholder = outputContainer.querySelector('.output-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        const outputElement = this.createOutputElement(outputItem);
        outputContainer.appendChild(outputElement);
    }
    
    createOutputElement(outputItem) {
        const outputCard = document.createElement('div');
        outputCard.className = 'output-file-card';
        outputCard.dataset.outputId = outputItem.id;
        
        const fileIcon = this.getFileIcon(outputItem.fileType);
        const promotionBadge = outputItem.isManuallyPromoted ? 
            '<span class="promotion-badge">📌</span>' : '';
        
        outputCard.innerHTML = `
            <div class="output-header">
                <div class="file-icon">${fileIcon}</div>
                <div class="output-name" title="${outputItem.systemName}">
                    ${outputItem.businessName}
                </div>
                ${promotionBadge}
            </div>
            <div class="output-meta">
                <div class="source-info">From: ${outputItem.sourceInputLabels.join(', ') || 'processed'}</div>
                <div class="output-actions">
                    <button class="download-btn" data-output-id="${outputItem.id}">Download</button>
                    <button class="rename-btn" data-output-id="${outputItem.id}">Rename</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        this.setupOutputElementEvents(outputCard, outputItem);
        
        return outputCard;
    }
    
    setupOutputElementEvents(element, outputItem) {
        const downloadBtn = element.querySelector('.download-btn');
        const renameBtn = element.querySelector('.rename-btn');
        
        downloadBtn?.addEventListener('click', () => {
            this.handleDownloadOutput(outputItem);
        });
        
        renameBtn?.addEventListener('click', () => {
            this.handleRenameOutput(outputItem);
        });
    }
    
    handleDownloadOutput(outputItem) {
        console.log(`Downloading: ${outputItem.systemName}`);
        this.eventBus.emit('download-output', outputItem);
    }
    
    handleRenameOutput(outputItem) {
        const newName = prompt('Enter new name:', outputItem.businessName);
        if (newName && newName.trim()) {
            outputItem.businessName = newName.trim();
            
            // Update UI
            const element = document.querySelector(`[data-output-id="${outputItem.id}"]`);
            const nameElement = element?.querySelector('.output-name');
            if (nameElement) {
                nameElement.textContent = outputItem.businessName;
            }
            
            this.eventBus.emit('output-renamed', outputItem);
        }
    }
    
    createOutputConnection(sourceNodeId, outputItem) {
        // Create visual connection from source node to output zone
        const connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            from: sourceNodeId,
            to: 'output-zone',
            outputId: outputItem.id,
            label: outputItem.label
        };
        
        this.outputConnections.push(connection);
        
        // Emit event for visual connection rendering
        this.eventBus.emit('create-output-connection', connection);
    }
    
    getFileIcon(fileType) {
        if (fileType.startsWith('application/pdf')) return '📕';
        if (fileType.includes('word') || fileType.includes('document')) return '📄';
        if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊';
        if (fileType.startsWith('text/')) return '📝';
        if (fileType.includes('csv')) return '📈';
        return '📎';
    }
    
    // Public API methods
    getOutputConnections() {
        return this.outputConnections;
    }
    
    clearOutputZone() {
        const outputContainer = document.getElementById('outputList');
        if (outputContainer) {
            outputContainer.innerHTML = `
                <div class="output-placeholder">
                    <div class="placeholder-icon">📋</div>
                    <p class="placeholder-text">Output files will appear here</p>
                    <p class="placeholder-subtext">Click to rename</p>
                </div>
            `;
        }
        this.outputConnections = [];
    }
}

export { OutputRouter };