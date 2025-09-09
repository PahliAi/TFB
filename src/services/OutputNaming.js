// Label-Based Output Naming System
// Generates smart output names based on input labels and tool types

class OutputNaming {
    constructor() {
        this.conflictCounter = new Map(); // Track naming conflicts
        this.eventBus = null;
    }

    init(eventBus) {
        this.eventBus = eventBus;
    }

    // MAIN NAMING METHOD
    generateOutputLabels(inputLabels, toolType, params = {}) {
        const nodeCategory = this.getNodeCategory(toolType);
        
        switch (nodeCategory) {
            case 'conversion':
                return this.generateConversionOutputs(inputLabels, toolType);
            case 'processing':
                return this.generateProcessingOutput(inputLabels, toolType, params);
            case 'template':
                return this.generateTemplateOutput(inputLabels, toolType, params);
            default:
                return this.generateDefaultOutput(inputLabels, toolType);
        }
    }

    // NODE CATEGORIZATION
    getNodeCategory(toolType) {
        const categories = {
            conversion: ['pdf2text', 'audio2text', 'video2audio', 'image2text'],
            processing: ['summarizer', 'analyzer', 'translator'],
            template: ['text2pdf', 'text2template']
        };

        for (const [category, types] of Object.entries(categories)) {
            if (types.includes(toolType)) return category;
        }
        
        return 'unknown';
    }

    // 1:1 CONVERSION TOOLS (A.txt, B.txt, C.txt)
    generateConversionOutputs(inputLabels, toolType) {
        const extension = this.getOutputExtension(toolType);
        return inputLabels.map(label => `${label}${extension}`);
    }

    // MANY:1 PROCESSING TOOLS (ABC-sum.txt)
    generateProcessingOutput(inputLabels, toolType, params = {}) {
        const sortedLabels = [...inputLabels].sort();
        const suffix = this.getToolSuffix(toolType, params);
        const baseName = `${sortedLabels.join('')}${suffix}`;
        
        return [this.resolveNamingConflict(baseName, '.txt')];
    }

    // TEMPLATE TOOLS (ABC_template.pdf)
    generateTemplateOutput(inputLabels, toolType, params = {}) {
        const sortedLabels = [...inputLabels].sort();
        const templateName = params.templateName || 'template';
        const extension = this.getOutputExtension(toolType);
        const baseName = `${sortedLabels.join('')}_${templateName}`;
        
        return [this.resolveNamingConflict(baseName, extension)];
    }

    // DEFAULT OUTPUT
    generateDefaultOutput(inputLabels, toolType) {
        const sortedLabels = [...inputLabels].sort();
        const baseName = `${sortedLabels.join('')}_${toolType}`;
        
        return [this.resolveNamingConflict(baseName, '.txt')];
    }

    // OUTPUT EXTENSIONS
    getOutputExtension(toolType) {
        const extensions = {
            'pdf2text': '.txt',
            'audio2text': '.txt',
            'video2audio': '.wav',
            'image2text': '.txt',
            'summarizer': '.txt',
            'analyzer': '.txt',
            'translator': '.txt',
            'text2pdf': '.pdf',
            'text2template': '.doc'
        };
        
        return extensions[toolType] || '.txt';
    }

    // TOOL SUFFIXES
    getToolSuffix(toolType, params = {}) {
        switch (toolType) {
            case 'summarizer':
                return '-sum';
            case 'analyzer':
                return '-analysis';
            case 'translator':
                const language = params.language || 'en';
                return `-${this.getLanguageCode(language)}`;
            default:
                return '';
        }
    }

    getLanguageCode(language) {
        const langCodes = {
            'english': 'en',
            'dutch': 'nl',
            'french': 'fr',
            'german': 'de',
            'spanish': 'es',
            'italian': 'it',
            'portuguese': 'pt'
        };
        
        const normalized = language.toLowerCase();
        return langCodes[normalized] || normalized.substring(0, 2);
    }

    // CONFLICT RESOLUTION (ABC-sum.txt -> ABC-sum2.txt if conflict exists)
    resolveNamingConflict(baseName, extension) {
        const fullName = baseName + extension;
        
        if (!this.conflictCounter.has(fullName)) {
            this.conflictCounter.set(fullName, 1);
            return fullName;
        }
        
        // Generate numbered suffix
        let counter = this.conflictCounter.get(fullName) + 1;
        let resolvedName = `${baseName}${counter}${extension}`;
        
        // Keep incrementing until we find a unique name
        while (this.conflictCounter.has(resolvedName)) {
            counter++;
            resolvedName = `${baseName}${counter}${extension}`;
        }
        
        this.conflictCounter.set(fullName, counter);
        this.conflictCounter.set(resolvedName, 1);
        
        return resolvedName;
    }

    // BATCH OUTPUT NAMING
    generateBatchOutputs(nodes) {
        const outputs = [];
        
        nodes.forEach(node => {
            const inputLabels = node.inputLabels || [];
            if (inputLabels.length > 0) {
                const outputLabels = this.generateOutputLabels(
                    inputLabels, 
                    node.type, 
                    node.params
                );
                
                outputs.push({
                    nodeId: node.id,
                    inputLabels: inputLabels,
                    outputLabels: outputLabels,
                    toolType: node.type
                });
            }
        });
        
        return outputs;
    }

    // VALIDATION METHODS
    validateOutputName(outputName) {
        // Check for valid filename characters
        const invalidChars = /[<>:"/\\|?*]/g;
        if (invalidChars.test(outputName)) {
            return {
                valid: false,
                error: 'Output name contains invalid characters'
            };
        }
        
        // Check length
        if (outputName.length > 255) {
            return {
                valid: false,
                error: 'Output name is too long (max 255 characters)'
            };
        }
        
        return { valid: true };
    }

    // UPDATE METHODS FOR WORKFLOW CHANGES
    updateNodeOutputs(node) {
        if (!node.inputLabels || node.inputLabels.length === 0) {
            node.outputLabels = [];
            return node;
        }
        
        node.outputLabels = this.generateOutputLabels(
            node.inputLabels, 
            node.type, 
            node.params || {}
        );
        
        this.eventBus?.emit('node-outputs-updated', {
            nodeId: node.id,
            outputLabels: node.outputLabels
        });
        
        return node;
    }

    // UTILITY METHODS
    clearConflictTracker() {
        this.conflictCounter.clear();
    }

    getConflictHistory() {
        return Object.fromEntries(this.conflictCounter);
    }

    // EXPORT/IMPORT STATE
    exportState() {
        return {
            conflictCounter: Object.fromEntries(this.conflictCounter),
            timestamp: Date.now()
        };
    }

    importState(state) {
        if (state.conflictCounter) {
            this.conflictCounter = new Map(Object.entries(state.conflictCounter));
        }
    }

    // BUSINESS NAME CONVERSION
    convertToBusinessName(technicalName) {
        // Convert technical names to user-friendly business names
        return technicalName
            .replace(/-sum\.txt$/, ' Summary')
            .replace(/-analysis\.txt$/, ' Analysis')
            .replace(/-en\.txt$/, ' (English)')
            .replace(/-nl\.txt$/, ' (Dutch)')
            .replace(/-fr\.txt$/, ' (French)')
            .replace(/\.txt$/, '')
            .replace(/\.pdf$/, ' Report')
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim();
    }

    // PREVIEW NAMING
    previewOutputs(inputLabels, toolType, params = {}) {
        // Generate preview without updating conflict tracker
        const tempNaming = new OutputNaming();
        return tempNaming.generateOutputLabels(inputLabels, toolType, params);
    }
}

export { OutputNaming };