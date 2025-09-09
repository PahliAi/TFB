// ToolStyleManager - Centralized tool styling and theming
// Provides consistent icons, colors, and styling across all components

class ToolStyleManager {
    constructor(toolPalette = null) {
        this.toolPalette = toolPalette;
        this.categoryColors = this.initializeCategoryColors();
        this.toolCategories = this.initializeToolCategories();
    }

    setToolPalette(toolPalette) {
        this.toolPalette = toolPalette;
    }

    initializeCategoryColors() {
        return {
            'convert-to-text': {
                background: 'rgba(59, 130, 246, 0.15)',     // Blue
                backgroundHover: 'rgba(59, 130, 246, 0.25)',
                border: '#93c5fd',
                text: '#1e40af',
                solid: '#3b82f6'
            },
            'process-text': {
                background: 'rgba(34, 197, 94, 0.15)',      // Green
                backgroundHover: 'rgba(34, 197, 94, 0.25)',
                border: '#86efac',
                text: '#065f46',
                solid: '#22c55e'
            },
            'convert-from-text': {
                background: 'rgba(251, 146, 60, 0.15)',     // FileList
                backgroundHover: 'rgba(251, 146, 60, 0.25)',
                border: '#fcd34d',
                text: '#92400e',
                solid: '#fb923c'
            },
            'default': {
                background: '#f9fafb',
                backgroundHover: '#f3f4f6',
                border: '#e5e7eb',
                text: '#6b7280',
                solid: '#9ca3af'
            },
            'upload': {
                background: '#f3f4f6',
                backgroundHover: '#e5e7eb',
                border: '#d1d5db',
                text: '#374151',
                solid: '#6b7280'
            }
        };
    }

    initializeToolCategories() {
        return {
            // Convert to text tools
            'pdf2text': 'convert-to-text',
            'audio2text': 'convert-to-text',
            'image2text': 'convert-to-text',
            'video2text': 'convert-to-text',
            'webscraper': 'convert-to-text',
            
            // Process text tools
            'summarizer': 'process-text',
            'translator': 'process-text',
            'analyzer': 'process-text',
            'join': 'process-text',
            
            // Convert from text tools
            'text2pdf': 'convert-from-text',
            'text2docx': 'convert-from-text',
            'template': 'convert-from-text'
        };
    }

    // Get tool definition (icon, name, etc.)
    getToolDefinition(toolType) {
        if (this.toolPalette) {
            return this.toolPalette.findToolById(toolType);
        }
        
        // Fallback tool definitions when ToolPalette is not available
        const fallbackTools = {
            'pdf2text': { icon: '📕', name: 'PDF→Text' },
            'audio2text': { icon: '🎵', name: 'Audio→Text' },
            'image2text': { icon: '🖼️', name: 'Image→Text' },
            'video2text': { icon: '🎬', name: 'Video→Text' },
            'webscraper': { icon: '🌐', name: 'Web→Text' },
            'summarizer': { icon: '📝', name: 'Summarize' },
            'translator': { icon: '🗣️', name: 'Translate' },
            'analyzer': { icon: '🔍', name: 'Analyze' },
            'join': { icon: '🔗', name: 'Join' },
            'text2pdf': { icon: '📕', name: 'Text→PDF' },
            'text2docx': { icon: '📝', name: 'Text→Word' },
            'template': { icon: '📋', name: 'Fill Template' }
        };
        
        return fallbackTools[toolType] || null;
    }

    // Get category for a tool type
    getToolCategory(toolType) {
        return this.toolCategories[toolType] || 'default';
    }

    // Get colors for a tool type or category
    getToolColors(toolTypeOrCategory) {
        // If it's a direct category, use it
        if (this.categoryColors[toolTypeOrCategory]) {
            return this.categoryColors[toolTypeOrCategory];
        }
        
        // Otherwise, get category from tool type
        const category = this.getToolCategory(toolTypeOrCategory);
        return this.categoryColors[category] || this.categoryColors['default'];
    }

