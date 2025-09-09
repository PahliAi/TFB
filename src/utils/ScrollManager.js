// ScrollManager - Context-aware mouse wheel scrolling
// Routes scroll events to the panel under the mouse cursor

class ScrollManager {
    constructor() {
        this.scrollableElements = [
            '#FileList',
            '#textFilesLabelList', 
            '#outputList',
            '#canvas'
        ];
        this.currentTarget = null;
        this.initialize();
    }

    initialize() {
        // Prevent default wheel behavior on body
        document.body.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Track which element has mouse focus
        this.scrollableElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.addEventListener('mouseenter', () => {
                    this.currentTarget = element;
                });
                
                element.addEventListener('mouseleave', () => {
                    if (this.currentTarget === element) {
                        this.currentTarget = null;
                    }
                });
            }
        });
    }

    handleWheel(e) {
        // If we have a specific target, route scroll there
        if (this.currentTarget && this.canScroll(this.currentTarget)) {
            e.preventDefault();
            this.scrollElement(this.currentTarget, e.deltaY);
            return;
        }

        // Otherwise, check if mouse is over any scrollable element
        const elementUnderMouse = this.getElementUnderMouse(e);
        if (elementUnderMouse && this.canScroll(elementUnderMouse)) {
            e.preventDefault();
            this.scrollElement(elementUnderMouse, e.deltaY);
            return;
        }

        // Default: prevent any scrolling to avoid window scrollbar
        e.preventDefault();
    }

    getElementUnderMouse(e) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        
        for (const element of elements) {
            // Check if this element or its parent matches our scrollable selectors
            for (const selector of this.scrollableElements) {
                const target = document.querySelector(selector);
                if (target && (element === target || target.contains(element))) {
                    return target;
                }
            }
        }
        return null;
    }

    canScroll(element) {
        // Check if element has scrollable content
        const hasVerticalScroll = element.scrollHeight > element.clientHeight;
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        
        return hasVerticalScroll && (overflowY === 'auto' || overflowY === 'scroll');
    }

    scrollElement(element, deltaY) {
        // Smooth scrolling
        const scrollAmount = deltaY * 0.5; // Adjust sensitivity
        element.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
        });
    }
}

export { ScrollManager };