class ToolPalette {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isVisible = false;
        this.tools = this.getToolDefinitions();
        this.initialize();
    }

    getToolDefinitions() {
        return {
            // Category 1: Convert to text
            'convert-to-text': [
                {
                    id: 'pdf2text',
                    name: 'PDF→Text',
                    icon: '📕', 
                    description: 'Extract text from PDF',
                    systemPrompt: 'You are a document processor. Extract and clean text content from PDF files.'
                },
                {
                    id: 'audio2text',
                    name: 'Audio→Text',
                    icon: '🎵',
                    description: 'Convert audio to text',
                    systemPrompt: 'You are an expert transcriptionist. Convert audio content to accurate text.'
                },
                {
                    id: 'image2text',
                    name: 'Image→Text',
                    icon: '🖼️',
                    description: 'Extract text from images',
                    systemPrompt: 'You are an OCR specialist. Extract all visible text from images using optical character recognition.'
                },
                {
                    id: 'video2text',
                    name: 'Video→Text',
                    icon: '🎬',
                    description: 'Extract text from video',
                    systemPrompt: 'You are a media processor. Extract audio from video and convert to text.'
                },
                {
                    id: 'webscraper',
                    name: 'Web→Text',
                    icon: '🌐',
                    description: 'Scrape text from websites',
                    systemPrompt: 'You are a web scraper. Extract clean, readable text content from web pages, removing ads, navigation, and formatting.'
                }
            ],

            // Category 2: Process text  
            'process-text': [
                {
                    id: 'summarizer',
                    name: 'Summarize',
                    icon: '📝',
                    description: 'Create summaries',
                    systemPrompt: 'You are a professional summarizer. Create concise, accurate summaries of text content.'
                },
                {
                    id: 'translator',
                    name: 'Translate', 
                    icon: '🌐',
                    description: 'Translate text',
                    systemPrompt: 'You are a professional translator. Translate text accurately while preserving meaning and context.'
                },
                {
                    id: 'analyzer',
                    name: 'Analyze',
                    icon: '🔍', 
                    description: 'Analyze content',
                    systemPrompt: 'You are a content analyst. Analyze text for key insights, themes, and important information.'
                },
                {
                    id: 'join',
                    name: 'Join',
                    icon: '🔗', 
                    description: 'Combine multiple texts',
                    systemPrompt: 'You are a document combiner. Join multiple text files with appropriate separators while maintaining readability.'
                }
            ],
            
            // Category 3: Convert from text  
            'convert-from-text': [
                {
                    id: 'text2pdf',
                    name: 'Text→PDF',
                    icon: '📕',
                    description: 'Convert to PDF',
                    systemPrompt: 'You are a document formatter. Format text content into professional PDF documents.'
                },
                {
                    id: 'text2docx',
                    name: 'Text→Word',
                    icon: '📝',
                    description: 'Convert to Word document',
                    systemPrompt: 'You are a document formatter. Format text content into professional Word documents.'
                },
                {
                    id: 'template',
                    name: 'Fill Template',
                    icon: '📋',
                    description: 'Fill template with text content',
                    systemPrompt: 'You are a template processor. Fill template documents with provided text content according to user instructions.'
                }
            ]
        };
    }

    initialize() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        const carousel = document.getElementById('toolCarousel');
        if (!carousel) return;

        // Create infinite carousel structure
        carousel.innerHTML = '';
        carousel.style.cssText = `
            display: flex;
            overflow: hidden;
            position: relative;
        `;
        
        // Create sliding container
        const slider = document.createElement('div');
        slider.className = 'carousel-slider';
        slider.style.cssText = `
            display: flex;
            transition: transform 0.3s ease;
            gap: 8px;
        `;
        
        // Flatten all tools into single array with categories
        this.allItems = [];
        const categoryLabels = {
            'convert-to-text': 'Convert to text',
            'process-text': 'Process text', 
            'convert-from-text': 'Convert from text'
        };

        Object.keys(this.tools).forEach((categoryKey, categoryIndex) => {
            // Add category header
            this.allItems.push({
                type: 'category',
                label: categoryLabels[categoryKey],
                key: categoryKey
            });
            
            // Add tools in this category
            this.tools[categoryKey].forEach(tool => {
                this.allItems.push({
                    type: 'tool',
                    tool: tool
                });
            });
        });

        // Create items (original + clones for infinite effect)
        this.createCarouselItems(slider);
        
        carousel.appendChild(slider);
        this.slider = slider;
        this.currentIndex = this.allItems.length; // Start at first clone set
        this.updateCarouselPosition();
    }

    createCarouselItems(slider) {
        // Add clones at start (for left infinite scroll)
        this.allItems.forEach(item => {
            const element = this.createCarouselItem(item);
            element.classList.add('clone');
            slider.appendChild(element);
        });
        
        // Add original items
        this.allItems.forEach(item => {
            const element = this.createCarouselItem(item);
            slider.appendChild(element);
        });
        
        // Add clones at end (for right infinite scroll)
        this.allItems.forEach(item => {
            const element = this.createCarouselItem(item);
            element.classList.add('clone');
            slider.appendChild(element);
        });
    }

    createCarouselItem(item) {
        if (item.type === 'category') {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'category-header';
            
            // Define more visible category colors
            const categoryColors = {
                'convert-to-text': '#dbeafe',     // More visible blue
                'process-text': '#dcfce7',       // More visible green  
                'convert-from-text': '#fed7aa'   // More visible FileList
            };
            
            const bgColor = categoryColors[item.key] || '#f9fafb';
            
            categoryEl.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 120px;
                height: 60px;
                background: transparent;
                border-radius: 8px;
                font-size: 12px;
                font-weight: bold;
                text-align: center;
                color: #6b7280;
                margin: 0 8px;
                white-space: pre-line;
                border: 2px solid ${bgColor};
                position: relative;
            `;
            categoryEl.textContent = item.label;
            return categoryEl;
        } else {
            const toolCard = this.createToolCard(item.tool);
            
            // Add subtle category background to tool cards
            const categoryColors = {
                'convert-to-text': 'rgba(59, 130, 246, 0.15)',     // More visible blue
                'process-text': 'rgba(34, 197, 94, 0.15)',        // More visible green
                'convert-from-text': 'rgba(251, 146, 60, 0.15)'   // More visible FileList
            };
            
            // Find which category this tool belongs to
            let toolCategory = null;
            Object.keys(this.tools).forEach(categoryKey => {
                if (this.tools[categoryKey].some(t => t.id === item.tool.id)) {
                    toolCategory = categoryKey;
                }
            });
            
            if (toolCategory && categoryColors[toolCategory]) {
                const existingStyle = toolCard.style.cssText;
                toolCard.style.cssText = existingStyle + `; background: ${categoryColors[toolCategory]};`;
            }
            
            return toolCard;
        }
    }

    createToolCard(tool) {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.draggable = true;
        toolCard.dataset.toolId = tool.id;
        toolCard.dataset.toolType = tool.id;

        toolCard.innerHTML = `
            <div class="tool-icon">${tool.icon}</div>
            <div class="tool-name">${tool.name}</div>
        `;

        // Add drag start event
        toolCard.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', tool.id);
            e.dataTransfer.setData('application/x-tool-type', tool.id);
            toolCard.style.opacity = '0.5';
        });

        // Add drag end event
        toolCard.addEventListener('dragend', () => {
            toolCard.style.opacity = '1';
        });

        // Add click event to add tool to canvas
        toolCard.addEventListener('click', () => {
            this.eventBus.emit('tool-selected', { tool });
        });

        return toolCard;
    }

    setupEventListeners() {
        setTimeout(() => {
            const scrollLeftBtn = document.getElementById('scrollLeftBtn');
            const scrollRightBtn = document.getElementById('scrollRightBtn');

            if (scrollLeftBtn) {
                scrollLeftBtn.addEventListener('click', () => {
                    this.scrollCarousel('left');
                });
            }

            if (scrollRightBtn) {
                scrollRightBtn.addEventListener('click', () => {
                    this.scrollCarousel('right');
                });
            }
        }, 100);
    }

    scrollCarousel(direction) {
        if (!this.slider || !this.allItems) return;

        const itemWidth = 120; // Approximate item width + gap
        const step = 2; // Move 2 items at a time

        if (direction === 'right') {
            this.currentIndex += step;
        } else {
            this.currentIndex -= step;
        }

        this.updateCarouselPosition();
        this.checkAndResetPosition();
    }

    updateCarouselPosition() {
        if (!this.slider) return;
        
        const itemWidth = 120;
        const translateX = -(this.currentIndex * itemWidth);
        this.slider.style.transform = `translateX(${translateX}px)`;
    }

    checkAndResetPosition() {
        if (!this.allItems) return;
        
        const totalItems = this.allItems.length;
        
        // If we've scrolled past the right clones, jump to start of original items
        if (this.currentIndex >= totalItems * 2) {
            setTimeout(() => {
                this.slider.style.transition = 'none';
                this.currentIndex = totalItems;
                this.updateCarouselPosition();
                setTimeout(() => {
                    this.slider.style.transition = 'transform 0.3s ease';
                }, 50);
            }, 300);
        }
        
        // If we've scrolled past the left clones, jump to end of original items
        if (this.currentIndex <= 0) {
            setTimeout(() => {
                this.slider.style.transition = 'none';
                this.currentIndex = totalItems;
                this.updateCarouselPosition();
                setTimeout(() => {
                    this.slider.style.transition = 'transform 0.3s ease';
                }, 50);
            }, 300);
        }
    }

    // Find tool by ID
    findToolById(toolId) {
        // Search through all categories
        for (const categoryKey of Object.keys(this.tools)) {
            const tool = this.tools[categoryKey].find(tool => tool.id === toolId);
            if (tool) return tool;
        }
        return null;
    }

    // Get tool information for workflow generation
    getToolInfo(toolId) {
        return this.findToolById(toolId);
    }

    // Get all available tools
    getAllTools() {
        // Flatten all tools from all categories
        const allTools = [];
        Object.keys(this.tools).forEach(categoryKey => {
            allTools.push(...this.tools[categoryKey]);
        });
        return allTools;
    }
}

export { ToolPalette };