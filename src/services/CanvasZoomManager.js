// CanvasZoomManager - Miro-style zoom and pan functionality
// Provides smooth zoom in/out and drag-to-pan for the workflow canvas

class CanvasZoomManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.canvas = null;
        this.zoomLevel = 1;
        this.minZoom = 0.25;
        this.maxZoom = 3;
        this.panX = 0;
        this.panY = 0;
        
        // Drag state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastPanX = 0;
        this.lastPanY = 0;
        
        // Label drag state tracking
        this.isLabelBeingDragged = false;
        
        this.initialize();
    }
    
    initialize() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            console.warn('Canvas element not found for zoom manager');
            return;
        }
        
        this.setupEventListeners();
        this.setupZoomControls();
        this.setupDragEventListeners();
        // Temporarily disable transform application to debug node creation issues
        // this.applyTransform();
    }
    
    setupEventListeners() {
        if (!this.canvas) return;
        
        // Mouse wheel for zooming
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Mouse drag for panning
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    setupDragEventListeners() {
        // Listen for label drag events to prevent canvas panning interference
        this.eventBus.on('text-file-drag-start', () => {
            this.isLabelBeingDragged = true;
            console.log('Canvas panning disabled: label drag started');
        });
        
        this.eventBus.on('text-file-drag-end', () => {
            this.isLabelBeingDragged = false;
            console.log('Canvas panning enabled: label drag ended');
        });
        
        // Also listen for generic HTML5 dragend event as a fallback
        document.addEventListener('dragend', () => {
            // Small delay to ensure the EventBus events fire first
            setTimeout(() => {
                this.isLabelBeingDragged = false;
            }, 50);
        });
    }
    
    setupZoomControls() {
        // Add zoom controls to the canvas toolbar
        const toolbar = document.querySelector('.canvas-toolbar .toolbar-buttons');
        if (!toolbar) return;
        
        // Create zoom controls container
        const zoomControls = document.createElement('div');
        zoomControls.className = 'zoom-controls';
        zoomControls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #e5e7eb;
            border-radius: 6px;
        `;
        
        // Zoom out button
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'zoom-btn';
        zoomOutBtn.innerHTML = '−';
        zoomOutBtn.title = 'Zoom Out (Ctrl + -)';
        zoomOutBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 16px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            color: #374151;
        `;
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        
        // Zoom level display
        const zoomDisplay = document.createElement('span');
        zoomDisplay.id = 'zoomDisplay';
        zoomDisplay.style.cssText = `
            font-size: 12px;
            font-weight: 500;
            min-width: 40px;
            text-align: center;
            color: #374151;
            cursor: pointer;
        `;
        zoomDisplay.textContent = '100%';
        zoomDisplay.title = 'Click to reset zoom';
        zoomDisplay.addEventListener('click', () => this.resetZoom());
        
        // Zoom in button
        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'zoom-btn';
        zoomInBtn.innerHTML = '+';
        zoomInBtn.title = 'Zoom In (Ctrl + +)';
        zoomInBtn.style.cssText = zoomOutBtn.style.cssText;
        zoomInBtn.addEventListener('click', () => this.zoomIn());
        
        // Fit to screen button
        const fitBtn = document.createElement('button');
        fitBtn.className = 'zoom-btn';
        fitBtn.innerHTML = '⌂';
        fitBtn.title = 'Fit to Screen (Ctrl + 0)';
        fitBtn.style.cssText = zoomOutBtn.style.cssText;
        fitBtn.addEventListener('click', () => this.fitToScreen());
        
        // Add hover effects
        [zoomOutBtn, zoomInBtn, fitBtn].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = '#f3f4f6';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = 'transparent';
            });
        });
        
        zoomControls.appendChild(zoomOutBtn);
        zoomControls.appendChild(zoomDisplay);
        zoomControls.appendChild(zoomInBtn);
        zoomControls.appendChild(fitBtn);
        
        // Insert before the first button in toolbar
        toolbar.insertBefore(zoomControls, toolbar.firstChild);
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom in/out based on wheel direction
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomAt(mouseX, mouseY, zoomDelta);
    }
    
    handleMouseDown(e) {
        // Don't start canvas dragging if a label is being dragged
        if (this.isLabelBeingDragged) {
            return;
        }
        
        // Only start drag if clicking on empty canvas area (not on nodes)
        if (e.target === this.canvas || e.target.closest('.canvas-welcome')) {
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.lastPanX = this.panX;
            this.lastPanY = this.panY;
            
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        
        this.panX = this.lastPanX + deltaX;
        this.panY = this.lastPanY + deltaY;
        
        this.applyTransform();
        e.preventDefault();
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = '';
            e.preventDefault();
        }
    }
    
    handleKeyDown(e) {
        if (!e.ctrlKey && !e.metaKey) return;
        
        switch (e.key) {
            case '=':
            case '+':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.fitToScreen();
                break;
        }
    }
    
    zoomAt(x, y, zoomDelta) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomDelta));
        
        if (newZoom === this.zoomLevel) return;
        
        // Calculate new pan to keep zoom centered on mouse position
        const zoomRatio = newZoom / this.zoomLevel;
        this.panX = x - (x - this.panX) * zoomRatio;
        this.panY = y - (y - this.panY) * zoomRatio;
        this.zoomLevel = newZoom;
        
        this.applyTransform();
        this.updateZoomDisplay();
        
        // Emit event for other components
        this.eventBus.emit('canvas-zoom-changed', {
            zoom: this.zoomLevel,
            panX: this.panX,
            panY: this.panY
        });
    }
    
    zoomIn() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomAt(centerX, centerY, 1.2);
    }
    
    zoomOut() {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomAt(centerX, centerY, 0.8);
    }
    
    resetZoom() {
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
        this.updateZoomDisplay();
        
        this.eventBus.emit('canvas-zoom-changed', {
            zoom: this.zoomLevel,
            panX: this.panX,
            panY: this.panY
        });
    }
    
    fitToScreen() {
        // Find all nodes on canvas
        const nodes = this.canvas.querySelectorAll('[data-node-id]');
        if (nodes.length === 0) {
            this.resetZoom();
            return;
        }
        
        // Calculate bounds of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        nodes.forEach(node => {
            const rect = node.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            const x = rect.left - canvasRect.left;
            const y = rect.top - canvasRect.top;
            const w = rect.width;
            const h = rect.height;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });
        
        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Calculate required zoom and pan
        const canvasRect = this.canvas.getBoundingClientRect();
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const zoomX = canvasRect.width / contentWidth;
        const zoomY = canvasRect.height / contentHeight;
        const optimalZoom = Math.min(zoomX, zoomY, this.maxZoom);
        
        // Center the content
        this.zoomLevel = optimalZoom;
        this.panX = (canvasRect.width - contentWidth * optimalZoom) / 2 - minX * optimalZoom;
        this.panY = (canvasRect.height - contentHeight * optimalZoom) / 2 - minY * optimalZoom;
        
        this.applyTransform();
        this.updateZoomDisplay();
        
        this.eventBus.emit('canvas-zoom-changed', {
            zoom: this.zoomLevel,
            panX: this.panX,
            panY: this.panY
        });
    }
    
    applyTransform() {
        if (!this.canvas) return;
        
        // Apply transform to all direct children of canvas
        const children = this.canvas.children;
        for (let child of children) {
            // Don't transform the SVG connections - they handle their own positioning
            if (!child.id.includes('onnection')) {
                child.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
                child.style.transformOrigin = '0 0';
            }
        }
        
        // Also transform the SVG connections
        const svg = document.getElementById('connectionSvg') || document.getElementById('connectionsSvg');
        if (svg) {
            svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
            svg.style.transformOrigin = '0 0';
        }
    }
    
    updateZoomDisplay() {
        const display = document.getElementById('zoomDisplay');
        if (display) {
            display.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }
    
    // Public API
    getZoomLevel() {
        return this.zoomLevel;
    }
    
    getPan() {
        return { x: this.panX, y: this.panY };
    }
    
    setZoom(zoom, centerX = null, centerY = null) {
        if (centerX !== null && centerY !== null) {
            this.zoomAt(centerX, centerY, zoom / this.zoomLevel);
        } else {
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
            this.applyTransform();
            this.updateZoomDisplay();
        }
    }
    
    setPan(x, y) {
        this.panX = x;
        this.panY = y;
        this.applyTransform();
    }
}

export { CanvasZoomManager };