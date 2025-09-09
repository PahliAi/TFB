// TextFiles Manager - V4 textFiles Box System  
// Handles .txt file labels for drag-and-drop workflow creation

class TextFilesManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.textFileLabels = []; // A.txt, B.txt, etc. for dragging
        this.selectedLabels = new Set(); // Track multi-selected labels
        this.toolStyleManager = null; // Will be set by main app
        
        this.initialize();
    }
    
    setToolStyleManager(toolStyleManager) {
        this.toolStyleManager = toolStyleManager;
    }
    
    initialize() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for input file labels creation
        this.eventBus.on('input-file-labels-created', this.handleInputFileLabelsCreated.bind(this));
        
        // Listen for node outputs that create new .txt files
        this.eventBus.on('node-output-created', this.handleNodeOutputCreated.bind(this));
        
        // Listen for removing node outputs
        this.eventBus.on('remove-text-file-label', this.handleRemoveTextFileLabel.bind(this));
        
        // Listen for filtering events
        this.eventBus.on('filter-by-input-file', this.handleFilterByInputFile.bind(this));
        
        // Listen for clear filter events
        this.eventBus.on('clear-input-file-filter', this.clearFilter.bind(this));
        
        // Note: Connection creation is handled by ConnectionManager, not here
    }
    
    handleInputFileLabelsCreated(inputFileLabels) {
        // V4 Feature: Immediately create .txt labels for ALL files
        // Even existing .txt files get re-processed for encoding consistency
        
        this.clearTextFileLabels();
        
        inputFileLabels.forEach(inputFileLabel => {
            const textFileLabel = {
                id: `${inputFileLabel.label}.txt`,
                label: `${inputFileLabel.label}.txt`,
                originalLabel: inputFileLabel.label,
                sourceType: 'auto-generated', // vs 'node-output'
                sourceNodeId: 'upload',
                createdAt: Date.now(),
                isVisible: true // For filtering system
            };
            
            this.textFileLabels.push(textFileLabel);
        });
        
        // Render text file labels in textFiles box
        this.renderTextFileLabels();
        
        // Emit event
        this.eventBus.emit('text-file-labels-created', this.textFileLabels);
    }
    
    handleNodeOutputCreated(outputData) {
        const { fileName, nodeId, nodeType, sourceLabels } = outputData;
        
        // Route by file extension: .txt files go to Text Files panel, others go to Output Files panel
        if (!fileName.endsWith('.txt')) {
            console.log(`🎯 Routing non-.txt file ${fileName} to Output Zone`);
            
            // Create simple output entry 
            const output = {
                nodeId: nodeId,
                nodeType: nodeType,
                systemName: fileName,
                content: `Content of ${fileName}`,
                type: this.getFileTypeFromExtension(fileName),
                success: true,
                businessName: fileName,
                isManualDrop: false
            };
            
            // Emit output-added event for Output Zone to catch
            this.eventBus.emit('output-added', output);
            
            // Create visual connection from node to output zone
            this.eventBus.emit('create-output-connection', {
                from: nodeId,
                to: 'output-zone',
                label: fileName,
                outputId: fileName
            });
            return;
        }
        
        // When nodes process and create .txt outputs, add them to textFiles box
        if (fileName.endsWith('.txt')) {
            const textFileLabel = {
                id: fileName,
                label: fileName,
                originalLabel: sourceLabels ? sourceLabels.join('') : 'processed',
                sourceType: 'node-output',
                sourceNodeId: nodeId,
                sourceNodeType: nodeType, // Node type for proper styling
                createdAt: Date.now(),
                isVisible: true
            };
            
            // Avoid duplicates
            if (!this.textFileLabels.find(item => item.id === textFileLabel.id)) {
                this.textFileLabels.push(textFileLabel);
                this.renderTextFileLabels();
            }
        }
    }
    
    handleRemoveTextFileLabel(removeData) {
        // Remove text file label from the panel
        const { fileName, sourceNodeId } = removeData;
        
        // Find and remove the label
        this.textFileLabels = this.textFileLabels.filter(label => {
            // Remove if fileName matches and sourceNodeId matches (for preview labels)
            return !(label.label === fileName && label.sourceNodeId === sourceNodeId);
        });
        
        // Re-render the updated list
        this.renderTextFileLabels();
        
        console.log(`Removed text file label: ${fileName} from node ${sourceNodeId}`);
    }
    
    handleFilterByInputFile(filterData) {
        // V4 Feature: Show only .txt files related to the selected input file
        const { label } = filterData;
        
        this.textFileLabels.forEach(textFileLabel => {
            // Show files that originated from this input file
            const isRelated = textFileLabel.originalLabel === label || 
                             textFileLabel.label.startsWith(label) ||
                             textFileLabel.label.includes(label);
            
            textFileLabel.isVisible = isRelated;
        });
        
        this.renderTextFileLabels();
    }
    
    renderTextFileLabels() {
        const container = document.getElementById('textFilesLabelList');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Only render visible labels (for filtering system)
        const visibleLabels = this.textFileLabels.filter(item => item.isVisible);
        
        visibleLabels.forEach(textFileLabel => {
            const labelElement = this.createTextFileLabelElement(textFileLabel);
            container.appendChild(labelElement);
        });
    }
    
    createTextFileLabelElement(textFileLabel) {
        if (!this.toolStyleManager) {
            // Fallback if ToolStyleManager not available
            return this.createFallbackLabelElement(textFileLabel);
        }

        // Use ToolStyleManager to create consistently styled element
        const toolType = textFileLabel.sourceNodeType || 'upload';
        const sourceType = textFileLabel.sourceType;
        
        const labelCard = this.toolStyleManager.createToolElement(toolType, sourceType, {
            text: textFileLabel.label,
            className: 'text-file-label-card',
            draggable: true,
            compact: true,
            variant: 'default'
        });
        
        labelCard.dataset.label = textFileLabel.label;
        
        // Add hover tooltip for long labels
        labelCard.title = textFileLabel.label;
        
        // Add drag event listeners
        labelCard.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, textFileLabel);
        });
        
        labelCard.addEventListener('dragend', (e) => {
            this.handleDragEnd(e, textFileLabel);
        });
        
        labelCard.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            this.handleClick(e, textFileLabel);
        });

        // Add delete button
        const deleteBtn = this.createDeleteButton(textFileLabel);
        labelCard.style.position = 'relative'; // Required for absolute positioning of delete button
        labelCard.appendChild(deleteBtn);
        
        // Set up hover behavior for delete button after elements are connected
        labelCard.addEventListener('mouseenter', () => {
            deleteBtn.style.display = 'flex';
        });
        
        labelCard.addEventListener('mouseleave', () => {
            deleteBtn.style.display = 'none';
        });

        // Override hover behavior for proper selection handling
        const originalMouseEnter = labelCard.onmouseenter;
        const originalMouseLeave = labelCard.onmouseleave;
        
        labelCard.addEventListener('mouseenter', (e) => {
            // Only apply hover if not selected
            if (!this.selectedLabels.has(textFileLabel.label)) {
                // Let ToolStyleManager handle hover for unselected items
                return;
            }
        });
        
        labelCard.addEventListener('mouseleave', (e) => {
            // Maintain selection styling if selected
            if (this.selectedLabels.has(textFileLabel.label)) {
                labelCard.style.backgroundColor = '#fde68a';
                labelCard.style.borderColor = '#d97706';
            }
        });
        
        return labelCard;
    }

    createFallbackLabelElement(textFileLabel) {
        // Fallback styling when ToolStyleManager is not available
        const labelCard = document.createElement('div');
        labelCard.className = 'text-file-label-card';
        labelCard.dataset.label = textFileLabel.label;
        labelCard.draggable = true;
        labelCard.title = textFileLabel.label; // Hover tooltip
        
        labelCard.innerHTML = `
            <div class="label-display">
                <div class="label-text">${textFileLabel.label}</div>
                <div class="source-indicator">${textFileLabel.sourceType === 'auto-generated' ? '📁' : '⚙️'}</div>
            </div>
        `;
        
        return labelCard;
    }
    
    handleDragStart(e, textFileLabel) {
        // V4: Check if we're dragging multiple selected labels
        let labelsToDrag = [];
        
        if (this.selectedLabels.has(textFileLabel.label) && this.selectedLabels.size > 1) {
            // Multi-drag: include all selected labels
            labelsToDrag = Array.from(this.selectedLabels);
            console.log(`Multi-dragging ${labelsToDrag.length} selected text labels:`, labelsToDrag);
            
            // Set multi-label drag data (using same format as node-to-node multi-drag)
            e.dataTransfer.setData('application/x-selected-labels', JSON.stringify(labelsToDrag));
            e.dataTransfer.setData('application/x-source-node-id', 'text-files-panel');
        } else {
            // Single drag: just this label
            labelsToDrag = [textFileLabel.label];
            console.log(`Single-dragging text file label: ${textFileLabel.label} from sourceNode: ${textFileLabel.sourceNodeId}`);
            
            // Set single-label drag data for backward compatibility
            e.dataTransfer.setData('application/x-text-file-label', textFileLabel.label);
        }
        
        // Common drag data
        e.dataTransfer.setData('text/plain', labelsToDrag.join(', '));
        e.dataTransfer.setData('application/x-source-type', textFileLabel.sourceType);
        e.dataTransfer.effectAllowed = 'copy';
        
        // Emit drag start event
        this.eventBus.emit('text-file-drag-start', {
            labels: labelsToDrag,
            isMultiple: labelsToDrag.length > 1,
            sourceLabel: textFileLabel
        });
    }
    
    handleDragEnd(e, textFileLabel) {
        // Emit drag end event to notify other components
        this.eventBus.emit('text-file-drag-end', {
            sourceLabel: textFileLabel
        });
    }
    
    handleClick(e, textFileLabel) {
        // V4: Multi-select with Ctrl+click, single select without Ctrl
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Multi-select: add/remove from selection
            if (this.selectedLabels.has(textFileLabel.label)) {
                this.selectedLabels.delete(textFileLabel.label);
                console.log(`Deselected: ${textFileLabel.label}`);
            } else {
                this.selectedLabels.add(textFileLabel.label);
                console.log(`Selected: ${textFileLabel.label}`);
            }
        } else {
            // Single select: clear others and select this one
            this.selectedLabels.clear();
            this.selectedLabels.add(textFileLabel.label);
            console.log(`Single selected: ${textFileLabel.label}`);
        }
        
        // Update visual selection for all labels
        this.updateAllSelectionVisuals();
        
        console.log(`Current selection:`, Array.from(this.selectedLabels));
    }
    
    updateAllSelectionVisuals() {
        // Update visual selection state for all labels
        this.textFileLabels.forEach(item => {
            const labelElement = document.querySelector(`[data-label="${item.label}"]`);
            if (labelElement) {
                if (this.selectedLabels.has(item.label)) {
                    labelElement.classList.add('selected');
                    // Override ToolStyleManager inline styles for selected state
                    labelElement.style.backgroundColor = '#fde68a';
                    labelElement.style.borderColor = '#d97706';
                } else {
                    labelElement.classList.remove('selected');
                    // Reset to ToolStyleManager styling - get original colors
                    const toolType = item.sourceNodeType || 'upload';
                    const sourceType = item.sourceType;
                    if (this.toolStyleManager) {
                        const styleInfo = this.toolStyleManager.getToolStyleInfo(toolType, sourceType);
                        labelElement.style.backgroundColor = styleInfo.colors.background;
                        labelElement.style.borderColor = styleInfo.colors.border;
                    }
                }
            }
        });
    }
    
    toggleSelection(label) {
        // Legacy method - kept for compatibility
        const labelElement = document.querySelector(`[data-label="${label}"]`);
        if (labelElement) {
            labelElement.classList.toggle('selected');
        }
    }
    
    clearTextFileLabels() {
        this.textFileLabels = [];
        const container = document.getElementById('textFilesLabelList');
        if (container) {
            container.innerHTML = '';
        }
    }

    clearNodeOutputLabels() {
        // Clear only node-output files, preserve auto-generated and manual text files
        const initialCount = this.textFileLabels.length;
        this.textFileLabels = this.textFileLabels.filter(label => 
            label.sourceType !== 'node-output'
        );
        const removedCount = initialCount - this.textFileLabels.length;
        
        if (removedCount > 0) {
            console.log(`📄 TextFilesManager: Cleared ${removedCount} node-output text files`);
            this.renderTextFileLabels();
        }
    }
    
    clearFilter() {
        // Show all text file labels
        this.textFileLabels.forEach(item => {
            item.isVisible = true;
        });
        this.renderTextFileLabels();
    }
    
    addTextFileLabel(labelData) {
        // Public method to add new text file labels
        if (!this.textFileLabels.find(item => item.id === labelData.id)) {
            this.textFileLabels.push({
                ...labelData,
                isVisible: true,
                createdAt: Date.now()
            });
            this.renderTextFileLabels();
        }
    }
    
    getTextFileLabels() {
        return this.textFileLabels;
    }
    
    getTextFileLabelByLabel(label) {
        return this.textFileLabels.find(item => item.label === label);
    }
    

    createDeleteButton(textFileLabel) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-label-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete this file';
        deleteBtn.style.cssText = `
            position: absolute;
            top: 50%;
            right: 8px;
            transform: translateY(-50%);
            width: 18px;
            height: 18px;
            border: none;
            background: transparent;
            color: #dc2626;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10;
            border-radius: 4px;
        `;

        // Hover behavior will be handled by parent element

        // Handle delete click
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleDeleteClick(textFileLabel);
        });

        return deleteBtn;
    }

    handleDeleteClick(textFileLabel) {
        // Emit event to trigger cascading delete
        this.eventBus.emit('request-cascading-delete', {
            label: textFileLabel.label,
            source: 'text-files'
        });
    }

    // Method called by CascadingDeleteManager
    removeLabel(label) {
        this.textFileLabels = this.textFileLabels.filter(item => item.label !== label);
        this.renderTextFileLabels();
        console.log(`Removed label ${label} from TextFilesManager`);
    }

    getFileTypeFromExtension(fileName) {
        if (fileName.endsWith('.pdf')) return 'application/pdf';
        if (fileName.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (fileName.endsWith('.html') || fileName.endsWith('.htm')) return 'text/html';
        return 'text/plain';
    }
}

export { TextFilesManager };