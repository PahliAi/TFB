class WorkflowEngine {
    constructor(eventBus, openAIService) {
        this.eventBus = eventBus;
        this.openAIService = openAIService;
        this.currentWorkflow = null;
        this.executionResults = [];
        this.isExecuting = false;
        this.outputZone = null; // Reference to OutputZone for business names
    }

    setOutputZone(outputZone) {
        this.outputZone = outputZone;
    }

    setToolPalette(toolPalette) {
        this.toolPalette = toolPalette;
    }

    async generateWorkflow(files, userIntent = '') {
        try {
            this.eventBus.emit('status-update', 'Analyzing files and generating workflow...');

            // Default intent if none provided
            const intent = userIntent || this.generateDefaultIntent(files);

            // Use OpenAI to generate workflow
            const workflow = await this.openAIService.generateWorkflow(intent, files);
            
            this.currentWorkflow = workflow;
            return workflow;

        } catch (error) {
            console.error('Error generating workflow:', error);
            throw new Error(`Failed to generate workflow: ${error.message}`);
        }
    }

    async generateWorkflowFromText(text, files) {
        try {
            this.eventBus.emit('status-update', 'Generating workflow from your description...');

            const workflow = await this.openAIService.generateWorkflow(text, files);
            this.currentWorkflow = workflow;
            return workflow;

        } catch (error) {
            console.error('Error generating workflow from text:', error);
            throw new Error(`Failed to generate workflow: ${error.message}`);
        }
    }

    async describeWorkflow(workflow) {
        try {
            this.eventBus.emit('status-update', 'Analyzing workflow to generate description...');
            
            // Simple workflow description for MVP
            if (!workflow.nodes || workflow.nodes.length === 0) {
                return "No workflow steps defined yet.";
            }
            
            const steps = workflow.nodes.map((node, index) => {
                const toolType = node.type || 'process';
                const toolNames = {
                    'audio2text': 'Convert audio to text',
                    'video2audio': 'Extract audio from video', 
                    'pdf2text': 'Extract text from PDF',
                    'webscraper': 'Scrape text from websites',
                    'summarizer': 'Summarize content',
                    'translator': 'Translate text',
                    'analyzer': 'Analyze content'
                };
                
                return `${index + 1}. ${toolNames[toolType] || 'Process files'}`;
            }).join(', then ');
            
            return `Workflow: ${steps}`;
            
        } catch (error) {
            console.error('Error describing workflow:', error);
            return "Unable to describe workflow at this time.";
        }
    }

    generateDefaultIntent(files) {
        const audioFiles = files.filter(f => f.type.startsWith('audio/')).length;
        const videoFiles = files.filter(f => f.type.startsWith('video/')).length;
        const pdfFiles = files.filter(f => f.type === 'application/pdf').length;
        const imageFiles = files.filter(f => f.type.startsWith('image/')).length;
        const textFiles = files.filter(f => f.type.startsWith('text/')).length;

        let intent = 'Process the uploaded files: ';
        
        const fileTypes = [];
        if (audioFiles > 0) fileTypes.push(`${audioFiles} audio file${audioFiles > 1 ? 's' : ''}`);
        if (videoFiles > 0) fileTypes.push(`${videoFiles} video file${videoFiles > 1 ? 's' : ''}`);
        if (pdfFiles > 0) fileTypes.push(`${pdfFiles} PDF document${pdfFiles > 1 ? 's' : ''}`);
        if (imageFiles > 0) fileTypes.push(`${imageFiles} image${imageFiles > 1 ? 's' : ''}`);
        if (textFiles > 0) fileTypes.push(`${textFiles} text file${textFiles > 1 ? 's' : ''}`);

        intent += fileTypes.join(', ');
        intent += '. Extract information, analyze content, and create a comprehensive summary report.';

        return intent;
    }

    async executeWorkflow(workflow = null) {
        const workflowToExecute = workflow || this.currentWorkflow;
        if (!workflowToExecute) {
            throw new Error('No workflow to execute');
        }

        if (this.isExecuting) {
            throw new Error('Workflow execution already in progress');
        }

        try {
            this.isExecuting = true;
            this.executionResults = [];
            
            this.eventBus.emit('status-update', 'Executing workflow...');

            // Sort nodes by dependencies (topological sort)
            const sortedNodes = this.topologicalSort(workflowToExecute);
            
            // Execute nodes in order
            for (const node of sortedNodes) {
                await this.executeNode(node, workflowToExecute);
            }

            this.eventBus.emit('workflow-executed', this.executionResults);
            return this.executionResults;

        } catch (error) {
            console.error('Error executing workflow:', error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    topologicalSort(workflow) {
        const nodes = [...workflow.nodes];
        const connections = workflow.connections || [];
        const sorted = [];
        const visited = new Set();
        const temp = new Set();

        const visit = (nodeId) => {
            if (temp.has(nodeId)) {
                throw new Error('Circular dependency detected in workflow');
            }
            if (visited.has(nodeId)) return;

            temp.add(nodeId);

            // Find all nodes that depend on this one
            const dependents = connections
                .filter(conn => conn.from === nodeId)
                .map(conn => conn.to);

            dependents.forEach(depId => visit(depId));

            temp.delete(nodeId);
            visited.add(nodeId);
            
            const node = nodes.find(n => n.id === nodeId);
            if (node) sorted.unshift(node);
        };

        // Start with nodes that have no dependencies
        const nodesToVisit = nodes.filter(node => {
            return !connections.some(conn => conn.to === node.id);
        });

        nodesToVisit.forEach(node => visit(node.id));

        // Handle any remaining nodes (shouldn't happen with valid workflow)
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                visit(node.id);
            }
        });

        return sorted;
    }

    async executeNode(node, workflow) {
        try {
            this.eventBus.emit('status-update', `Processing ${node.type}...`);

            // Get input data for this node
            const inputData = await this.getNodeInputData(node, workflow);
            
            // Execute the node
            const result = await this.processNodeData(node, inputData);
            
            // Store result for use by dependent nodes
            this.executionResults.push({
                nodeId: node.id,
                nodeType: node.type,
                systemName: result.fileName,
                content: result.result,
                type: this.getOutputContentType(node.type),
                size: result.result?.length || 0,
                success: result.success,
                executedAt: new Date().toISOString()
            });

            return result;

        } catch (error) {
            console.error(`Error executing node ${node.id}:`, error);
            
            // Add error result
            this.executionResults.push({
                nodeId: node.id,
                nodeType: node.type,
                systemName: `${node.type}_error.txt`,
                content: `Error: ${error.message}`,
                type: 'text/plain',
                size: error.message?.length || 0,
                success: false,
                error: error.message,
                executedAt: new Date().toISOString()
            });

            throw error;
        }
    }

    async getNodeInputData(node, workflow) {
        const inputData = [];

        // Handle file inputs (from uploaded files)
        if (node.fileInputs && node.fileInputs.length > 0) {
            node.fileInputs.forEach(fileInput => {
                inputData.push({
                    source: 'file',
                    name: fileInput.name,
                    type: fileInput.type,
                    label: fileInput.label,
                    content: this.getMockFileContent(fileInput)
                });
            });
        }

        // Handle node inputs (from other nodes)
        const connections = workflow.connections || [];
        const incomingConnections = connections.filter(conn => conn.to === node.id);
        
        for (const connection of incomingConnections) {
            const sourceResult = this.executionResults.find(result => result.nodeId === connection.from);
            if (sourceResult) {
                inputData.push({
                    source: 'node',
                    name: connection.fileName,
                    type: sourceResult.type,
                    content: sourceResult.content
                });
            }
        }

        return inputData;
    }

    getMockFileContent(fileInput) {
        // Mock file content for demo purposes
        // In production, this would read actual file content
        const mockContent = {
            'audio': `[Audio content from ${fileInput.name}] - Mock transcription for demo`,
            'video': `[Video content from ${fileInput.name}] - Mock video analysis for demo`,
            'pdf': `[PDF content from ${fileInput.name}] - Mock PDF text extraction for demo`,
            'image': `[Image content from ${fileInput.name}] - Mock OCR text extraction for demo`,
            'text': `[Text content from ${fileInput.name}] - Mock text processing for demo`
        };

        const category = this.getFileCategory(fileInput.type);
        return mockContent[category] || `Mock content from ${fileInput.name}`;
    }

    getFileCategory(type) {
        if (type.startsWith('audio/')) return 'audio';
        if (type.startsWith('video/')) return 'video';
        if (type === 'application/pdf') return 'pdf';
        if (type.startsWith('image/')) return 'image';
        if (type.startsWith('text/')) return 'text';
        return 'unknown';
    }

    async processNodeData(node, inputData) {
        // Combine all input content
        const combinedContent = inputData.map(input => input.content).join('\n\n');
        
        // Create a mock file object for processing
        const mockFile = {
            name: node.outputLabels[0] || `${node.type}_output.txt`,
            content: combinedContent
        };

        // Use OpenAI service to process the content
        const result = await this.openAIService.processFile(
            mockFile,
            node.type,
            node.customPrompt
        );

        return result;
    }

    getOutputContentType(nodeType) {
        const contentTypes = {
            'audio2text': 'text/plain',
            'video2audio': 'audio/wav',
            'pdf2text': 'text/plain',
            'image2text': 'text/plain',
            'webscraper': 'text/plain',
            'summarizer': 'text/plain',
            'translator': 'text/plain',
            'analyzer': 'text/plain',
            'text2pdf': 'application/pdf',
            'text2template': 'text/html'
        };

        return contentTypes[nodeType] || 'text/plain';
    }

    // Demo method for easter egg scenario
    async executeDemoEasterEggWorkflow(files) {
        try {
            // Load the demo execution plan
            const demoJSON = await this.loadDemoExecutionJSON();
            
            // Show progress modal based on demo JSON
            this.showProgressModal(demoJSON.actions);
            
            // Execute each action with progress updates
            const results = [];
            for (let i = 0; i < demoJSON.actions.length; i++) {
                const action = demoJSON.actions[i];
                
                // Update progress to show current action
                this.updateProgressAction(i, 'processing', `Processing ${action.toolType}...`);
                
                // Simulate processing time with realistic delays
                await this.simulateProcessingDelay(action.toolType);
                
                // Get mock result for this action (now async to load real files)
                const result = await this.getMockActionResult(action, files);
                results.push(result);
                
                // Update progress to completed
                this.updateProgressAction(i, 'completed', `✅ ${action.outputFile} ready`);
                
                // Route output files to correct UI panels
                this.routeOutput(action, result);
            }
            
            // Show final results modal
            this.showResultsModal(results);
            
            return results;

        } catch (error) {
            console.error('Error in easter egg demo:', error);
            this.showErrorModal(error.message);
            throw error;
        }
    }

    async loadDemoExecutionJSON() {
        try {
            // Load from demo/Output folder (works on both local and GitHub Pages)
            const jsonPath = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? './demo/Output/demo-execution.json' 
                : './demo/Output/demo-execution.json'; // GitHub Pages path (corrected case)
                
            const response = await fetch(jsonPath);
            return await response.json();
        } catch (error) {
            console.error('Could not load demo execution JSON:', error);
            // Fallback to hardcoded demo actions
            return this.getFallbackDemoActions();
        }
    }

    createEasterEggWorkflow(files) {
        const nodes = [];
        const connections = [];
        let yPosition = 50;

        // Create processing nodes for each file type
        files.forEach((file, index) => {
            let nodeType = 'analyzer';
            
            if (file.type.startsWith('audio/')) {
                nodeType = 'audio2text';
            } else if (file.type.startsWith('video/')) {
                nodeType = 'video2audio';
            } else if (file.type === 'application/pdf') {
                nodeType = 'pdf2text';
            } else if (file.type.startsWith('image/')) {
                nodeType = 'image2text';
            }

            const node = {
                id: `node_${index + 1}`,
                type: nodeType,
                position: { x: 100, y: yPosition },
                inputs: [file.label],
                fileInputs: [{
                    id: file.id,
                    label: file.label,
                    name: file.name,
                    type: file.type
                }],
                params: {},
                customPrompt: '',
                outputs: [`${file.name.split('.')[0]}_${nodeType}.txt`]
            };

            nodes.push(node);
            yPosition += 80;
        });

        // Add final analyzer node for easter egg detection
        const finalAnalyzer = {
            id: 'final_analyzer',
            type: 'analyzer',
            position: { x: 400, y: 200 },
            inputs: nodes.map(n => n.outputLabels[0]),
            params: {},
            customPrompt: 'Find easter egg words in each file and extract them with their sequence numbers. Combine them in the correct order to reveal the hidden message.',
            outputs: ['easter_egg_analysis.txt']
        };

        nodes.push(finalAnalyzer);

        // Create connections
        nodes.slice(0, -1).forEach(node => {
            connections.push({
                id: `conn_${node.id}_to_final`,
                from: node.id,
                to: 'final_analyzer',
                fileName: node.outputLabels[0]
            });
        });

        return {
            id: 'easter_egg_workflow',
            name: 'Easter Egg Demo Workflow',
            files: files,
            nodes: nodes,
            connections: connections,
            metadata: {
                generated: true,
                demo: true,
                easterEgg: true
            }
        };
    }

    getCurrentWorkflow() {
        return this.currentWorkflow;
    }

    getExecutionResults() {
        return this.executionResults;
    }

    clearResults() {
        this.executionResults = [];
        this.currentWorkflow = null;
    }

    isWorkflowExecuting() {
        return this.isExecuting;
    }

    // Progress Modal Methods
    showProgressModal(actions) {
        const progressContent = this.createProgressContent(actions);
        
        // Import UIUtils dynamically
        import('../utils/UIUtils.js').then(({ UIUtils }) => {
            this.progressModal = UIUtils.createModal(
                '🔄 Processing Workflow',
                progressContent,
                [] // No buttons during processing
            );
        });
    }

    createProgressContent(actions) {
        const actionsList = actions.map((action, index) => {
            const description = this.getActionDescription(action);
            return `
                <div id="progress-action-${index}" class="progress-item" style="
                    display: flex; 
                    align-items: center; 
                    padding: 8px 0; 
                    border-bottom: 1px solid #e5e7eb;
                ">
                    <span id="progress-icon-${index}" style="
                        margin-right: 12px; 
                        font-size: 16px;
                        min-width: 20px;
                    ">⏳</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 500; font-size: 14px;">${description}</div>
                        <div id="progress-status-${index}" style="
                            font-size: 12px; 
                            color: #6b7280;
                            margin-top: 2px;
                        ">Waiting...</div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="max-height: 400px; overflow-y: auto;">
                <p style="margin-bottom: 16px; color: #6b7280;">
                    Processing workflow actions. Please wait while each step completes:
                </p>
                <div id="progress-list">
                    ${actionsList}
                </div>
            </div>
        `;
    }

    getActionDescription(action) {
        const descriptions = {
            'audio2text': `🎵 Transcribe ${action.inputFiles[0]} to text`,
            'video2text': `🎬 Extract audio from ${action.inputFiles[0]} and transcribe`,
            'analyzer': `🔍 Analyze ${action.inputFiles[0]}`,
            'pdf2text': `📄 Extract text from ${action.inputFiles[0]}`,
            'image2text': `🖼️ Extract text from ${action.inputFiles[0]}`,
            'join': `🔗 Join ${action.inputFiles.length} files together`,
            'text2pdf': `📋 Convert ${action.inputFiles[0]} to PDF`
        };
        
        return descriptions[action.toolType] || `⚙️ Process with ${action.toolType}`;
    }

    updateProgressAction(actionIndex, status, message) {
        const iconElement = document.getElementById(`progress-icon-${actionIndex}`);
        const statusElement = document.getElementById(`progress-status-${actionIndex}`);
        
        if (iconElement && statusElement) {
            const icons = {
                'waiting': '⏳',
                'processing': '🔄',
                'completed': '✅',
                'error': '❌'
            };
            
            iconElement.textContent = icons[status] || '⏳';
            statusElement.textContent = message;
            statusElement.style.color = status === 'error' ? '#dc2626' : '#6b7280';
        }
    }

    showResultsModal(results) {
        const successCount = results.filter(r => r.success !== false).length;
        const totalCount = results.length;
        
        // Remove progress modal first
        if (this.progressModal) {
            import('../utils/UIUtils.js').then(({ UIUtils }) => {
                UIUtils.removeModal(this.progressModal);
                
                // Show results modal
                UIUtils.createModal(
                    '✅ Workflow Execution Complete',
                    `
                        <div style="margin-bottom: 20px;">
                            <p style="font-size: 16px; font-weight: 600; color: #059669; margin-bottom: 12px;">
                                Workflow executed successfully
                            </p>
                            <p style="color: #374151; margin-bottom: 8px;">
                                <strong>Status:</strong> ${successCount} of ${totalCount} actions completed with no errors
                            </p>
                            <p style="color: #374151;">
                                <strong>Output file:</strong> ABCDE-joi-anl.pdf (generated)
                            </p>
                        </div>
                        
                        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                            <p style="margin-bottom: 8px; color: #374151;">
                                Your processed file is available for download in the <strong>Output Files</strong> section.
                            </p>
                            <p style="color: #059669; font-weight: 500;">
                                Click the <strong>Download</strong> button to retrieve your files.
                            </p>
                        </div>
                        
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                        
                        <div style="font-size: 14px; color: #6b7280;">
                            <p style="margin-bottom: 8px;"><strong>Options:</strong></p>
                            <p style="margin-bottom: 4px;">• <strong>Clear Canvas</strong> - Create new workflow with current files</p>
                            <p>• <strong>Clear Input Files</strong> - Upload different documents</p>
                        </div>
                    `,
                    [
                        {
                            text: 'Close',
                            action: 'close',
                            className: 'background-color: #059669; color: white; font-weight: 500;',
                            handler: (e, modal) => UIUtils.removeModal(modal)
                        }
                    ]
                );
            });
        }
    }

    showErrorModal(errorMessage) {
        if (this.progressModal) {
            import('../utils/UIUtils.js').then(({ UIUtils }) => {
                UIUtils.removeModal(this.progressModal);
                
                UIUtils.createModal(
                    '❌ Workflow Execution Error',
                    `
                        <p>An error occurred during workflow execution:</p>
                        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin: 12px 0;">
                            <code style="color: #dc2626;">${errorMessage}</code>
                        </div>
                        <p>Please check your workflow configuration and try again.</p>
                    `,
                    [
                        {
                            text: 'OK',
                            action: 'close',
                            className: 'background-color: #6b7280; color: white;',
                            handler: (e, modal) => UIUtils.removeModal(modal)
                        }
                    ]
                );
            });
        }
    }

    async simulateProcessingDelay(toolType) {
        // Realistic processing delays for different tool types
        const delays = {
            'audio2text': 2000,
            'video2text': 2500, 
            'pdf2text': 1500,
            'image2text': 1800,
            'analyzer': 2200,
            'join': 800,
            'text2pdf': 1200
        };
        
        const delay = delays[toolType] || 1500;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    async getMockActionResult(action, files) {
        // For easter egg demo, load actual demo output files
        if (action.outputRequired && action.outputFile === 'ABCDE-joi-anl.pdf') {
            try {
                // Try to load the actual demo PDF
                const pdfPath = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? './demo/Output/ABCDE-joi-anl.pdf' 
                    : './demo/Output/ABCDE-joi-anl.pdf'; // GitHub Pages path (corrected case)
                
                const response = await fetch(pdfPath);
                if (response.ok) {
                    const blob = await response.blob();
                    return {
                        success: true,
                        fileName: action.outputFile,
                        toolType: action.toolType,
                        content: blob,
                        type: 'application/pdf',
                        size: blob.size,
                        executedAt: new Date().toISOString(),
                        isRealFile: true
                    };
                }
            } catch (error) {
                console.log('Could not load demo PDF, using mock content:', error);
            }
        }
        
        // For intermediate files, try to load demo text files
        if (action.outputFile.endsWith('.txt')) {
            try {
                const basePath = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? './demo/Output/' 
                    : './demo/Output/'; // GitHub Pages path (corrected case)
                
                const response = await fetch(`${basePath}${action.outputFile}`);
                if (response.ok) {
                    const text = await response.text();
                    return {
                        success: true,
                        fileName: action.outputFile,
                        toolType: action.toolType,
                        content: text,
                        type: 'text/plain',
                        size: text.length,
                        executedAt: new Date().toISOString(),
                        isRealFile: true
                    };
                }
            } catch (error) {
                console.log(`Could not load demo file ${action.outputFile}, using mock:`, error);
            }
        }
        
        // Fallback to mock content
        return {
            success: true,
            fileName: action.outputFile,
            toolType: action.toolType,
            content: `Mock result for ${action.toolType} processing of ${action.inputFiles?.join(', ')}`,
            type: 'text/plain',
            size: 1024,
            executedAt: new Date().toISOString(),
            isRealFile: false
        };
    }

    routeOutput(action, result) {
        if (action.outputRequired) {
            // Get the business name from OutputZone if available
            let businessName = action.outputFile;
            if (this.outputZone) {
                const businessNames = this.outputZone.getBusinessNames();
                businessName = businessNames[action.outputFile] || action.outputFile;
            }
            
            // Final deliverable -> Output Zone
            this.eventBus.emit('output-added', {
                id: `output_${Date.now()}`,
                systemName: action.outputFile,
                businessName: businessName,
                label: businessName, // Use business name for label too
                content: result.content,
                type: result.type || 'text/plain',
                size: result.size || 0,
                sourceNodeId: 'demo',
                nodeType: action.toolType,
                success: result.success !== false,
                isWorkflowOutput: true // 100% definitive marker for actual workflow execution outputs
            });
        } else {
            // Temporary file -> Text Files Manager (optional - not needed for demo)
            // this.eventBus.emit('add-text-file', {...});
        }
    }

    getFallbackDemoActions() {
        return {
            "systemPrompt": "Easter egg demo fallback",
            "fileMapping": {
                "A": "ForMyOwnPart.m4a",
                "B": "AllianzArena.mp4", 
                "C": "AI_at_Allianz.txt",
                "D": "DORA_rules_NL.pdf",
                "E": "ToolFlow.png"
            },
            "actions": [
                {"toolType": "audio2text", "inputFiles": ["A"], "outputFile": "A.txt", "outputRequired": false},
                {"toolType": "video2text", "inputFiles": ["B"], "outputFile": "B.txt", "outputRequired": false},
                {"toolType": "analyzer", "inputFiles": ["C"], "outputFile": "C.txt", "outputRequired": false},
                {"toolType": "pdf2text", "inputFiles": ["D"], "outputFile": "D.txt", "outputRequired": false},
                {"toolType": "image2text", "inputFiles": ["E"], "outputFile": "E.txt", "outputRequired": false},
                {"toolType": "join", "inputFiles": ["A.txt", "B.txt", "C.txt", "D.txt", "E.txt"], "outputFile": "ABCDE-joi.txt", "outputRequired": false},
                {"toolType": "analyzer", "inputFiles": ["ABCDE-joi.txt"], "outputFile": "ABCDE-joi-anl.txt", "outputRequired": false},
                {"toolType": "text2pdf", "inputFiles": ["ABCDE-joi-anl.txt"], "outputFile": "ABCDE-joi-anl.pdf", "outputRequired": true}
            ]
        };
    }

    /**
     * Convert Visual JSON (V4 export format) to Action JSON (execution format)
     * 
     * Visual JSON: Complete workflow state for export/import (json1)
     * Action JSON: Simple execution steps for LLM API & textual mode (json2)
     * 
     * Risk Level: ZERO - New method, no existing code modification
     */
    convertVisualToActionJSON(visualWorkflow, files) {
        // Handle V4 Visual JSON format (from exportWorkflow)
        if (!visualWorkflow || !visualWorkflow.actions || visualWorkflow.actions.length === 0) {
            return {
                systemPrompt: "Empty workflow",
                fileMapping: {},
                actions: []
            };
        }

        // Create file mapping (A, B, C... to actual filenames)
        const fileMapping = files.reduce((mapping, file, index) => {
            const label = String.fromCharCode(65 + index); // A, B, C...
            mapping[label] = file.name;
            return mapping;
        }, {});

        // First, generate automatic conversion actions for InputFiles → TextFiles
        const autoConversionActions = this.generateAutoConversionActions(visualWorkflow, files);
        
        // Then, get manual workflow nodes
        const nodes = visualWorkflow.actions;
        const manualActions = nodes.map((node, index) => ({
            toolType: node.type,
            toolSystemPrompt: this.getToolSystemPrompt(node.type),
            toolUserPrompt: node.parameters?.userPrompt || "",
            inputFiles: this.mapVisualInputsToFileLabels(node, files),
            outputFile: node.outputs && node.outputs[0] ? node.outputs[0] : this.generateOutputLabel(node, index),
            outputRequired: this.isInOutputFilesPanel(node, visualWorkflow)
        }));

        return {
            systemPrompt: visualWorkflow.metadata?.description || "Visual workflow converted to execution steps",
            fileMapping: fileMapping,
            actions: [...autoConversionActions, ...manualActions]
        };
    }

    /**
     * Generate automatic conversion actions for InputFiles → TextFiles
     * This creates the missing steps that convert uploaded files to text before manual nodes
     */
    generateAutoConversionActions(visualWorkflow, files) {
        const autoActions = [];
        const textFiles = visualWorkflow.textFiles || [];
        
        // For each TextFile, check if we need to create a conversion action
        textFiles.forEach(textFile => {
            // Find the corresponding InputFile
            const inputFile = files.find(f => f.label === textFile.sourceFile);
            if (!inputFile) return;
            
            // Determine conversion tool based on file type
            const conversionTool = this.getConversionToolForFile(inputFile);
            if (!conversionTool) return; // Already text, no conversion needed
            
            autoActions.push({
                toolType: conversionTool,
                toolSystemPrompt: this.getToolSystemPrompt(conversionTool),
                toolUserPrompt: "",
                inputFiles: [inputFile.label], // A, B, C...
                outputFile: textFile.label,    // A.txt, B.txt...
                outputRequired: false
            });
        });
        
        return autoActions;
    }

    /**
     * Get the appropriate conversion tool for a file type
     */
    getConversionToolForFile(file) {
        const type = file.type.toLowerCase();
        const name = file.name.toLowerCase();
        
        // Audio files
        if (type.startsWith('audio/') || name.endsWith('.m4a') || name.endsWith('.mp3') || name.endsWith('.wav')) {
            return 'audio2text';
        }
        
        // Video files  
        if (type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
            return 'video2text';
        }
        
        // PDF files
        if (type === 'application/pdf' || name.endsWith('.pdf')) {
            return 'pdf2text';
        }
        
        // Image files
        if (type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
            return 'image2text';
        }
        
        // Already text files - no conversion needed
        if (type.startsWith('text/') || name.endsWith('.txt')) {
            return null;
        }
        
        return null; // Unknown type, no conversion
    }

    /**
     * Get system prompt for a tool type
     * Risk Level: ZERO - New helper method
     */
    getToolSystemPrompt(toolType) {
        // Try to get from ToolPalette if available
        if (this.toolPalette) {
            const toolDef = this.toolPalette.findToolById(toolType);
            if (toolDef && toolDef.systemPrompt) {
                return toolDef.systemPrompt;
            }
        }
        
        // Fallback to hardcoded system prompts
        const systemPrompts = {
            'audio2text': 'Transcribe audio content to accurate text',
            'video2text': 'Extract audio from video and transcribe to text', 
            'pdf2text': 'Extract all text content from PDF documents accurately',
            'image2text': 'Extract all visible text from images using OCR technology',
            'analyzer': 'Analyze text content for patterns, keywords, and insights',
            'join': 'Combine multiple text files into a single unified document',
            'text2pdf': 'Format text content into professional PDF documents with proper structure'
        };
        
        return systemPrompts[toolType] || `Process ${toolType} content`;
    }

    /**
     * Map V4 visual node inputs to file labels (A, B, C...)
     * Risk Level: ZERO - New helper method
     */
    mapVisualInputsToFileLabels(node, files) {
        // V4 format stores inputs as array of labels/file references
        const inputs = node.inputs || node.inputLabels || [];
        
        // Map file names to A, B, C labels
        return inputs.map(input => {
            // If input is already a label (A, B, C), return it
            if (input.length <= 3 && input.match(/^[A-Z]+$/)) {
                return input;
            }
            
            // Otherwise, find the file index and convert to label
            const fileIndex = files.findIndex(f => f.name === input);
            return fileIndex >= 0 ? String.fromCharCode(65 + fileIndex) : input;
        });
    }

    /**
     * Generate output file label for a node
     * Risk Level: ZERO - New helper method
     */
    generateOutputLabel(node, index) {
        if (node.outputLabels && node.outputLabels.length > 0) {
            return node.outputLabels[0];
        }
        
        // Generate default output name based on tool type
        const extensions = {
            'audio2text': '.txt',
            'video2text': '.txt',
            'pdf2text': '.txt', 
            'image2text': '.txt',
            'analyzer': '.txt',
            'join': '.txt',
            'text2pdf': '.pdf'
        };
        
        const ext = extensions[node.type] || '.txt';
        return `${node.type}_output_${index + 1}${ext}`;
    }

    /**
     * Check if node output is in the OutputFiles panel (the definitive way to know if outputRequired: true)
     * Risk Level: ZERO - New helper method
     */
    isInOutputFilesPanel(node, visualWorkflow) {
        const nodeOutputFile = node.outputs && node.outputs[0];
        if (!nodeOutputFile) return false;
        
        // Check if this output file exists in the outputFiles panel
        const outputFiles = visualWorkflow.outputFiles || [];
        return outputFiles.some(outputFile => 
            outputFile.systemName === nodeOutputFile ||
            outputFile.filename === nodeOutputFile
        );
    }

    /**
     * Determine if node output is required (final deliverable) - Legacy method
     * Risk Level: ZERO - New helper method
     */
    isOutputRequired(node, allNodes) {
        // In V4 format, check if this node's output is used as input by other nodes
        // If no other nodes use this output, it's likely a final deliverable
        const nodeOutput = node.outputs && node.outputs[0];
        if (!nodeOutput) return false;
        
        const isUsedByOtherNode = allNodes.some(otherNode => 
            otherNode.id !== node.id && 
            (otherNode.inputs || []).includes(nodeOutput)
        );
        
        return !isUsedByOtherNode; // Final deliverable if no other node uses it
    }
}

export { WorkflowEngine };