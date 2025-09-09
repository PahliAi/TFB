// File naming utility for automatic lineage tracking
class FileNaming {
    constructor() {
        // Tool suffix mapping for automatic naming
        this.toolSuffixes = {
            'audio2text': '.txt',
            'video2audio': '.wav', 
            'pdf2text': '.txt',
            'summarizer': '-sum',
            'translator': '', // Dynamic based on language (e.g., -en, -nl)
            'analyzer': '-analysis',
            'text2pdf': '.pdf',
            'text2template': '_filled'
        };
    }

    // Generate output filename based on input and tool
    generateOutputName(inputFile, toolType, params = {}) {
        let baseName = this.getBaseName(inputFile);
        let suffix = this.getToolSuffix(toolType, params);
        
        return baseName + suffix;
    }

    // Generate combined output name from multiple inputs  
    generateCombinedName(inputFiles, toolType, params = {}) {
        const labels = inputFiles.map(file => this.getFileLabel(file)).sort();
        const baseName = labels.join('');
        const suffix = this.getToolSuffix(toolType, params);
        
        return baseName + suffix + '.txt';
    }

    // Get base name preserving lineage (A.wav → A.wav)
    getBaseName(filename) {
        if (typeof filename === 'object' && filename.name) {
            filename = filename.name;
        }
        
        // If already has a label (A.wav.txt), keep full lineage
        if (this.hasFileLabel(filename)) {
            return filename.split('.').slice(0, -1).join('.');
        }
        
        // For original files, use label + original name
        return filename;
    }

    // Get file label from filename (A.wav → A)
    getFileLabel(filename) {
        if (typeof filename === 'object') {
            return filename.label || 'X';
        }
        
        const match = filename.match(/^([A-Z])/);
        return match ? match[1] : 'X';
    }

    // Check if filename has a file label
    hasFileLabel(filename) {
        return /^[A-Z]/.test(filename);
    }

    // Get appropriate suffix for tool type
    getToolSuffix(toolType, params = {}) {
        switch (toolType) {
            case 'translator':
                const lang = params.language || 'en';
                const langCodes = {
                    'english': 'eng',
                    'dutch': 'nl', 
                    'french': 'fr',
                    'german': 'de',
                    'spanish': 'es'
                };
                return '-' + (langCodes[lang.toLowerCase()] || lang.substr(0, 3));
                
            default:
                return this.toolSuffixes[toolType] || '';
        }
    }

    // Extract language from natural language prompt
    extractLanguageFromPrompt(prompt) {
        const langPattern = /translate.+?to\s+(\w+)/i;
        const match = prompt.match(langPattern);
        return match ? match[1] : 'en';
    }

    // Generate workflow naming schema
    generateWorkflowNaming(workflow, files) {
        const namingMap = new Map();
        
        // Map original files to labels
        files.forEach(file => {
            namingMap.set(file.id, {
                originalName: file.name,
                currentName: file.label ? `${file.label}.${file.name}` : file.name,
                label: file.label
            });
        });

        // Process each node in the workflow
        workflow.nodes.forEach(node => {
            const inputNames = node.inputLabels.map(inputId => {
                const mapped = namingMap.get(inputId);
                return mapped ? mapped.currentName : inputId;
            });

            let outputName;
            if (inputNames.length === 1) {
                // Single input → single output
                outputName = this.generateOutputName(inputNames[0], node.type, node.params);
            } else {
                // Multiple inputs → combined output  
                outputName = this.generateCombinedName(inputNames, node.type, node.params);
            }

            // Update naming map with output
            namingMap.set(node.id, {
                originalName: outputName,
                currentName: outputName,
                label: this.getFileLabel(outputName)
            });
        });

        return namingMap;
    }

    // Convert technical names to business names
    convertToBusinessName(technicalName, context = '') {
        // Remove file extensions for display
        let baseName = technicalName.replace(/\.[^.]+$/, '');
        
        // Convert suffixes to readable names
        baseName = baseName
            .replace(/-sum$/, '_Summary')
            .replace(/-eng$/, '_English') 
            .replace(/-nl$/, '_Dutch')
            .replace(/-fr$/, '_French')
            .replace(/-analysis$/, '_Analysis')
            .replace(/_filled$/, '_Completed');
            
        // Add context if provided
        if (context) {
            baseName = `${context}_${baseName}`;
        }
        
        return baseName;
    }

    // Validate naming consistency
    validateNaming(workflow) {
        const warnings = [];
        const errors = [];
        
        workflow.nodes.forEach(node => {
            // Check for valid input references
            node.inputLabels.forEach(input => {
                if (!this.hasFileLabel(input) && !input.startsWith('file_')) {
                    warnings.push(`Node ${node.id}: Input "${input}" may not be properly labeled`);
                }
            });
            
            // Check for naming conflicts
            const outputName = node.outputLabels?.[0];
            if (outputName && workflow.nodes.some(otherNode => 
                otherNode.id !== node.id && otherNode.outputLabels?.[0] === outputName)) {
                errors.push(`Naming conflict: "${outputName}" is generated by multiple nodes`);
            }
        });
        
        return { warnings, errors };
    }
}

export { FileNaming };