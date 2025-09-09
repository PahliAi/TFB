// Simple 3-Panel Resize System
class SimpleResize {
    constructor() {
        this.isResizing = false;
        this.currentHandle = null;
        this.startX = 0;
        this.leftPanel = null;
        this.centerPanel = null;
        this.rightPanel = null;
        
        this.init();
    }
    
    init() {
        // Get panels
        this.leftPanel = document.querySelector('.left-side-container');
        this.centerPanel = document.querySelector('.center-panel');  
        this.rightPanel = document.querySelector('.right-panel');
        
        if (!this.leftPanel || !this.centerPanel || !this.rightPanel) {
            console.warn('Could not find all panels for resize');
            return;
        }
        
        // Add event listeners to resize handles
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach((handle, index) => {
            if (handle.classList.contains('sub-resize-handle')) {
                handle.dataset.handleType = 'sub';
            } else {
                handle.dataset.handleType = 'main';
                handle.dataset.handleIndex = handle.dataset.handleType === 'main' ? 
                    Array.from(document.querySelectorAll('.resize-handle:not(.sub-resize-handle)')).indexOf(handle) : index;
            }
            handle.addEventListener('mousedown', this.startResize.bind(this));
        });
        
        // Global mouse events
        document.addEventListener('mousemove', this.doResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
    }
    
    startResize(e) {
        e.preventDefault();
        
        this.isResizing = true;
        this.currentHandle = e.target;
        this.startX = e.clientX;
        
        if (this.currentHandle.dataset.handleType === 'sub') {
            // Store starting widths for sub-panels
            this.leftSubPanel = document.querySelector('.left-sub-panel');
            this.rightSubPanel = document.querySelector('.right-sub-panel');
            this.startLeftSubWidth = this.leftSubPanel.offsetWidth;
            this.startRightSubWidth = this.rightSubPanel.offsetWidth;
        } else {
            // Store starting widths for main panels
            this.startLeftWidth = this.leftPanel.offsetWidth;
            this.startCenterWidth = this.centerPanel.offsetWidth;
            this.startRightWidth = this.rightPanel.offsetWidth;
        }
        
        // Visual feedback
        this.currentHandle.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    }
    
    doResize(e) {
        if (!this.isResizing || !this.currentHandle) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - this.startX;
        
        if (this.currentHandle.dataset.handleType === 'sub') {
            // Resize sub-panels
            this.resizeSubPanels(deltaX);
        } else {
            const handleIndex = parseInt(this.currentHandle.dataset.handleIndex);
            
            if (handleIndex === 0) {
                // First handle: resize left and center panels
                this.resizeLeftCenter(deltaX);
            } else if (handleIndex === 1) {
                // Second handle: resize center and right panels  
                this.resizeCenterRight(deltaX);
            }
        }
    }
    
    resizeLeftCenter(deltaX) {
        const newLeftWidth = this.startLeftWidth + deltaX;
        const newCenterWidth = this.startCenterWidth - deltaX;
        
        // Enforce minimum widths
        if (newLeftWidth >= 200 && newCenterWidth >= 300) {
            this.leftPanel.style.width = newLeftWidth + 'px';
            this.centerPanel.style.width = newCenterWidth + 'px';
        }
    }
    
    resizeCenterRight(deltaX) {
        const newCenterWidth = this.startCenterWidth + deltaX;
        const newRightWidth = this.startRightWidth - deltaX;
        
        // Enforce minimum widths
        if (newCenterWidth >= 300 && newRightWidth >= 200) {
            this.centerPanel.style.width = newCenterWidth + 'px';
            this.rightPanel.style.width = newRightWidth + 'px';
        }
    }
    
    resizeSubPanels(deltaX) {
        const newLeftSubWidth = this.startLeftSubWidth + deltaX;
        const newRightSubWidth = this.startRightSubWidth - deltaX;
        
        // Enforce minimum widths for sub-panels
        if (newLeftSubWidth >= 100 && newRightSubWidth >= 100) {
            this.leftSubPanel.style.width = newLeftSubWidth + 'px';
            this.rightSubPanel.style.width = newRightSubWidth + 'px';
            this.leftSubPanel.style.flex = 'none';
            this.rightSubPanel.style.flex = 'none';
        }
    }
    
    stopResize() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        
        if (this.currentHandle) {
            this.currentHandle.classList.remove('resizing');
        }
        
        this.currentHandle = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
}

export { SimpleResize };