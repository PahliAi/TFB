// InputFiles Manager 
// Handles A-ZZZ input file labels with click interactions

class InputFilesManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.inputFileLabels = []; // A-ZZZ labels with original filenames
        this.labelSequence = this.generateLabelSequence();
        this.nextLabelIndex = 0;
        this.currentlySelectedLabel = null; // Track currently filtered label for toggle
        
        this.initialize();
    }
    
    initialize() {
        this.setupEventListeners();
    }
    
    generateLabelSequence() {
        // Generate A, B, C, ..., Z, AA, AB, ..., ZZ, AAA, etc.
        const sequence = [];
        
        // Single letters: A-Z
        for (let i = 0; i < 26; i++) {
            sequence.push(String.fromCharCode(65 + i));
        }
        
        // Double letters: AA-ZZ
        for (let i = 0; i < 26; i++) {
            for (let j = 0; j < 26; j++) {
                sequence.push(String.fromCharCode(65 + i) + String.fromCharCode(65 + j));
            }
        }
        
        // Triple letters: AAA-ZZZ (if ever needed)
        for (let i = 0; i < 26; i++) {
            for (let j = 0; j < 26; j++) {
                for (let k = 0; k < 26; k++) {
                    sequence.push(String.fromCharCode(65 + i) + String.fromCharCode(65 + j) + String.fromCharCode(65 + k));
                }
            }
        }
        
        return sequence;
    }
    
    setupEventListeners() {
        // Listen for file uploads
        this.eventBus.on('files-uploaded', this.handleFilesUploaded.bind(this));
    }
    
    handleFilesUploaded(files) {
        // Clear existing labels
        this.clearInputFileLabels();
        this.nextLabelIndex = 0;
        
        // Create A-ZZZ labels for all files
        files.forEach((file, index) => {
            const label = this.labelSequence[this.nextLabelIndex++];
            const inputFileLabel = {
                id: label,
                label: label,
                originalName: file.name,
                fileType: file.type,
                fileSize: file.size,
                file: file,
                uploadedAt: Date.now()
            };
            
            this.inputFileLabels.push(inputFileLabel);
        });
        
        // Render input file labels in FileList box
        this.renderInputFileLabels();
        
        // Emit event for other systems
        this.eventBus.emit('input-file-labels-created', this.inputFileLabels);
    }
    
    renderInputFileLabels() {
        const container = document.getElementById('FileList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.inputFileLabels.forEach(inputFileLabel => {
            const labelElement = this.createInputFileLabelElement(inputFileLabel);
            container.appendChild(labelElement);
        });
    }
    
    createInputFileLabelElement(inputFileLabel) {
        const labelCard = document.createElement('div');
        labelCard.className = 'input-file-label-card';
        labelCard.dataset.label = inputFileLabel.label;
        
        labelCard.innerHTML = `
            <div class="label-display">
                <div class="label-id">${inputFileLabel.label}</div>
                <div class="file-icon">${this.getFileIcon(inputFileLabel.fileType)}</div>
                <div class="original-filename">${inputFileLabel.originalName}</div>
            </div>
        `;
        
        // Add click event listeners
        labelCard.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSingleClick(inputFileLabel);
        });
        
        labelCard.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.handleDoubleClick(inputFileLabel);
        });

        // Add delete button
        const deleteBtn = this.createDeleteButton(inputFileLabel);
        labelCard.style.position = 'relative';
        labelCard.appendChild(deleteBtn);
        
        // Set up hover behavior for delete button
        labelCard.addEventListener('mouseenter', () => {
            deleteBtn.style.display = 'flex';
        });
        
        labelCard.addEventListener('mouseleave', () => {
            deleteBtn.style.display = 'none';
        });
        
        return labelCard;
    }
    
    getFileIcon(fileType) {
        if (fileType.startsWith('audio/')) return '🎵';
        if (fileType.startsWith('video/')) return '🎬';
        if (fileType === 'application/pdf') return '📕';
        if (fileType.startsWith('image/')) return '🖼️';
        if (fileType.startsWith('text/')) return '📝';
        return '📄';
    }
    
    handleSingleClick(inputFileLabel) {
        // V4 Feature: Toggle filter for this file's processing chain
        if (this.currentlySelectedLabel === inputFileLabel.label) {
            // Same label clicked again - unfilter (show all)
            console.log(`Unfiltering: showing all files`);
            this.currentlySelectedLabel = null;
            
            // Emit unfilter event
            this.eventBus.emit('clear-input-file-filter');
            
            // Remove visual highlight
            this.clearHighlight();
        } else {
            // Different label clicked - filter to this file
            console.log(`Filtering app for file: ${inputFileLabel.label} (${inputFileLabel.originalName})`);
            this.currentlySelectedLabel = inputFileLabel.label;
            
            // Emit filtering event
            this.eventBus.emit('filter-by-input-file', {
                label: inputFileLabel.label,
                originalName: inputFileLabel.originalName
            });
            
            // Visual feedback - highlight selected label
            this.highlightSelectedLabel(inputFileLabel.label);
        }
    }
    
    handleDoubleClick(inputFileLabel) {
        // V4 Feature: Open/download original file for verification
        console.log(`Opening original file: ${inputFileLabel.originalName}`);
        
        // Create download link for file verification
        const url = URL.createObjectURL(inputFileLabel.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = inputFileLabel.originalName;
        a.click();
        URL.revokeObjectURL(url);
        
        // Emit event for tracking
        this.eventBus.emit('input-file-opened', inputFileLabel);
    }
    
    highlightSelectedLabel(selectedLabel) {
        // Remove previous highlights
        document.querySelectorAll('.input-file-label-card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add highlight to selected label
        const selectedElement = document.querySelector(`[data-label="${selectedLabel}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }
    
    clearHighlight() {
        // Remove all highlights when unfiltering
        document.querySelectorAll('.input-file-label-card.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }
    
    clearInputFileLabels() {
        this.inputFileLabels = [];
        this.nextLabelIndex = 0; // Reset label index to start from A again
        this.currentlySelectedLabel = null; // Reset selection state when clearing
        const container = document.getElementById('FileList');
        if (container) {
            container.innerHTML = '';
        }
    }
    
    getInputFileLabels() {
        return this.inputFileLabels;
    }
    
    getInputFileLabelByLabel(label) {
        return this.inputFileLabels.find(item => item.label === label);
    }

    hasLabel(label) {
        return this.inputFileLabels.some(item => item.label === label);
    }

    removeLabel(label) {
        this.inputFileLabels = this.inputFileLabels.filter(item => item.label !== label);
        this.renderInputFileLabels();
        console.log(`Removed label ${label} from InputFilesManager`);
    }

    createDeleteButton(inputFileLabel) {
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

        // Handle delete click
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleDeleteClick(inputFileLabel);
        });

        return deleteBtn;
    }

    handleDeleteClick(inputFileLabel) {
        // For input files, we delete by the base label (without .txt)
        const baseLabel = inputFileLabel.label;
        
        // Emit event to trigger cascading delete
        this.eventBus.emit('request-cascading-delete', {
            label: baseLabel + '.txt', // CascadingDeleteManager expects .txt extension
            source: 'input-files'
        });
    }
}

export { InputFilesManager };