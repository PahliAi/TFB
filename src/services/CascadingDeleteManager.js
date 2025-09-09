// CascadingDeleteManager - Handles safe cascading deletion with preview
// Maintains workflow integrity by analyzing dependencies before deletion

class CascadingDeleteManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.workflowCanvas = null; // Will be set by main app
        this.textFilesManager = null; // Will be set by main app
        this.inputFilesManager = null; // Will be set by main app
        this.outputZone = null; // Will be set by main app
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for deletion requests from any component
        this.eventBus.on('request-cascading-delete', this.handleDeleteRequest.bind(this));
    }

    async handleDeleteRequest(data) {
        const { label, source } = data;
        console.log(`Received delete request for ${label} from ${source}`);
        
        try {
            await this.deleteLabel(label);
        } catch (error) {
            console.error('Failed to process delete request:', error);
        }
    }

    setComponents(nodeDataManager, workflowCanvas, textFilesManager, inputFilesManager, outputZone, connectionManager) {
        this.nodeDataManager = nodeDataManager;
        this.workflowCanvas = workflowCanvas;
        this.textFilesManager = textFilesManager;
        this.inputFilesManager = inputFilesManager;
        this.outputZone = outputZone;
        this.connectionManager = connectionManager;
    }

    // Analyze what would be deleted if this label is removed
    analyzeDeletionImpact(labelToDelete) {
        const baseLabel = labelToDelete.replace('.txt', '');
        const impact = {
            label: labelToDelete,
            baseLabel: baseLabel,
            affectedNodes: [],
            deletedConnections: [],
            cascadingDeletes: [],
            totalNodesDeleted: 0,
            totalConnectionsDeleted: 0
        };

        // Find all nodes that use this label as input
        const allNodes = this.nodeDataManager.getAllNodes();
        const allConnections = this.workflowCanvas.getConnections();

        for (const node of allNodes) {
            if (this.nodeUsesLabel(node, baseLabel)) {
                const nodeImpact = this.analyzeNodeDeletion(node, baseLabel, allNodes, allConnections);
                impact.affectedNodes.push(nodeImpact);
                
                if (nodeImpact.willBeDeleted) {
                    impact.totalNodesDeleted++;
                    // Add connections that will be deleted
                    const nodeConnections = allConnections.filter(conn => 
                        conn.from === node.id || conn.to === node.id
                    );
                    impact.deletedConnections.push(...nodeConnections);
                }
            }
        }

        // Find cascading label deletions: labels that contain the deleted label name
        const allLabels = this.getAllLabelsInSystem();
        const cascadingLabels = allLabels.filter(label => {
            if (label === labelToDelete) return false; // Don't include the original label
            const labelBase = label.replace(/\.(txt|pdf|docx|xlsx)$/, '');
            return labelBase.includes(baseLabel);
        });

        impact.cascadingDeletes = cascadingLabels;
        impact.totalConnectionsDeleted = impact.deletedConnections.length;

        return impact;
    }

    // Get all labels from all sources (InputFiles, TextFiles, OutputZone)
    getAllLabelsInSystem() {
        const allLabels = [];
        
        // Get labels from InputFilesManager (A, B, C, etc.)
        if (this.inputFilesManager) {
            const inputLabels = this.inputFilesManager.getInputFileLabels();
            inputLabels.forEach(item => allLabels.push(item.label));
        }
        
        // Get labels from TextFilesManager (A.txt, B-sum.txt, etc.)
        if (this.textFilesManager) {
            const textLabels = this.textFilesManager.getTextFileLabels();
            textLabels.forEach(item => allLabels.push(item.label));
        }
        
        // Get labels from OutputZone (PDFs, etc.)
        if (this.outputZone && this.outputZone.getAllLabels) {
            const outputLabels = this.outputZone.getAllLabels();
            allLabels.push(...outputLabels);
        }
        
        return [...new Set(allLabels)]; // Remove duplicates
    }

    // Check if a node uses a specific label (without .txt extension)
    nodeUsesLabel(node, baseLabel) {
        if (!node.inputLabels) return false;
        
        return node.inputLabels.some(input => {
            const inputBase = input.replace('.txt', '');
            return inputBase === baseLabel;
        });
    }

    // Analyze what happens to a specific node when a label is removed
    analyzeNodeDeletion(node, removedLabel, allNodes, allConnections) {
        const currentInputs = node.inputLabels || [];
        const remainingInputs = currentInputs.filter(input => {
            const inputBase = input.replace('.txt', '');
            return inputBase !== removedLabel;
        });

        const inputRules = this.getInputRules(node.type);
        const willBeDeleted = remainingInputs.length < inputRules.minInputs;

        return {
            nodeId: node.id,
            nodeType: node.type,
            currentInputs: currentInputs,
            remainingInputs: remainingInputs,
            willBeDeleted: willBeDeleted,
            reason: willBeDeleted ? `Node needs minimum ${inputRules.minInputs} inputs, will have ${remainingInputs.length}` : 'Node will continue with remaining inputs'
        };
    }

    // Get input rules for node type (copied from WorkflowCanvas)
    getInputRules(nodeType) {
        const rules = {
            'pdf2text': { minInputs: 1, maxInputs: null },
            'audio2text': { minInputs: 1, maxInputs: null },
            'image2text': { minInputs: 1, maxInputs: null },
            'video2text': { minInputs: 1, maxInputs: null },
            'translator': { minInputs: 1, maxInputs: null },
            'summarizer': { minInputs: 1, maxInputs: null },
            'analyzer': { minInputs: 1, maxInputs: null },
            'join': { minInputs: 2, maxInputs: null },
            'text2pdf': { minInputs: 1, maxInputs: null },
            'text2docx': { minInputs: 1, maxInputs: null },
            'template': { minInputs: 1, maxInputs: null }
        };
        return rules[nodeType] || { minInputs: 1, maxInputs: null };
    }

    // Show preview dialog and get user confirmation
    async showDeletionPreview(impact) {
        return new Promise((resolve) => {
            const modal = this.createPreviewModal(impact);
            document.body.appendChild(modal);

            // Handle user response
            const handleResponse = (confirmed) => {
                document.body.removeChild(modal);
                resolve(confirmed);
            };

            modal.querySelector('.confirm-delete').addEventListener('click', () => handleResponse(true));
            modal.querySelector('.cancel-delete').addEventListener('click', () => handleResponse(false));
            
            // ESC to cancel
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleKeydown);
                    handleResponse(false);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    createPreviewModal(impact) {
        const modal = document.createElement('div');
        modal.className = 'deletion-preview-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'deletion-preview-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        `;

        const title = document.createElement('h3');
        title.textContent = '⚠️ Cascading Delete Preview';
        title.style.cssText = 'margin: 0 0 16px 0; color: #dc2626;';

        const summary = document.createElement('p');
        summary.style.cssText = 'margin: 0 0 16px 0; font-weight: 600;';
        const cascadingCount = impact.cascadingDeletes ? impact.cascadingDeletes.length : 0;
        let summaryText = `Deleting "${impact.label}" will affect ${impact.totalNodesDeleted} nodes and ${impact.totalConnectionsDeleted} connections`;
        if (cascadingCount > 0) {
            summaryText += ` and ${cascadingCount} additional labels`;
        }
        summary.textContent = summaryText + '.';

        const details = document.createElement('div');
        details.innerHTML = this.generateImpactDetails(impact);

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'confirm-delete';
        confirmBtn.textContent = 'Delete All';
        confirmBtn.style.cssText = `
            background: #dc2626;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-delete';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            background: #6b7280;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
        `;

        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);

        dialog.appendChild(title);
        dialog.appendChild(summary);
        dialog.appendChild(details);
        dialog.appendChild(buttons);

        modal.appendChild(dialog);
        return modal;
    }

    generateImpactDetails(impact) {
        let html = '<div style="margin: 16px 0;">';
        
        if (impact.affectedNodes.length === 0) {
            html += '<p style="color: #059669;">✅ No nodes will be affected by this deletion.</p>';
        } else {
            html += '<h4 style="margin: 0 0 8px 0; color: #374151;">Affected Nodes:</h4>';
            html += '<ul style="margin: 0; padding-left: 20px;">';
            
            for (const nodeImpact of impact.affectedNodes) {
                const icon = nodeImpact.willBeDeleted ? '🗑️' : '✏️';
                const color = nodeImpact.willBeDeleted ? '#dc2626' : '#d97706';
                const action = nodeImpact.willBeDeleted ? 'DELETED' : 'MODIFIED';
                
                html += `
                    <li style="margin: 4px 0; color: ${color};">
                        ${icon} <strong>${nodeImpact.nodeId}</strong> (${nodeImpact.nodeType}) - ${action}
                        <br><small style="color: #6b7280;">${nodeImpact.reason}</small>
                    </li>
                `;
            }
            
            html += '</ul>';
        }

        if (impact.totalConnectionsDeleted > 0) {
            html += `<p style="color: #dc2626; margin-top: 12px;"><strong>🔗 ${impact.totalConnectionsDeleted} connections will be deleted</strong></p>`;
        }

        // Show cascading label deletions
        if (impact.cascadingDeletes && impact.cascadingDeletes.length > 0) {
            html += '<h4 style="margin: 12px 0 8px 0; color: #374151;">Cascading Label Deletions:</h4>';
            html += '<ul style="margin: 0; padding-left: 20px;">';
            
            for (const label of impact.cascadingDeletes) {
                html += `
                    <li style="margin: 4px 0; color: #dc2626;">
                        🗑️ <strong>${label}</strong>
                        <br><small style="color: #6b7280;">Contains "${impact.baseLabel}" in filename</small>
                    </li>
                `;
            }
            
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    // Execute the cascading deletion
    async executeCascadingDelete(impact) {
        try {
            // 1. Delete from TextFilesManager first
            this.textFilesManager.removeLabel(impact.label);

            // 2. Delete from InputFilesManager if it exists there
            if (this.inputFilesManager.hasLabel(impact.baseLabel)) {
                this.inputFilesManager.removeLabel(impact.baseLabel);
            }

            // 3. Delete from OutputZone if it exists there
            if (this.outputZone && this.outputZone.hasLabel(impact.label)) {
                this.outputZone.removeLabel(impact.label);
            }

            // 3.5. Delete cascading labels
            if (impact.cascadingDeletes && impact.cascadingDeletes.length > 0) {
                console.log(`🔗 Deleting ${impact.cascadingDeletes.length} cascading labels`);
                for (const cascadingLabel of impact.cascadingDeletes) {
                    // Delete from TextFilesManager
                    if (this.textFilesManager.hasLabel && this.textFilesManager.hasLabel(cascadingLabel)) {
                        this.textFilesManager.removeLabel(cascadingLabel);
                    }
                    
                    // Delete from OutputZone
                    if (this.outputZone && this.outputZone.hasLabel(cascadingLabel)) {
                        this.outputZone.removeLabel(cascadingLabel);
                    }
                }
            }

            // 4. Process affected nodes
            for (const nodeImpact of impact.affectedNodes) {
                if (nodeImpact.willBeDeleted) {
                    // Delete the entire node if it still exists
                    const nodeExists = this.nodeDataManager.getNodeById(nodeImpact.nodeId);
                    if (nodeExists) {
                        this.nodeDataManager.removeNode(nodeImpact.nodeId);
                    }
                } else {
                    // Remove just the label from node inputs and regenerate outputs
                    const node = this.nodeDataManager.getNodeById(nodeImpact.nodeId);
                    if (node) {
                        // Remove the specific labels through proper NodeDataManager API
                        const currentLabels = node.inputLabels || [];
                        const labelsToRemove = currentLabels.filter(label => 
                            !nodeImpact.remainingInputs.includes(label)
                        );
                        
                        labelsToRemove.forEach(label => {
                            this.eventBus.emit('node:label:remove', { nodeId: node.id, label });
                        });
                    }
                }
            }

            // 5. Check for nodes that need to be deleted because their last output was removed
            const allNodes = this.nodeDataManager.getAllNodes();
            for (const node of allNodes) {
                // Check if this node produced the deleted label as output
                if (node.outputLabels && node.outputLabels.includes(impact.label)) {
                    // Remove the deleted output label from this node
                    node.outputLabels = node.outputLabels.filter(output => output !== impact.label);
                    
                    // If the node has no more outputs and no direct input connections, delete it
                    if (node.outputLabels.length === 0) {
                        console.log(`Node ${node.id} has no more outputs, removing it`);
                        this.nodeDataManager.removeNode(node.id);
                    }
                }
            }

            console.log(`✅ Cascading delete completed for ${impact.label}`);
            this.eventBus.emit('cascading-delete-completed', impact);

        } catch (error) {
            console.error('Error during cascading delete:', error);
            this.eventBus.emit('cascading-delete-failed', { impact, error });
        }
    }

    // Main public method - handles the full flow
    async deleteLabel(label) {
        console.log(`🔍 Analyzing deletion impact for: ${label}`);
        
        // 1. Analyze impact
        const impact = this.analyzeDeletionImpact(label);
        
        // 2. Show preview and get confirmation
        const confirmed = await this.showDeletionPreview(impact);
        
        if (confirmed) {
            // 3. Execute deletion
            await this.executeCascadingDelete(impact);
            return true;
        } else {
            console.log('Cascading delete cancelled by user');
            return false;
        }
    }

    // Clear all workflow nodes with confirmation - reuses existing modal
    async clearAllWorkflowNodes() {
        console.log(`🔍 Analyzing clear all workflow impact`);
        
        const allNodes = this.nodeDataManager.getAllNodes();
        if (allNodes.length === 0) {
            console.log('No nodes to clear');
            return true;
        }

        // Aggregate impact of all nodes by iterating through all unique output labels
        const allOutputLabels = new Set();
        allNodes.forEach(node => {
            if (node.outputLabels) {
                node.outputLabels.forEach(label => allOutputLabels.add(label));
            }
        });

        // Create combined impact for all nodes
        const combinedImpact = {
            label: 'Clear All Workflow',
            baseLabel: 'all-workflow',
            affectedNodes: [],
            deletedConnections: [],
            cascadingDeletes: [],
            totalNodesDeleted: allNodes.length,
            totalConnectionsDeleted: this.connectionManager ? this.connectionManager.getAllConnections().length : 0
        };

        // Add all nodes as affected (will be deleted)
        allNodes.forEach(node => {
            combinedImpact.affectedNodes.push({
                nodeId: node.id,
                nodeType: node.type,
                willBeDeleted: true,
                remainingInputs: [],
                removedInputs: node.inputLabels || []
            });
        });

        // Show preview and get confirmation using existing modal
        const confirmed = await this.showDeletionPreview(combinedImpact);
        
        if (confirmed) {
            // Clear all nodes directly
            this.nodeDataManager.clearAllNodes();
            this.workflowCanvas?.clear?.();
            this.outputZone?.clear?.();
            console.log(`✅ All workflow nodes cleared`);
            return true;
        } else {
            console.log('Clear all cancelled by user');
            return false;
        }
    }
}

export { CascadingDeleteManager };