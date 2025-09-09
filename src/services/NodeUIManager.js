// NodeUIManager.js - Node UI rendering and user interactions
// Handles all DOM rendering, event handling, and user interactions for nodes
// SURGICAL PRECISION: Exact same functionality as NodeManager, just reorganized

class NodeUIManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.canvas = null;
        this.selectedNode = null;
        this.draggedNode = null;
        
        // Global drag state for label expansion functionality
        this.isDraggingGlobalState = false;
        
        // Dependencies (will be injected)
        this.nodeDataManager = null;
        this.toolPalette = null;
        this.toolStyleManager = null;
        
        // Document-level event handlers (bound once)
        this._documentListenersSetup = false;
        this._mouseMoveHandler = null;
        this._mouseUpHandler = null;
        
        this.initialize();
    }
    
    initialize() {
        this.canvas = document.getElementById('canvas');
        this.setupEventListeners();
    }
    
    // ============================================================================
    // DEPENDENCY INJECTION
    // ============================================================================
    
    setNodeDataManager(nodeDataManager) {
        this.nodeDataManager = nodeDataManager;
    }
    
    setToolPalette(toolPalette) {
        this.toolPalette = toolPalette;
    }
    
    setToolStyleManager(toolStyleManager) {
        this.toolStyleManager = toolStyleManager;
    }
    
    // ============================================================================
    // EVENT LISTENERS SETUP
    // ============================================================================
    
    setupEventListeners() {
        // Listen for rendering requests from NodeDataManager
        this.eventBus.on('node:added', this.handleNodeAdded.bind(this));
        this.eventBus.on('node:render:request', this.handleRenderRequest.bind(this));
        this.eventBus.on('node:state:evaluate', this.handleStateEvaluate.bind(this));
        this.eventBus.on('node-inputs-changed', this.handleLabelChanged.bind(this));
        this.eventBus.on('node:prompt:changed', this.handlePromptChanged.bind(this));
        
        // Listen for UI-specific events
        this.eventBus.on('node:validation:failed', this.handleValidationFailed.bind(this));
        this.eventBus.on('update-node-color', this.handleUpdateNodeColor.bind(this));
        this.eventBus.on('node:processing:changed', this.handleProcessingChanged.bind(this));
        
        // Canvas welcome message management
        this.eventBus.on('node:added', () => this.hideWelcomeMessage());
        this.eventBus.on('node:removed', (nodeData) => {
            // Remove the node from the DOM
            this.removeNodeElement(nodeData.id);
            
            // Show welcome message if no nodes remain
            if (this.nodeDataManager && this.nodeDataManager.getNodeCount() === 0) {
                this.showWelcomeMessage();
            }
        });
    }
    
    // ============================================================================
    // NODE RENDERING - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    renderNode(nodeData) {
        console.log(`🎨 NodeUIManager.renderNode called for ${nodeData.id}`, {
            type: nodeData.type,
            inputLabels: nodeData.inputLabels,
            outputLabels: nodeData.outputLabels,
            position: nodeData.position
        });
        
        // Re-initialize canvas if not found
        if (!this.canvas) {
            this.canvas = document.getElementById('canvas');
        }
        
        if (!this.canvas) {
            console.error('❌ Canvas element not found in DOM');
            return;
        }
        
        // Get tool definition from the tool palette
        const toolDef = this.toolPalette?.findToolById(nodeData.type);
        if (!toolDef) {
            console.warn(`Tool definition not found for type: ${nodeData.type}`);
            return;
        }

        const nodeElement = document.createElement('div');
        nodeElement.className = `node ${nodeData.type}`;
        nodeElement.style.position = 'absolute';
        nodeElement.style.left = `${nodeData.position.x}px`;
        nodeElement.style.top = `${nodeData.position.y}px`;
        nodeElement.style.minWidth = '160px';
        nodeElement.style.maxWidth = 'none';
        nodeElement.style.background = 'white';
        nodeElement.style.border = '2px solid #e5e7eb';
        nodeElement.style.borderRadius = '8px';
        nodeElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        nodeElement.style.cursor = 'move';
        nodeElement.style.transition = 'all 0.2s ease';
        nodeElement.dataset.nodeId = nodeData.id;
        nodeElement.dataset.nodeType = nodeData.type;
        
        // Apply category background color using ToolStyleManager
        if (this.toolStyleManager) {
            const colors = this.toolStyleManager.getToolColors(nodeData.type);
            nodeElement.style.backgroundColor = colors.background;
        }

        // EXACT COPY from NodeManager.renderNode to ensure no missing features
        const inputLabels = nodeData.inputLabels || nodeData.inputs || [];
        const outputLabels = nodeData.outputLabels || [];
        const maxVisibleLabels = 3;
        const visibleInputs = inputLabels.slice(0, maxVisibleLabels);
        const hiddenInputCount = inputLabels.length - maxVisibleLabels;
        const visibleOutputs = outputLabels.slice(0, maxVisibleLabels);
        const hiddenOutputCount = outputLabels.length - maxVisibleLabels;

        nodeElement.innerHTML = `
            <div style="text-align: center; padding: 12px; min-width: 160px; max-width: 160px; word-wrap: break-word;">
                <div class="node-header" style="text-align: center; margin-bottom: 8px; cursor: grab; position: relative;">
                    <div style="font-size: 18px; margin-bottom: 4px;">${toolDef.icon}</div>
                    <div style="font-weight: 500; font-size: 14px;">${toolDef.name}</div>
                    <div class="node-menu-btn" style="position: absolute; top: 0; right: 0; font-size: 12px; cursor: pointer; color: #6b7280; hover: #374151;">⚙️</div>
                </div>
                
                ${inputLabels.length > 0 ? `
                    <div class="inputs-container" style="margin-bottom: 12px;">
                        <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Inputs</div>
                        <div class="visible-inputs" style="display: flex; justify-content: center; gap: 4px; flex-wrap: wrap;">
                            ${visibleInputs.map(input => `
                                <span class="file-label" style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 500; ${this.getInputLabelInlineStyle(input)}" 
                                      data-label="${input}" 
                                      data-node-id="${nodeData.id}"
                                      draggable="true">${input}</span>
                            `).join('')}
                            ${hiddenInputCount > 0 ? `
                                <span class="hidden-count" style="font-size: 12px; color: #6b7280; padding: 0 4px;">+${hiddenInputCount}</span>
                            ` : ''}
                        </div>
                        <div class="all-inputs" style="display: none; flex-direction: column; gap: 2px; align-items: center;">
                            ${inputLabels.map(input => `
                                <span class="file-label" style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 500; ${this.getInputLabelInlineStyle(input)}" 
                                      data-label="${input}" 
                                      data-node-id="${nodeData.id}"
                                      draggable="true">${input}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${outputLabels.length > 0 ? `
                    <div class="outputs-container">
                        <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Outputs</div>
                        <div class="visible-outputs" style="display: flex; flex-direction: column; gap: 4px;">
                            ${visibleOutputs.map(output => `
                                <div style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; text-align: center; font-weight: 500;" 
                                     title="Output: ${output}">
                                    ${output}
                                </div>
                            `).join('')}
                            ${hiddenOutputCount > 0 ? `
                                <div class="hidden-count" style="font-size: 12px; color: #6b7280; text-align: center;">+${hiddenOutputCount}</div>
                            ` : ''}
                        </div>
                        <div class="all-outputs" style="display: none; flex-direction: column; gap: 2px;">
                            ${outputLabels.map(output => `
                                <div style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; text-align: center; font-weight: 500;" 
                                     title="Output: ${output}">
                                    ${output}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${nodeData.userPrompt ? `
                    <div style="font-size: 12px; color: #2563eb; text-align: center; margin-top: 8px;">✏️</div>
                ` : ''}
            </div>
            
            <!-- Connection Points -->
            <div class="connection-point input" style="position: absolute; left: -8px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; background-color: white; border-radius: 50%; border: 2px solid #9ca3af;"></div>
            <div class="connection-point output" style="position: absolute; right: -8px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; background-color: white; border-radius: 50%; border: 2px solid #9ca3af;"></div>
        `;

        // Add event handlers
        this.setupNodeEventHandlers(nodeElement, nodeData);

        // Remove existing node element if it exists
        const existingElement = document.querySelector(`[data-node-id="${nodeData.id}"]`);
        if (existingElement) {
            existingElement.remove();
        }

        this.canvas.appendChild(nodeElement);
        console.log(`✅ Node rendered: ${nodeData.id}`);
        
        // Emit event for systems that need to act after DOM rendering
        this.eventBus.emit('node-rendered', nodeData);
        
        // Return the created element for other systems that need it
        return nodeElement;
    }
    
    updateNodeDisplay(nodeData) {
        // More efficient approach: only update the content if node exists
        const nodeElement = document.querySelector(`[data-node-id="${nodeData.id}"]`);
        if (!nodeElement) {
            // Node doesn't exist, create it fresh
            this.renderNode(nodeData);
            console.log(`🔄 Node display updated: ${nodeData.id} (created fresh)`);
            return;
        }
        
        // Node exists, just update the inner content areas that change
        const inputLabels = nodeData.inputLabels || [];
        const outputLabels = nodeData.outputLabels || [];
        const maxVisibleLabels = 3;
        const visibleInputs = inputLabels.slice(0, maxVisibleLabels);
        const hiddenInputCount = inputLabels.length - maxVisibleLabels;
        const visibleOutputs = outputLabels.slice(0, maxVisibleLabels);
        const hiddenOutputCount = outputLabels.length - maxVisibleLabels;
        
        // Update inputs container
        let inputsContainer = nodeElement.querySelector('.inputs-container');
        if (inputLabels.length > 0) {
            if (!inputsContainer) {
                // Add inputs container if it doesn't exist
                const nodeContent = nodeElement.querySelector('div');
                if (!nodeContent) {
                    console.error('Node content div not found for', nodeData.id);
                    return;
                }
                inputsContainer = document.createElement('div');
                inputsContainer.className = 'inputs-container';
                inputsContainer.style.marginBottom = '12px';
                nodeContent.insertBefore(inputsContainer, nodeContent.querySelector('.outputs-container') || nodeContent.querySelector('.node-prompt') || null);
            }
            
            inputsContainer.innerHTML = `
                <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Inputs</div>
                <div class="visible-inputs" style="display: flex; justify-content: center; gap: 4px; flex-wrap: wrap;">
                    ${visibleInputs.map(input => `
                        <span class="file-label" style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 500; ${this.getInputLabelInlineStyle(input)}" 
                              data-label="${input}" 
                              data-node-id="${nodeData.id}"
                              draggable="true">${input}</span>
                    `).join('')}
                    ${hiddenInputCount > 0 ? `<span class="hidden-count" style="font-size: 12px; color: #6b7280; padding: 0 4px;">+${hiddenInputCount}</span>` : ''}
                </div>
                <div class="all-inputs" style="display: none; flex-direction: column; gap: 2px; align-items: center;">
                    ${inputLabels.map(input => `
                        <span class="file-label" style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 500; ${this.getInputLabelInlineStyle(input)}" 
                              data-label="${input}" 
                              data-node-id="${nodeData.id}"
                              draggable="true">${input}</span>
                    `).join('')}
                </div>
            `;
            
            // Re-setup label interactions for new labels
            this.setupLabelInteractions(nodeElement, nodeData);
        } else if (inputsContainer) {
            inputsContainer.remove();
        }
        
        // Update outputs container
        let outputsContainer = nodeElement.querySelector('.outputs-container');
        if (outputLabels.length > 0) {
            if (!outputsContainer) {
                const nodeContent = nodeElement.querySelector('div');
                if (!nodeContent) {
                    console.error('Node content div not found for', nodeData.id);
                    return;
                }
                outputsContainer = document.createElement('div');
                outputsContainer.className = 'outputs-container';
                nodeContent.insertBefore(outputsContainer, nodeContent.querySelector('.node-prompt') || null);
            }
            
            outputsContainer.innerHTML = `
                <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Outputs</div>
                <div class="visible-outputs" style="display: flex; flex-direction: column; gap: 4px;">
                    ${visibleOutputs.map(output => `
                        <div style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; text-align: center; font-weight: 500;" 
                             title="Output: ${output}">
                            ${output}
                        </div>
                    `).join('')}
                    ${hiddenOutputCount > 0 ? `<div class="hidden-count" style="font-size: 12px; color: #6b7280; text-align: center;">+${hiddenOutputCount}</div>` : ''}
                </div>
                <div class="all-outputs" style="display: none; flex-direction: column; gap: 2px;">
                    ${outputLabels.map(output => `
                        <div style="font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; text-align: center; font-weight: 500;" 
                             title="Output: ${output}">
                            ${output}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (outputsContainer) {
            outputsContainer.remove();
        }
        
        console.log(`🔄 Node display updated: ${nodeData.id} (content only)`);
    }
    
    // ============================================================================
    // STYLING HELPERS - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    getInputLabelInlineStyle(input) {
        // Use ToolStyleManager if available, otherwise fallback to legacy logic
        if (this.toolStyleManager) {
            // Get file info to determine appropriate tool styling
            const uploadZone = window.toolFlowBuilder?.uploadZone;
            let toolType = 'upload'; // default for uploaded files
            
            if (uploadZone) {
                const files = uploadZone.getFiles();
                const file = files.find(f => f.label === input);
                if (file && file.category) {
                    // Map file categories to appropriate tool types for styling
                    const categoryToToolMap = {
                        'audio': 'audio2text',
                        'video': 'video2text',
                        'image': 'image2text',
                        'document': 'pdf2text',
                        'text': 'upload'
                    };
                    toolType = categoryToToolMap[file.category] || 'upload';
                }
            }
            
            return this.toolStyleManager.getToolInlineStyles(toolType, 'auto-generated');
        }
        
        // Fallback to legacy styling
        return this.getLegacyInputLabelStyle(input);
    }
    
    getLegacyInputLabelStyle(input) {
        // Legacy styling logic (kept for compatibility)
        const uploadZone = window.toolFlowBuilder?.uploadZone;
        let category = 'document';
        
        if (uploadZone) {
            const files = uploadZone.getFiles();
            const file = files.find(f => f.label === input);
            if (file) {
                category = file.category;
            }
        }
        
        const categoryStyles = {
            'audio': 'background-color: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;',
            'video': 'background-color: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc;',
            'image': 'background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d;',
            'document': 'background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db;',
            'text': 'background-color: #d1fae5; color: #065f46; border: 1px solid #86efac;'
        };
        
        return categoryStyles[category] || categoryStyles['document'];
    }
    
    // ============================================================================
    // EVENT HANDLERS SETUP - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    setupNodeEventHandlers(nodeElement, nodeData) {
        // Drag and drop handlers
        this.setupNodeDragHandlers(nodeElement, nodeData);
        
        // Menu handlers
        this.setupNodeMenuHandlers(nodeElement, nodeData);
        
        // Input/output handlers
        this.setupInputOutputHandlers(nodeElement, nodeData);
        
        // Prompt handlers
        this.setupPromptHandlers(nodeElement, nodeData);
    }
    
    setupNodeDragHandlers(nodeElement, nodeData) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        nodeElement.addEventListener('mousedown', (e) => {
            // Skip if clicking on interactive elements
            if (e.target.closest('.node-menu-btn') || 
                e.target.closest('.remove-input-btn') ||
                e.target.closest('.file-label')) return;
            
            isDragging = true;
            this.draggedNode = nodeData;
            
            const rect = nodeElement.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            nodeElement.style.zIndex = '1000';
            nodeElement.style.cursor = 'grabbing';
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        // Use class instance for document listeners (bound to this instance)
        if (!this._documentListenersSetup) {
            this._documentListenersSetup = true;
            
            this._mouseMoveHandler = (e) => {
                if (!this.draggedNode) return;
                
                const nodeData = this.draggedNode;
                const nodeElement = document.querySelector(`[data-node-id="${nodeData.id}"]`);
                if (!nodeElement) return;
                
                const canvasRect = this.canvas.getBoundingClientRect();
                const header = nodeElement.querySelector('.node-header');
                if (!header) return;
                
                const rect = nodeElement.getBoundingClientRect();
                const dragOffset = {
                    x: rect.width / 2,
                    y: rect.height / 2
                };
                
                const newX = e.clientX - canvasRect.left - dragOffset.x;
                const newY = e.clientY - canvasRect.top - dragOffset.y;
                
                // Update position in data manager
                this.nodeDataManager?.updateNodePosition(nodeData.id, { x: newX, y: newY });
                
                nodeElement.style.left = `${newX}px`;
                nodeElement.style.top = `${newY}px`;
                
                // Emit event for connection redrawing
                this.eventBus.emit('node-moved', { nodeId: nodeData.id, position: { x: newX, y: newY } });
            };
            
            this._mouseUpHandler = () => {
                if (this.draggedNode) {
                    const nodeElement = document.querySelector(`[data-node-id="${this.draggedNode.id}"]`);
                    
                    this.draggedNode = null;
                    if (nodeElement) {
                        nodeElement.style.zIndex = '';
                        nodeElement.style.cursor = 'move';
                    }
                }
            };
            
            document.addEventListener('mousemove', this._mouseMoveHandler);
            document.addEventListener('mouseup', this._mouseUpHandler);
        }
    }
    
    setupNodeMenuHandlers(nodeElement, nodeData) {
        const menuBtn = nodeElement.querySelector('.node-menu-btn');
        if (!menuBtn) return;
        
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showNodeContextMenu(nodeData, e.pageX, e.pageY);
        });
        
        // Right-click context menu
        nodeElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showNodeContextMenu(nodeData, e.pageX, e.pageY);
        });
    }
    
    setupInputOutputHandlers(nodeElement, nodeData) {
        // Remove input button handlers
        nodeElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-input-btn')) {
                const label = e.target.dataset.label;
                this.eventBus.emit('node:label:remove', { nodeId: nodeData.id, label });
                e.stopPropagation();
            }
        });
        
        // Apply drop handling to the entire node element
        this.setupDropZone(nodeElement, nodeData);
        
        // Hover effects for label expansion
        this.setupNodeHoverEffects(nodeElement, nodeData);
        
        // Label drag and drop interactions
        this.setupLabelInteractions(nodeElement, nodeData);
    }
    
    setupNodeHoverEffects(nodeElement, nodeData) {
        let hoverTimeout = null;
        
        nodeElement.addEventListener('mouseenter', (e) => {
            // Clear any existing timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Show all labels when not dragging
            hoverTimeout = setTimeout(() => {
                this.showAllLabels(nodeElement);
            }, 300); // Small delay to avoid flickering
        });
        
        nodeElement.addEventListener('mouseleave', (e) => {
            // Clear timeout if we leave before showing
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Only hide labels if we're not in the middle of a drag operation
            if (!nodeElement.classList.contains('drag-over')) {
                this.hideAllLabels(nodeElement);
            }
        });
    }

    showAllLabels(nodeElement) {
        // Show all input labels
        const visibleInputs = nodeElement.querySelector('.visible-inputs');
        const allInputs = nodeElement.querySelector('.all-inputs');
        if (visibleInputs && allInputs) {
            visibleInputs.style.display = 'none';
            allInputs.style.display = 'flex';
        }
        
        // Show all output labels
        const visibleOutputs = nodeElement.querySelector('.visible-outputs');
        const allOutputs = nodeElement.querySelector('.all-outputs');
        if (visibleOutputs && allOutputs) {
            visibleOutputs.style.display = 'none';
            allOutputs.style.display = 'flex';
        }
    }

    hideAllLabels(nodeElement) {
        // Hide all input labels, show visible ones
        const visibleInputs = nodeElement.querySelector('.visible-inputs');
        const allInputs = nodeElement.querySelector('.all-inputs');
        if (visibleInputs && allInputs) {
            visibleInputs.style.display = 'flex';
            allInputs.style.display = 'none';
        }
        
        // Hide all output labels, show visible ones
        const visibleOutputs = nodeElement.querySelector('.visible-outputs');
        const allOutputs = nodeElement.querySelector('.all-outputs');
        if (visibleOutputs && allOutputs) {
            visibleOutputs.style.display = 'flex';
            allOutputs.style.display = 'none';
        }
    }
    
    setupLabelInteractions(nodeElement, nodeData) {
        // Label interactions for drag and drop
        const labelElements = nodeElement.querySelectorAll('.file-label[data-label]');
        
        labelElements.forEach(labelEl => {
            const label = labelEl.dataset.label;
            
            // Simple single click for label selection
            labelEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Simple selection toggle
                labelEl.classList.toggle('selected');
                console.log('Label clicked:', label);
            });

            // Simple drag for single label
            labelEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/x-label', label);
                e.dataTransfer.setData('application/x-source-node-id', nodeData.id);
                e.dataTransfer.effectAllowed = 'move';
                
                console.log('Dragging label:', label, 'from node:', nodeData.id);
            });
        });
    }
    
    setupPromptHandlers(nodeElement, nodeData) {
        const promptTextarea = nodeElement.querySelector('.node-prompt');
        if (!promptTextarea) return;
        
        promptTextarea.addEventListener('input', (e) => {
            this.eventBus.emit('node:prompt:update', { nodeId: nodeData.id, userPrompt: e.target.value });
        });
        
        promptTextarea.addEventListener('blur', (e) => {
            this.eventBus.emit('node:state:evaluate', nodeData);
        });
    }
    
    // ============================================================================
    // DROP ZONE HANDLING - EXACT SAME AS NODEMANAGER  
    // ============================================================================
    
    setupDropZone(dropZone, nodeData) {
        dropZone.addEventListener('dragover', (e) => {
            // Check if dragged item is a file or text file label
            const hasFileData = e.dataTransfer.types.includes('application/x-file-name');
            const hasTextFileLabel = e.dataTransfer.types.includes('application/x-text-file-label');
            const hasLabel = e.dataTransfer.types.includes('application/x-label');
            
            if (hasFileData || hasTextFileLabel || hasLabel) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Visual feedback
                dropZone.classList.add('drag-over');
                dropZone.style.backgroundColor = '#f0f9ff';
                dropZone.style.borderColor = '#3b82f6';
                dropZone.style.borderStyle = 'dashed';
                dropZone.style.borderWidth = '2px';
                
                // Keep fixed width during drag
                dropZone.style.width = '160px';
                dropZone.style.minWidth = '160px';
                dropZone.style.maxWidth = '160px';
                
                // Show acceptance readiness
                this.showAcceptanceReadiness(dropZone, nodeData);
            }
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            // Only remove highlight if we're actually leaving the node
            const rect = dropZone.getBoundingClientRect();
            const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!isInside) {
                dropZone.classList.remove('drag-over');
                dropZone.style.backgroundColor = '';
                dropZone.style.borderColor = '';
                dropZone.style.borderStyle = '';
                dropZone.style.borderWidth = '';
                
                // Hide acceptance readiness display
                this.hideAcceptanceReadiness(dropZone);
            }
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            
            // Clear visual feedback
            dropZone.classList.remove('drag-over');
            dropZone.style.backgroundColor = '';
            dropZone.style.borderColor = '';
            dropZone.style.borderStyle = '';
            dropZone.style.borderWidth = '';
            
            // Clear acceptance readiness display
            this.hideAcceptanceReadiness(dropZone);
            
            // CRITICAL FIX: Prevent output labels from being dropped as inputs on same node
            const hasLabel = e.dataTransfer.types.includes('application/x-label');
            const sourceNodeId = e.dataTransfer.getData('application/x-source-node-id');
            if (hasLabel && sourceNodeId === nodeData.id) {
                const label = e.dataTransfer.getData('application/x-label');
                // Check if this is an output label being dropped on the same node
                if (nodeData.outputLabels && nodeData.outputLabels.includes(label)) {
                    console.warn(`Blocked: Cannot drop output label "${label}" as input on the same node ${nodeData.id}`);
                    this.showValidationError(`Cannot drop output "${label}" as input on the same node`);
                    return;
                }
            }
            
            // Handle multi-label drops first
            const selectedLabelsData = e.dataTransfer.getData('application/x-selected-labels');
            if (selectedLabelsData) {
                // Handle multi-label drag from nodes OR text files panel
                const labelsData = e.dataTransfer.getData('application/x-selected-labels');
                const sourceNodeId = e.dataTransfer.getData('application/x-source-node-id');
                const labels = JSON.parse(labelsData);
                
                console.log('Dropping', labels.length, 'labels from', sourceNodeId, 'to node', nodeData.id);
                
                if (sourceNodeId === 'text-files-panel') {
                    // Multi-drop from text files panel
                    labels.forEach(label => {
                        console.log(`Processing multi-drop label: ${label} to node ${nodeData.id}`);
                        
                        // Use data manager for validation and addition
                        const node = this.nodeDataManager?.getNodeById(nodeData.id);
                        if (node) {
                            const validation = this.nodeDataManager.validateNodeInput(node, label);
                            if (validation.canAccept) {
                                this.eventBus.emit('node:label:add', { nodeId: nodeData.id, label });
                                
                                // Check if this label came from a node output and create connection
                                this.createConnectionFromTextFileLabel(label, nodeData.id);
                            } else {
                                console.warn(`Rejected multi-drop label ${label} for node ${nodeData.id}: ${validation.message}`);
                                this.showValidationError(`${label}: ${validation.message}`);
                            }
                        } else {
                            this.showValidationError(`${label}: Cannot be added to this node`);
                        }
                    });
                } else {
                    // Move each selected label from another node (legacy functionality)
                    labels.forEach(label => {
                        this.eventBus.emit('move-label-to-node', {
                            label: label,
                            sourceType: 'node',
                            sourceNodeId: sourceNodeId,
                            targetNodeId: nodeData.id
                        });
                    });
                }
                
                return;
            }
            
            // Handle single label drops
            const draggedData = e.dataTransfer.getData('text/plain');
            const singleTextFileLabel = e.dataTransfer.getData('application/x-text-file-label');
            
            if (singleTextFileLabel) {
                // Single text file label drop
                const node = this.nodeDataManager?.getNodeById(nodeData.id);
                if (node) {
                    const validation = this.nodeDataManager.validateNodeInput(node, singleTextFileLabel);
                    if (validation.canAccept) {
                        this.eventBus.emit('node:label:add', { nodeId: nodeData.id, label: singleTextFileLabel });
                        
                        // Check if this label came from a node output and create connection
                        this.createConnectionFromTextFileLabel(singleTextFileLabel, nodeData.id);
                    } else {
                        this.showValidationError(validation.message);
                    }
                } else {
                    this.showValidationError(`Cannot add ${singleTextFileLabel} to this node`);
                }
            } else if (draggedData) {
                try {
                    const data = JSON.parse(draggedData);
                    if (data.type === 'file-label' || data.type === 'text-file-label') {
                        const node = this.nodeDataManager?.getNodeById(nodeData.id);
                        if (node) {
                            const validation = this.nodeDataManager.validateNodeInput(node, data.label);
                            if (validation.canAccept) {
                                this.eventBus.emit('node:label:add', { nodeId: nodeData.id, label: data.label });
                            } else {
                                this.showValidationError(validation.message);
                            }
                        } else {
                            this.showValidationError(`Cannot add ${data.label} to this node`);
                        }
                    }
                } catch (err) {
                    // Handle simple text drops
                    const label = draggedData.trim();
                    if (label) {
                        const node = this.nodeDataManager?.getNodeById(nodeData.id);
                        if (node) {
                            const validation = this.nodeDataManager.validateNodeInput(node, label);
                            if (validation.canAccept) {
                                this.eventBus.emit('node:label:add', { nodeId: nodeData.id, label });
                            } else {
                                this.showValidationError(validation.message);
                            }
                        } else {
                            this.showValidationError(`Cannot add ${label} to this node`);
                        }
                    }
                }
            }
        });
    }
    
    // ============================================================================
    // VISUAL FEEDBACK HELPERS - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    showAcceptanceReadiness(nodeElement, nodeData) {
        // Show which files this node can accept by highlighting compatible sections
        const toolDef = this.toolPalette?.findToolById(nodeData.type);
        if (!toolDef) return;
        
        // Add acceptance indication overlay
        let acceptanceOverlay = nodeElement.querySelector('.acceptance-overlay');
        if (!acceptanceOverlay) {
            acceptanceOverlay = document.createElement('div');
            acceptanceOverlay.className = 'acceptance-overlay';
            acceptanceOverlay.style.cssText = `
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                background-color: rgba(34, 197, 94, 0.1);
                border: 2px solid #22c55e;
                border-radius: 8px;
                pointer-events: none;
                z-index: 10;
            `;
            nodeElement.style.position = 'relative';
            nodeElement.appendChild(acceptanceOverlay);
        }
        
        // Add acceptance message
        let acceptanceMessage = nodeElement.querySelector('.acceptance-message');
        if (!acceptanceMessage) {
            acceptanceMessage = document.createElement('div');
            acceptanceMessage.className = 'acceptance-message';
            acceptanceMessage.style.cssText = `
                position: absolute;
                top: -32px;
                left: 50%;
                transform: translateX(-50%);
                background: #22c55e;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 11;
            `;
            acceptanceMessage.textContent = `Drop here: ${toolDef.name}`;
            nodeElement.appendChild(acceptanceMessage);
        }
    }
    
    hideAcceptanceReadiness(nodeElement) {
        // Remove acceptance overlay and message
        const acceptanceOverlay = nodeElement.querySelector('.acceptance-overlay');
        const acceptanceMessage = nodeElement.querySelector('.acceptance-message');
        
        if (acceptanceOverlay) {
            acceptanceOverlay.remove();
        }
        if (acceptanceMessage) {
            acceptanceMessage.remove();
        }
        
        // Reset position style to prevent layout issues
        nodeElement.style.position = '';
    }
    
    // ============================================================================
    // CONTEXT MENU SYSTEM - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    showNodeContextMenu(nodeData, x, y) {
        // Create or update context menu
        let contextMenu = document.getElementById('nodeContextMenu');
        if (!contextMenu) {
            contextMenu = document.createElement('div');
            contextMenu.id = 'nodeContextMenu';
            contextMenu.className = 'context-menu';
            document.body.appendChild(contextMenu);
        }
        
        contextMenu.innerHTML = `
            <div class="context-item" data-action="edit-prompt">
                <span>✏️</span> Edit Prompt
            </div>
            <div class="context-item" data-action="clear-inputs">
                <span>🧹</span> Clear Inputs
            </div>
            <div class="context-item" data-action="duplicate">
                <span>📋</span> Duplicate Node
            </div>
            <div class="context-divider"></div>
            <div class="context-item danger" data-action="delete">
                <span style="color: #dc2626;">🗑️</span> Delete Node
            </div>
        `;
        
        // Position menu
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        
        // Add event handlers
        contextMenu.onclick = (e) => {
            const action = e.target.closest('.context-item')?.dataset.action;
            if (action) {
                this.handleContextMenuAction(action, nodeData);
                this.hideContextMenu();
            }
        };
        
        // Hide menu on click outside
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 0);
    }
    
    hideContextMenu() {
        const contextMenu = document.getElementById('nodeContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }
    
    handleContextMenuAction(action, nodeData) {
        switch (action) {
            case 'edit-prompt':
                this.showCustomPromptDialog(nodeData);
                break;
            case 'clear-inputs':
                this.eventBus.emit('node:inputs:clear', { nodeId: nodeData.id });
                break;
            case 'duplicate':
                this.duplicateNode(nodeData);
                break;
            case 'delete':
                this.eventBus.emit('node:delete:request', { nodeId: nodeData.id });
                break;
        }
    }
    
    duplicateNode(nodeData) {
        const newPosition = {
            x: nodeData.position.x + 120,
            y: nodeData.position.y + 20
        };
        
        // Request node creation through data manager
        this.eventBus.emit('node:create:request', { 
            toolType: nodeData.type, 
            position: newPosition,
            userPrompt: nodeData.userPrompt 
        });
        
        console.log(`📋 Node duplicated: ${nodeData.id}`);
    }
    
    // ============================================================================
    // CUSTOM PROMPT DIALOG - EXACT SAME AS NODEMANAGER
    // ============================================================================
    
    showCustomPromptDialog(nodeData) {
        const toolDef = this.toolPalette?.findToolById(nodeData.type);
        if (!toolDef) {
            console.warn(`Tool definition not found for type: ${nodeData.type}`);
            return;
        }
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50;';
        modal.innerHTML = `
            <div style="background-color: white; border-radius: 8px; padding: 24px; max-width: 672px; width: 100%; margin: 0 16px; max-height: 384px; overflow-y: auto;">
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Edit Custom Instructions - ${toolDef.name}</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
                        System Instructions (Read-only)
                    </label>
                    <textarea style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background-color: #f9fafb;" readonly rows="3">${toolDef.systemPrompt || toolDef.description}</textarea>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
                        Custom Instructions
                    </label>
                    <textarea id="customPrompt" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; resize: vertical;" rows="6" placeholder="Add your custom instructions here...">${nodeData.userPrompt || ''}</textarea>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                        These instructions will be added to the system prompt when processing this node.
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="cancelBtn" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="saveBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        Save
                    </button>
                </div>
            </div>
        `;
        
        // Add event handlers
        const customPromptTextarea = modal.querySelector('#customPrompt');
        const saveBtn = modal.querySelector('#saveBtn');
        const cancelBtn = modal.querySelector('#cancelBtn');
        
        saveBtn.addEventListener('click', () => {
            const userPrompt = customPromptTextarea.value.trim();
            this.eventBus.emit('node:prompt:update', { nodeId: nodeData.id, userPrompt });
            modal.remove();
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
        
        document.body.appendChild(modal);
        customPromptTextarea.focus();
    }
    
    // ============================================================================
    // UI STATE MANAGEMENT
    // ============================================================================
    
    hideWelcomeMessage() {
        const welcomeElement = document.getElementById('canvasWelcome');
        if (welcomeElement) {
            welcomeElement.style.display = 'none';
        }
    }
    
    showWelcomeMessage() {
        const welcomeElement = document.getElementById('canvasWelcome');
        if (welcomeElement) {
            welcomeElement.style.display = 'flex';
        }
    }
    
    showValidationError(message) {
        // Emit event for canvas notification system
        this.eventBus.emit('show-canvas-notification', {
            type: 'error',
            message: message
        });
    }
    
    // ============================================================================
    // CONNECTION HELPERS
    // ============================================================================
    
    createConnectionFromTextFileLabel(label, targetNodeId) {
        // Get the text file label data from TextFilesManager
        const textFilesManager = window.toolFlowBuilder?.textFilesManager;
        const labelData = textFilesManager?.getTextFileLabelByLabel(label);
        
        // Emit event to create connection with source data
        this.eventBus.emit('create-connection-from-label', {
            label: label,
            targetNodeId: targetNodeId,
            sourceData: labelData // Pass the label data for the ConnectionManager to use
        });
    }
    
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    handleNodeAdded(nodeData) {
        // Render the newly added node
        this.renderNode(nodeData);
    }
    
    handleRenderRequest(nodeData) {
        // Handle explicit render requests
        this.renderNode(nodeData);
    }
    
    handleStateEvaluate(nodeData) {
        // Update the display when node state changes
        this.updateNodeDisplay(nodeData);
    }
    
    handleLabelChanged({ nodeId }) {
        // Update display when labels change
        const nodeData = this.nodeDataManager?.getNodeById(nodeId);
        if (nodeData) {
            this.updateNodeDisplay(nodeData);
        }
    }
    
    handlePromptChanged({ nodeId }) {
        // Update display when prompt changes
        const nodeData = this.nodeDataManager?.getNodeById(nodeId);
        if (nodeData) {
            this.updateNodeDisplay(nodeData);
        }
    }
    
    handleValidationFailed({ nodeId, label, reason }) {
        this.showValidationError(reason);
    }
    
    handleUpdateNodeColor({ nodeId, colorState, reason }) {
        // Handle node color updates - could emit to NodeColorManager
        this.eventBus.emit('update-node-color', { nodeId, colorState, reason });
    }
    
    handleProcessingChanged({ nodeId, isProcessing, error }) {
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeElement) return;
        
        // Update visual processing state
        if (isProcessing) {
            nodeElement.classList.add('processing');
        } else {
            nodeElement.classList.remove('processing');
        }
        
        if (error) {
            nodeElement.classList.add('error');
            this.showValidationError(`Node ${nodeId}: ${error}`);
        } else {
            nodeElement.classList.remove('error');
        }
    }
    
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    
    getNodeElementById(nodeId) {
        return document.querySelector(`[data-node-id="${nodeId}"]`);
    }
    
    getAllNodeElements() {
        return document.querySelectorAll('[data-node-id]');
    }
    
    removeNodeElement(nodeId) {
        const nodeElement = this.getNodeElementById(nodeId);
        if (nodeElement) {
            nodeElement.remove();
            return true;
        }
        return false;
    }
}

export { NodeUIManager };