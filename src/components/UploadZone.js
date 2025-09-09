class UploadZone {
    constructor(eventBus, inputFilesManager, textFilesManager) {
        this.eventBus = eventBus;
        this.inputFilesManager = inputFilesManager;
        this.textFilesManager = textFilesManager;
        this.files = [];
        this.supportedTypes = {
            'audio': ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'],
            'video': ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],
            'pdf': ['application/pdf'],
            'text': ['text/plain', 'text/html', 'text/css', 'text/javascript'],
            'image': ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
            'document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        };
        
        this.initialize();
    }


    initialize() {
        this.setupDropZone();
        this.setupFileInput();
        this.setupClearButton();
        this.setupHelpButton();
        this.setupLabelMovementListeners();
    }

    setupLabelMovementListeners() {
        // Listen for label movements to update the file list
        if (this.eventBus) {
            this.eventBus.on('label-moved', this.handleLabelMoved.bind(this));
        }
    }

    setupDropZone() {
        const dropZone = document.getElementById('dropZone');
        if (!dropZone) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults.bind(this), false);
            document.body.addEventListener(eventName, this.preventDefaults.bind(this), false);
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
        dropZone.addEventListener('click', this.handleClick.bind(this), false);
    }

    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }
    }

    setupClearButton() {
        const clearBtn = document.getElementById('clearFilesBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', this.clearFiles.bind(this));
        }
    }

    setupHelpButton() {
        const helpBtn = document.getElementById('inputFilesHelpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', this.showInputFilesHelp.bind(this));
        }
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleClick() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.click();
        }
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        this.handleFiles(files);
    }

    handleFiles(fileList) {
        const newFiles = Array.from(fileList).filter(file => {
            // Check file type
            const isSupported = this.isFileTypeSupported(file.type);
            if (!isSupported) {
                this.eventBus.emit('error', { message: `File type ${file.type} is not supported` });
                return false;
            }

            // Check for duplicates
            const isDuplicate = this.files.some(existingFile => 
                existingFile.name === file.name && existingFile.size === file.size
            );
            if (isDuplicate) {
                console.warn(`File ${file.name} is already uploaded`);
                return false;
            }

            return true;
        });

        if (newFiles.length === 0) return;

        // V4 Flow: Add files to V4 managers
        if (newFiles.length > 0) {
            // Let InputFilesManager handle the files
            this.inputFilesManager.handleFilesUploaded(newFiles);
            
            // Store local reference for rendering (will be updated by event)
            this.files = [...this.files, ...newFiles];
        }
        
        // V4: Managers handle their own rendering and events
    }

    isFileTypeSupported(type) {
        return Object.values(this.supportedTypes).some(typeArray => 
            typeArray.some(supportedType => 
                type === supportedType || type.startsWith(supportedType.replace('*', ''))
            )
        );
    }

    getFileCategory(type) {
        for (const [category, types] of Object.entries(this.supportedTypes)) {
            if (types.some(supportedType => 
                type === supportedType || type.startsWith(supportedType.replace('*', ''))
            )) {
                return category;
            }
        }
        return 'unknown';
    }

    getFileIcon(category) {
        const icons = {
            audio: '🎵',
            video: '🎬',
            pdf: '📕',
            text: '📄',
            image: '🖼️',
            document: '📋',
            unknown: '❓'
        };
        return icons[category] || icons.unknown;
    }

    getFileColor(category) {
        const colors = {
            audio: 'bg-blue-100 text-blue-800 border-blue-300',
            video: 'bg-purple-100 text-purple-800 border-purple-300',
            pdf: 'bg-red-100 text-red-800 border-red-300',
            text: 'bg-green-100 text-green-800 border-green-300',
            image: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            document: 'bg-gray-100 text-gray-800 border-gray-300',
            unknown: 'bg-gray-100 text-gray-800 border-gray-300'
        };
        return colors[category] || colors.unknown;
    }

    // V4: FileList Box rendering handled by InputFilesManager

    // V4: textFiles Box rendering handled by TextFilesManager

    // V4: Click behaviors handled by InputFilesManager

    showInputFilesHelp() {
        // Create help modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 0.5rem; padding: 1.5rem; max-width: 28rem; width: 100%; margin: 0 1rem;">
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: #374151;">📁 Input Files Help</h3>
                
                <div style="margin-bottom: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <h4 style="font-weight: 500; color: #111827; margin-bottom: 0.5rem;">Single Click:</h4>
                        <p style="font-size: 0.875rem; color: #6b7280;">
                            Filter the entire app to show only this file's processing journey. 
                            See where your file goes and what happens to it.
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <h4 style="font-weight: 500; color: #111827; margin-bottom: 0.5rem;">Double Click:</h4>
                        <p style="font-size: 0.875rem; color: #6b7280;">
                            Open or download the original file to verify you uploaded the correct file.
                        </p>
                    </div>
                    
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 0.75rem; margin-top: 1rem;">
                        <p style="font-size: 0.75rem; color: #9ca3af;">
                            The letters (A, B, C...) are labels that represent your files throughout the workflow.
                        </p>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
                    <button id="closeHelpBtn" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                        Got it!
                    </button>
                </div>
            </div>
        `;

        // Add close functionality
        const closeBtn = modal.querySelector('#closeHelpBtn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        document.body.appendChild(modal);
    }

    removeFile(fileId) {
        // V4: Let InputFilesManager handle file removal
        const fileToRemove = this.files.find(file => file.id === fileId);
        if (fileToRemove) {
            this.inputFilesManager.removeInputFileLabel(fileToRemove.label);
            this.files = this.files.filter(file => file.id !== fileId);
        }
    }

    clearFiles() {
        // V4: Let InputFilesManager handle clearing
        this.inputFilesManager.clearInputFileLabels();
        this.textFilesManager.clearTextFileLabels();
        this.files = [];
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    getFiles() {
        return this.files;
    }

    getFileById(id) {
        return this.files.find(file => file.id === id);
    }

    getFileByLabel(label) {
        return this.files.find(file => file.label === label);
    }

    handleLabelMoved(data) {
        const { label, source, destination } = data;
        
        // If label was moved FROM upload zone TO a node, remove it from our display
        if (source.type === 'upload_zone' && destination.type === 'node') {
            const fileIndex = this.files.findIndex(file => file.label === label);
            if (fileIndex !== -1) {
                this.files.splice(fileIndex, 1);
                this.renderInputLabels();
        this.renderTextFileLabels();
                console.log(`Removed file with label ${label} from upload zone`);
            }
        }
        
        // If label was moved FROM a node TO upload zone, we might need to add it back
        // (This would be for future implementation of moving labels back to upload zone)
    }

    // Demo functionality - simulate file upload for easter egg demo
    simulateFileUpload(mockFiles) {
        // Clear existing files first
        this.clearFiles();

        // V4: Use InputFilesManager for demo files
        this.inputFilesManager.handleFilesUploaded(mockFiles);
        this.files = [...mockFiles];
        this.eventBus.emit('status-update', `🎭 Demo files loaded: ${this.files.length} files ready for easter egg detection!`);
    }
}

export { UploadZone };