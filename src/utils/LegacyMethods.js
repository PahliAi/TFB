// Legacy Methods Backup - DO NOT DELETE
// This file stores all replaced methods for reference and potential rollback

class LegacyMethods {
    constructor() {
        this.backupDate = new Date().toISOString();
        this.replacedMethods = new Map();
    }

    // Backup method storage
    backup(className, methodName, originalCode, replacedDate, reason) {
        const backupKey = `${className}.${methodName}`;
        this.replacedMethods.set(backupKey, {
            originalCode,
            replacedDate,
            reason,
            className,
            methodName
        });
        
        console.log(`[LEGACY BACKUP] Stored ${backupKey} - ${reason}`);
    }

    // Get all backups for a class
    getBackupsForClass(className) {
        const classBackups = [];
        for (const [key, backup] of this.replacedMethods) {
            if (backup.className === className) {
                classBackups.push(backup);
            }
        }
        return classBackups;
    }

    // List all backed up methods
    listAllBackups() {
        return Array.from(this.replacedMethods.values());
    }
}

// Export singleton instance
const legacyBackup = new LegacyMethods();
export { legacyBackup };

// =============================================================================
// BACKED UP METHODS START HERE
// =============================================================================

/* 
   BACKUP LOG:
   - Created: ${new Date().toISOString()}
   - Purpose: Store legacy methods during migration to label-based architecture
   - DO NOT MODIFY THIS FILE MANUALLY - Use legacyBackup.backup() method
*/

// Methods will be added here as they are replaced...

/* 
   BACKUP ENTRY 1: ${new Date().toISOString()}
   CLASS: ToolFlowBuilder (main.js)
   METHOD: autoCreateConversionNodes + related methods
   REASON: Replace individual file node creation with multi-file grouping
*/

// LEGACY METHOD 1.1: autoCreateConversionNodes
const LEGACY_autoCreateConversionNodes = function(files) {
    // Auto-create conversion nodes for files that need conversion to text
    files.forEach((file, index) => {
        console.log(`Processing file: ${file.name}, category: ${file.category}, type: ${file.type}`);
        const needsConversion = this.fileNeedsTextConversion(file);
        console.log(`Needs conversion: ${needsConversion}`);
        if (needsConversion) {
            const conversionType = this.getConversionType(file);
            console.log(`Conversion type: ${conversionType}`);
            if (conversionType) {
                this.createAutoConversionNode(file, conversionType, index);
            }
        }
    });
};

// LEGACY METHOD 1.2: fileNeedsTextConversion
const LEGACY_fileNeedsTextConversion = function(file) {
    // All non-text files need conversion to text for processing
    return file.category !== 'text';
};

// LEGACY METHOD 1.3: getConversionType
const LEGACY_getConversionType = function(file) {
    switch (file.category) {
        case 'audio':
            return 'audio2text';
        case 'video':
            return 'video2audio'; // First convert video to audio
        case 'pdf':
            return 'pdf2text';
        case 'image':
            return 'image2text';
        default:
            return null;
    }
};

// LEGACY METHOD 1.4: createAutoConversionNode
const LEGACY_createAutoConversionNode = function(file, conversionType, index) {
    // Position nodes in a column on the left side of the canvas
    const x = 100;
    const y = 100 + (index * 100);

    const nodeData = {
        id: `auto_${conversionType}_${Date.now()}_${index}`,
        type: conversionType,
        position: { x, y },
        inputs: [file.label],
        fileInputs: [{ 
            id: file.id, 
            label: file.label, 
            name: file.name, 
            type: file.type 
        }],
        params: {},
        customPrompt: '',
        outputs: [`${file.name.split('.')[0]}_converted.txt`]
    };

    // For video files, we need a second node for audio2text conversion
    if (conversionType === 'video2audio') {
        this.workflowCanvas.addNode(nodeData);
        
        // Add audio2text node after video2audio
        const audioTextNode = {
            id: `auto_audio2text_${Date.now()}_${index}`,
            type: 'audio2text',
            position: { x: x + 200, y: y },
            inputs: [],
            fileInputs: [],
            params: {},
            customPrompt: '',
            outputs: [`${file.name.split('.')[0]}_transcript.txt`]
        };
        
        this.workflowCanvas.addNode(audioTextNode);
        
        // Connect video2audio to audio2text
        const connection = {
            id: `conn_auto_${Date.now()}`,
            from: nodeData.id,
            to: audioTextNode.id,
            fileName: `${file.name.split('.')[0]}_audio.wav`
        };
        
        this.workflowCanvas.connections.push(connection);
        
        // Update target node inputs
        if (!audioTextNode.inputs.includes(connection.fileName)) {
            audioTextNode.inputs.push(connection.fileName);
        }
        
        this.workflowCanvas.renderConnection(connection);
        
        // Refresh the target node display to show updated inputs
        this.workflowCanvas.updateNodeDisplay(audioTextNode);
    } else {
        this.workflowCanvas.addNode(nodeData);
    }
};

/* 
   BACKUP ENTRY 2: ${new Date().toISOString()}
   CLASS: WorkflowCanvas (WorkflowCanvas.js)
   METHOD: createInputNodeForFile + addFileToNode
   REASON: Replace file-based node creation with label-based multi-file nodes
*/

// LEGACY METHOD 2.1: createInputNodeForFile
const LEGACY_createInputNodeForFile = function(fileId, fileName, fileType, fileLabel, position) {
    // Determine appropriate tool based on file type
    let toolType = 'analyzer'; // default
    
    if (fileType.startsWith('audio/')) {
        toolType = 'audio2text';
    } else if (fileType.startsWith('video/')) {
        toolType = 'video2audio';
    } else if (fileType === 'application/pdf') {
        toolType = 'pdf2text';
    } else if (fileType.startsWith('image/')) {
        toolType = 'image2text';
    } else if (fileType.startsWith('text/')) {
        toolType = 'analyzer';
    }

    const node = {
        id: `node_${this.nextNodeId++}`,
        type: toolType,
        position: position,
        inputs: [fileLabel],
        fileInputs: [{ id: fileId, label: fileLabel, name: fileName, type: fileType }],
        params: {},
        customPrompt: '',
        outputs: [`${fileName.split('.')[0]}_${toolType}.txt`]
    };

    this.addNode(node);
};

// LEGACY METHOD 2.2: addFileToNode
const LEGACY_addFileToNode = function(nodeData, file) {
    // Add file to node's inputs
    if (!nodeData.inputs.includes(file.label)) {
        nodeData.inputs.push(file.label);
    }
    
    // Add to file inputs if not already present
    if (!nodeData.fileInputs.find(f => f.id === file.id)) {
        nodeData.fileInputs.push(file);
    }
    
    // Update node display to show new input
    this.updateNodeDisplay(nodeData);
    
    // Emit event for workflow validation updates
    this.eventBus.emit('node-updated', nodeData);
};

/* 
   BACKUP ENTRY 3: ${new Date().toISOString()}
   CLASS: FileNaming (FileNaming.js)
   METHOD: Entire file-centric naming system
   REASON: Replace with label-based OutputNaming system
*/

// LEGACY CLASS: FileNaming - Complete file backed up, see original src/utils/FileNaming.js
// This entire class conflicts with the new label-based architecture
// Replaced by src/services/OutputNaming.js with label-based naming