    // Get complete tool style info (icon + colors + name)
    getToolStyleInfo(toolType, sourceType = 'node-output') {
        // Handle special cases
        if (sourceType === 'auto-generated' || sourceType === 'upload' || toolType === 'upload') {
            return {
                icon: '📁',
                name: 'File Upload',
                category: 'upload',
                colors: this.categoryColors['upload']
            };
        }

        // Handle manual/unknown cases
        if (sourceType === 'manual' || toolType === 'text-file' || toolType === 'manual') {
            return {
                icon: '📋',
                name: 'Manual Entry',
                category: 'default',
                colors: this.categoryColors['default']
            };
        }

        // Get tool definition
        const toolDef = this.getToolDefinition(toolType);
        const category = this.getToolCategory(toolType);
        const colors = this.getToolColors(toolType);

        // If we couldn't find the tool definition, provide sensible defaults
        if (!toolDef && !this.toolCategories[toolType]) {
            return {
                icon: '⚙️',
                name: toolType || 'Unknown Tool',
                category: 'default',
                colors: this.categoryColors['default']
            };
        }

        return {
            icon: toolDef ? toolDef.icon : '⚙️',
            name: toolDef ? toolDef.name : (toolType || 'Unknown Tool'),
            category: category,
            colors: colors
        };
    }

    // Apply consistent styling to an element
    applyToolStyling(element, toolType, sourceType = 'node-output', options = {}) {
        const styleInfo = this.getToolStyleInfo(toolType, sourceType);
        const {
            showIcon = true,
            showText = true,
            compact = false,
            variant = 'default' // 'default', 'solid', 'outline'
        } = options;

        // Base styles
        const baseStyle = {
            backgroundColor: styleInfo.colors.background,
            border: `1px solid ${styleInfo.colors.border}`,
            color: styleInfo.colors.text,
            borderRadius: '6px',
            padding: compact ? '4px 8px' : '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: showIcon && showText ? '8px' : '4px',
            fontSize: compact ? '12px' : '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
        };

        // Variant-specific adjustments
        if (variant === 'solid') {
            baseStyle.backgroundColor = styleInfo.colors.solid;
            baseStyle.color = 'white';
            baseStyle.border = `1px solid ${styleInfo.colors.solid}`;
        } else if (variant === 'outline') {
            baseStyle.backgroundColor = 'transparent';
            baseStyle.border = `2px solid ${styleInfo.colors.solid}`;
            baseStyle.color = styleInfo.colors.solid;
        }

        // Apply styles to element
        Object.assign(element.style, baseStyle);

        // Add hover effects
        element.addEventListener('mouseenter', () => {
            if (variant === 'solid') {
                element.style.backgroundColor = this.darkenColor(styleInfo.colors.solid, 0.1);
            } else {
                element.style.backgroundColor = styleInfo.colors.backgroundHover;
            }
        });

        element.addEventListener('mouseleave', () => {
            element.style.backgroundColor = baseStyle.backgroundColor;
        });

        return styleInfo;
    }

    // Create a styled tool element with consistent structure
    createToolElement(toolType, sourceType = 'node-output', options = {}) {
        const {
            text = null,
            compact = false,
            showIcon = true,
            showText = true,
            variant = 'default',
            className = '',
            draggable = false
        } = options;

        const element = document.createElement('div');
        element.className = className;
        if (draggable) element.draggable = true;

        const styleInfo = this.applyToolStyling(element, toolType, sourceType, {
            showIcon,
            showText,
            compact,
            variant
        });

        // Build innerHTML
        let innerHTML = '';
        if (showIcon) {
            innerHTML += `<div style="font-size: ${compact ? '14px' : '16px'};">${styleInfo.icon}</div>`;
        }
        if (showText) {
            const displayText = text || styleInfo.name;
            innerHTML += `<div style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${displayText}</div>`;
        }

        element.innerHTML = innerHTML;
        element.dataset.toolType = toolType;
        element.dataset.category = styleInfo.category;

        return element;
    }

    // Utility to darken a color
    darkenColor(color, percent) {
        // Simple darkening for hex colors
        if (color.startsWith('#')) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent * 100);
            const R = (num >> 16) - amt;
            const G = (num >> 8 & 0x00FF) - amt;
            const B = (num & 0x0000FF) - amt;
            return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
        }
        return color;
    }

    // Get inline styles as CSS text
    getToolInlineStyles(toolType, sourceType = 'node-output', variant = 'default') {
        const styleInfo = this.getToolStyleInfo(toolType, sourceType);
        
        let styles = `
            background-color: ${styleInfo.colors.background};
            border: 1px solid ${styleInfo.colors.border};
            color: ${styleInfo.colors.text};
        `;

        if (variant === 'solid') {
            styles = `
                background-color: ${styleInfo.colors.solid};
                border: 1px solid ${styleInfo.colors.solid};
                color: white;
            `;
        } else if (variant === 'outline') {
            styles = `
                background-color: transparent;
                border: 2px solid ${styleInfo.colors.solid};
                color: ${styleInfo.colors.solid};
            `;
        }

        return styles;
    }
}

export { ToolStyleManager };