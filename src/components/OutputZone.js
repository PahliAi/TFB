class OutputZone {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.outputs = [];
        this.businessNames = new Map();
        this.toolStyleManager = null; // Will be set by main app
        this.isPostExecution = false; // Track if workflow has been executed
        this.initialize();
        this.setupEventListeners();
    }
    
    setToolStyleManager(toolStyleManager) {
        this.toolStyleManager = toolStyleManager;
    }

    setupEventListeners() {
        // Listen for output-added events from other components (like TextFilesManager)
        this.eventBus.on('output-added', this.handleExternalOutputAdded.bind(this));
        
        // Listen for workflow execution completion
        this.eventBus.on('workflow-executed', this.handleWorkflowExecuted.bind(this));
        
        // DOM event listeners
        const downloadResultsHeader = document.getElementById('downloadResultsHeader');
        downloadResultsHeader?.addEventListener('click', this.downloadAll.bind(this));
        
        // Add help button functionality
        const outputFilesHelpBtn = document.getElementById('outputFilesHelpBtn');
        outputFilesHelpBtn?.addEventListener('click', this.showHelpDialog.bind(this));
        
        // Add drop zone functionality
        const outputList = document.getElementById('outputList');
        console.log('OutputZone: outputList element found:', !!outputList);
        if (outputList) {
            outputList.addEventListener('dragover', this.handleDragOver.bind(this));
            outputList.addEventListener('dragleave', this.handleDragLeave.bind(this));
            outputList.addEventListener('drop', this.handleDrop.bind(this));
            console.log('OutputZone: Drop handlers attached');
        }
    }

    handleExternalOutputAdded(output) {
        // Check if this output already exists to avoid duplicates
        const existingIndex = this.outputs.findIndex(existing => existing.systemName === output.systemName);
        if (existingIndex !== -1) {
            // If the new output is a workflow output and existing is not, replace it
            if (output.isWorkflowOutput && !this.outputs[existingIndex].isWorkflowOutput) {
                console.log(`Replacing placeholder output ${output.systemName} with workflow result`);
                this.outputs[existingIndex] = output;
                this.renderOutputs();
                this.updateDownloadButton();
                return;
            } else {
                console.log(`Output ${output.systemName} already exists, skipping`);
                return;
            }
        }

        // Add the output to our list
        this.outputs.push(output);
        this.renderOutputs();
        this.updateDownloadButton();
        
        console.log(`Added external output: ${output.systemName}`);
    }

    handleWorkflowExecuted(results) {
        console.log('Workflow execution completed, switching to post-execution mode');
        this.isPostExecution = true;
        this.renderOutputs(); // Re-render to apply green styling
        this.updateDownloadButton(); // Enable download button
        this.updateROIDisplay(); // Update ROI calculations
    }

    initialize() {
        console.log('OutputZone: initialize() called');
        this.updateDownloadButton(); // Set initial state to disabled
    }


    showHelpDialog() {
        alert('📥 Output Files Help\n\n' +
              '• Drag text files here that you want to get back from workflow execution\n' +
              '• Click ✏️ to rename files (the workflow executor will use these names)\n' +
              '• Files can only be downloaded 📥 AFTER workflow execution\n' +
              '• This helps you plan what outputs you want before running the workflow');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        
        // Add visual feedback for drag over
        const outputList = document.getElementById('outputList');
        if (outputList && e.dataTransfer.types.includes('application/x-text-file-label')) {
            outputList.style.backgroundColor = '#f0f9ff';
            outputList.style.borderColor = '#3b82f6';
            outputList.style.borderStyle = 'dashed';
            outputList.style.borderWidth = '2px';
        }
    }
    
    handleDragLeave(e) {
        // Remove visual feedback when drag leaves
        const outputList = document.getElementById('outputList');
        if (outputList) {
            // Only remove feedback if we're actually leaving the outputList area
            const rect = outputList.getBoundingClientRect();
            const isInside = e.clientX >= rect.left && e.clientX <= rect.right &&
                           e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!isInside) {
                outputList.style.backgroundColor = '';
                outputList.style.borderColor = '';
                outputList.style.borderStyle = '';
                outputList.style.borderWidth = '';
            }
        }
    }

    handleDrop(e) {
        e.preventDefault();
        console.log('OutputZone: Drop event triggered', e.dataTransfer.types);
        
        // Clear visual feedback
        const outputList = document.getElementById('outputList');
        if (outputList) {
            outputList.style.backgroundColor = '';
            outputList.style.borderColor = '';
            outputList.style.borderStyle = '';
            outputList.style.borderWidth = '';
        }
        
        const textFileLabel = e.dataTransfer.getData('application/x-text-file-label');
        console.log('OutputZone: Text file label:', textFileLabel);
        if (textFileLabel) {
            // Add text file to output zone
            this.addTextFileToOutput(textFileLabel);
        }
    }

    addTextFileToOutput(labelName) {
        // Create output entry for text file
        const output = {
            nodeId: 'manual',
            nodeType: 'text-file',
            systemName: labelName,
            content: `Content of ${labelName}`,
            type: 'text/plain',
            success: true,
            businessName: labelName,
            isManualDrop: true // Flag to show edit button instead of download
        };
        
        this.outputs.push(output);
        this.renderOutputs();
        this.updateDownloadButton();
        
        // Activate EXECUTE button
        this.eventBus.emit('output-added', output);
        
        // Create connection from text file to output zone
        this.eventBus.emit('create-output-connection', {
            from: 'text-files',
            to: 'output-zone', 
            label: labelName,
            outputId: output.systemName
        });
    }

    displayResults(results) {
        this.outputs = results;
        this.isPostExecution = true; // Switch to post-execution mode
        this.renderOutputs();
        this.updateDownloadButton();
        this.updateROIDisplay();
    }

    renderOutputs() {
        const outputList = document.getElementById('outputList');
        if (!outputList) return;

        outputList.innerHTML = '';

        if (this.outputs.length === 0) {
            outputList.classList.add('empty');
            outputList.innerHTML = `
                <div class="output-placeholder">
                    <div class="placeholder-icon">📋</div>
                    <p class="placeholder-text">Output files will appear here</p>
                    <p class="placeholder-subtext">Drop files here to add them</p>
                </div>
            `;
            return;
        } else {
            outputList.classList.remove('empty');
        }

        this.outputs.forEach((output, index) => {
            const outputCard = this.createOutputCard(output, index);
            outputList.appendChild(outputCard);
        });
    }

    createOutputCard(output, index) {
        const businessName = this.businessNames.get(output.systemName) || output.systemName;
        const displayName = this.cleanDisplayName(businessName || output.systemName);
        
        if (!this.toolStyleManager) {
            // Fallback if ToolStyleManager not available
            const card = document.createElement('div');
            card.className = 'output-card';
            card.style.cssText = 'background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; position: relative;';
            card.innerHTML = `<div class="output-name">${displayName}</div>`;
            return card;
        }

        // Use ToolStyleManager for consistent styling (same as TextFilesManager)
        const toolType = output.nodeType || 'manual';
        const sourceType = output.nodeId === 'manual' ? 'manual' : 'node-output';
        
        const card = this.toolStyleManager.createToolElement(toolType, sourceType, {
            text: displayName,
            className: 'output-card',
            compact: true,
            variant: 'default'
        });
        
        card.style.marginBottom = '8px';
        card.style.position = 'relative';
        card.dataset.systemName = output.systemName;
        card.title = displayName;

        // Add functionality based on execution mode
        if (!this.isPostExecution) {
            // Pre-execution: click to edit name
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editOutputName(card, output);
            });
        } else {
            // Post-execution: click to download, style in green
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadOutput(index);
            });
            card.style.cursor = 'pointer';
            card.title = `Click to download ${displayName}`;
            
            // Apply green styling ONLY for actual workflow execution outputs
            if (output.isWorkflowOutput === true) {
                card.style.backgroundColor = 'var(--color-success)';
                card.style.color = 'white';
                card.style.border = '2px solid var(--color-success)';
                
                // Update text color for better contrast
                const textElement = card.querySelector('.tool-text') || 
                                  card.querySelector('[class*="text"]') ||
                                  card.querySelector('div');
                if (textElement) {
                    textElement.style.color = 'white';
                }
            }
        }

        // Add delete button (same pattern as TextFilesManager)
        const deleteBtn = this.createDeleteButton(output);
        card.appendChild(deleteBtn);
        
        // Set up hover behavior for delete button
        card.addEventListener('mouseenter', () => {
            deleteBtn.style.display = 'flex';
        });
        
        card.addEventListener('mouseleave', () => {
            deleteBtn.style.display = 'none';
        });

        return card;
    }

    editOutputName(card, output) {
        const currentName = this.businessNames.get(output.systemName) || output.systemName;
        const newName = prompt('Enter new name:', currentName);
        
        if (newName && newName.trim() !== currentName) {
            const trimmedName = newName.trim();
            this.businessNames.set(output.systemName, trimmedName);
            
            // Update the card display - try multiple possible selectors
            const textElement = card.querySelector('.tool-text') || 
                              card.querySelector('[class*="text"]') ||
                              card.querySelector('div');
            if (textElement) {
                textElement.textContent = trimmedName;
            }
            card.title = trimmedName;
            
            // Emit event for other components to update their displays
            this.eventBus.emit('business-name-updated', {
                systemName: output.systemName,
                businessName: trimmedName
            });
            
            // Force re-render to ensure display is updated
            this.renderOutputs();
        }
    }


    downloadOutput(index) {
        const output = this.outputs[index];
        if (!output || !this.isPostExecution) return;

        const businessName = this.businessNames.get(output.systemName);
        const fileName = this.cleanDisplayName(businessName || output.systemName);
        
        // Only add extension if fileName doesn't already have one
        let finalFileName = fileName;
        if (!fileName.includes('.')) {
            const extension = this.getFileExtension(output.type);
            finalFileName = `${fileName}${extension}`;
        }
        
        this.downloadFile(output.content, finalFileName, output.type);
    }

    downloadAll() {
        if (this.outputs.length === 0 || !this.isPostExecution) {
            return;
        }
        
        // Double-check that we have results before allowing download
        const downloadHeader = document.getElementById('downloadResultsHeader');
        if (downloadHeader?.classList.contains('disabled')) {
            return;
        }

        // Download all outputs with staggered timing
        
        this.outputs.forEach((output, index) => {
            const businessName = this.businessNames.get(output.systemName);
            const fileName = this.cleanDisplayName(businessName || output.systemName);
            
            // Only add extension if fileName doesn't already have one
            let finalFileName = fileName;
            if (!fileName.includes('.')) {
                const extension = this.getFileExtension(output.type);
                finalFileName = `${fileName}${extension}`;
            }
            
            setTimeout(() => {
                this.downloadFile(output.content, finalFileName, output.type);
            }, index * 500); // Stagger downloads
        });
    }

    previewOutput(index) {
        const output = this.outputs[index];
        if (!output) return;

        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50;';
        modal.innerHTML = `
            <div style="background-color: white; border-radius: 8px; padding: 24px; max-width: 896px; width: 100%; margin: 0 16px; max-height: 384px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="font-size: 18px; font-weight: 600;">Preview: ${output.systemName}</h3>
                    <button id="closePreview" style="color: #6b7280; background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
                </div>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; max-height: 320px; overflow-y: auto;">
                    <pre style="white-space: pre-wrap; font-size: 14px;">${output.content}</pre>
                </div>
                <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
                    <button id="downloadFromPreview" style="background-color: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer;">
                        Download
                    </button>
                </div>
            </div>
        `;

        // Event listeners
        const closeBtn = modal.querySelector('#closePreview');
        const downloadBtn = modal.querySelector('#downloadFromPreview');

        closeBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        downloadBtn?.addEventListener('click', () => {
            this.downloadOutput(index);
            document.body.removeChild(modal);
        });

        document.body.appendChild(modal);
    }

    getOutputIcon(type) {
        const icons = {
            'text/plain': '📝',
            'application/pdf': '📄',
            'text/html': '🌐',
            'application/json': '📊',
            'text/csv': '📈',
            'audio/wav': '🎵',
            'image/png': '🖼️'
        };
        return icons[type] || '📋';
    }

    getTypeLabel(type) {
        const labels = {
            'text/plain': 'Text Document',
            'application/pdf': 'PDF Document',
            'text/html': 'HTML Document',
            'application/json': 'JSON Data',
            'text/csv': 'CSV Data',
            'audio/wav': 'Audio File',
            'image/png': 'Image File'
        };
        return labels[type] || 'Document';
    }

    getFileExtension(type) {
        const extensions = {
            'text/plain': '.txt',
            'application/pdf': '.pdf',
            'text/html': '.html',
            'application/json': '.json',
            'text/csv': '.csv',
            'audio/wav': '.wav',
            'image/png': '.png'
        };
        return extensions[type] || '.txt';
    }

    formatPreview(content) {
        if (!content) return 'No content available';
        
        // Limit preview to first 200 characters
        if (content.length > 200) {
            return content.substring(0, 200) + '...';
        }
        
        return content;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateDownloadButton() {
        const downloadResultsHeader = document.getElementById('downloadResultsHeader');
        
        // Only enable download if we have outputs AND are in post-execution mode
        const canDownload = this.outputs.length > 0 && this.isPostExecution;
        
        if (downloadResultsHeader) {
            if (canDownload) {
                downloadResultsHeader.classList.remove('disabled');
                downloadResultsHeader.style.cursor = 'pointer';
            } else {
                downloadResultsHeader.classList.add('disabled');
                downloadResultsHeader.style.cursor = 'not-allowed';
            }
        }
    }

    updateROIDisplay() {
        // Update the ROI calculation based on number of outputs and their complexity
        const complexity = this.outputs.length;
        const processingSteps = this.outputs.reduce((sum, output) => {
            // Estimate processing steps based on content length and type
            const contentComplexity = Math.ceil((output.content?.length || 0) / 1000);
            const typeComplexity = output.type === 'application/pdf' ? 2 : 1;
            return sum + (contentComplexity * typeComplexity);
        }, 0);

        // Conservative estimates
        const estimatedManualHours = Math.max(1, processingSteps * 0.5);
        const automatedMinutes = Math.max(5, complexity * 2);
        const hourlyRate = 50; // €50/hour
        
        const timeSaved = estimatedManualHours - (automatedMinutes / 60);
        const costSavings = Math.max(0, timeSaved * hourlyRate);

        // Update UI elements
        const manualTimeEl = document.getElementById('manualTime');
        const automatedTimeEl = document.getElementById('automatedTime');
        const timeSavingsEl = document.getElementById('timeSavings');

        if (manualTimeEl) {
            manualTimeEl.textContent = `${estimatedManualHours.toFixed(1)} hours`;
        }
        if (automatedTimeEl) {
            automatedTimeEl.textContent = `${automatedMinutes} minutes`;
        }
        if (timeSavingsEl) {
            timeSavingsEl.textContent = `€${Math.round(costSavings)}`;
        }
    }

    clear() {
        this.outputs = [];
        this.businessNames.clear();
        this.isPostExecution = false; // Reset to pre-execution mode
        this.renderOutputs();
        this.updateDownloadButton();
    }

    getOutputs() {
        return this.outputs;
    }

    getBusinessNames() {
        return Object.fromEntries(this.businessNames);
    }

    createDeleteButton(output) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-label-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete this output';
        deleteBtn.style.cssText = `
            position: absolute;
            top: 50%;
            right: 25px;
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

        // Handle delete click
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleDeleteClick(output);
        });

        return deleteBtn;
    }

    handleDeleteClick(output) {
        // Emit event to trigger cascading delete
        this.eventBus.emit('request-cascading-delete', {
            label: output.systemName,
            source: 'output-files'
        });
    }

    // Remove output directly (for pre-execution mode)
    removeOutput(index) {
        const output = this.outputs[index];
        if (output) {
            this.handleDeleteClick(output);
        }
    }

    // Method called by CascadingDeleteManager
    removeLabel(label) {
        this.outputs = this.outputs.filter(output => output.systemName !== label);
        this.renderOutputs();
        this.updateDownloadButton();
        console.log(`Removed output ${label} from OutputZone`);
    }

    hasLabel(label) {
        return this.outputs.some(output => output.systemName === label);
    }

    // Clean display name - remove source information
    cleanDisplayName(name) {
        if (!name) return '';
        // Remove patterns like "(from filename.txt)" or "From: filename.txt"
        return name.replace(/\s*\(from [^)]+\)\s*/gi, '')
                  .replace(/^From:\s*[^\n]*\n?/gim, '')
                  .replace(/\s*-\s*from\s+[^\s]+/gi, '')
                  .trim();
    }


    // Demo method for showing sample outputs
    showDemoResults() {
        const demoResults = [
            {
                systemName: 'audio_transcription_A.txt',
                content: 'Insurance call transcript discussing policy details. Easter egg found: Word 1 is "GIVE".',
                type: 'text/plain',
                size: 1024,
                nodeId: 'node_1'
            },
            {
                systemName: 'video_content_B.txt', 
                content: 'Video content analysis complete. Easter egg found: Word 2 is "BUDGET".',
                type: 'text/plain',
                size: 512,
                nodeId: 'node_2'
            },
            {
                systemName: 'image_text_C.txt',
                content: 'Image text extracted: Found number "4" prominently displayed.',
                type: 'text/plain',
                size: 256,
                nodeId: 'node_3'
            },
            {
                systemName: 'french_translation_D.txt',
                content: 'Translation: The French text contains "AI" as a key term.',
                type: 'text/plain',
                size: 128,
                nodeId: 'node_4'
            },
            {
                systemName: 'pdf_content_E.txt',
                content: 'PDF content extracted: Document contains policy information and easter egg word "ToolFlowBuilder".',
                type: 'text/plain',
                size: 2048,
                nodeId: 'node_5'
            },
            {
                systemName: 'easter_egg_analysis.txt',
                content: `Easter egg analysis complete:
Word 1: GIVE (from audio file)
Word 2: BUDGET (from video file)  
Word 3: 4 (from image file)
Word 4: AI (from French text)
Word 5: ToolFlowBuilder (from PDF)

Combined message: "GIVE BUDGET 4 AI ToolFlowBuilder"`,
                type: 'text/plain',
                size: 512,
                nodeId: 'node_6'
            }
        ];

        this.displayResults(demoResults);
    }
}

export { OutputZone };