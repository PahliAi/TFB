class UIUtils {
    static showStatus(message, type = 'info', duration = 3000) {
        const statusBar = document.getElementById('statusBar');
        const statusText = document.getElementById('statusText');
        
        if (!statusBar || !statusText) return;

        // Set message
        statusText.textContent = message;
        
        // Set style based on type with inline styles
        statusBar.style.cssText = 'margin-bottom: 16px; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; border: 1px solid;';
        switch (type) {
            case 'success':
                statusBar.style.backgroundColor = '#f0fdf4';
                statusBar.style.borderColor = '#bbf7d0';
                statusBar.style.color = '#166534';
                break;
            case 'error':
                statusBar.style.backgroundColor = '#fef2f2';
                statusBar.style.borderColor = '#fecaca';
                statusBar.style.color = '#991b1b';
                break;
            case 'warning':
                statusBar.style.backgroundColor = '#fefce8';
                statusBar.style.borderColor = '#fde68a';
                statusBar.style.color = '#92400e';
                break;
            default:
                statusBar.style.backgroundColor = '#eff6ff';
                statusBar.style.borderColor = '#bfdbfe';
                statusBar.style.color = '#1e40af';
        }

        // Show status bar
        statusBar.classList.remove('hidden');

        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideStatus();
            }, duration);
        }
    }

    static hideStatus() {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.classList.add('hidden');
        }
    }

    static showError(message, duration = 5000) {
        this.showStatus(message, 'error', duration);
    }

    static showSuccess(message, duration = 3000) {
        this.showStatus(message, 'success', duration);
    }

    static showWarning(message, duration = 4000) {
        this.showStatus(message, 'warning', duration);
    }

    static showLoading(message = 'Processing...') {
        this.showStatus(message, 'info', 0); // 0 duration means don't auto-hide
    }

    static createElement(tag, className = '', innerHTML = '', attributes = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        
        return element;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    static formatTime(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return Promise.resolve();
            } catch (err) {
                document.body.removeChild(textArea);
                return Promise.reject(err);
            }
        }
    }

    static downloadFile(content, fileName, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static animateCSS(element, animationName, duration = '1s') {
        return new Promise((resolve) => {
            const animationEnd = 'animationend';
            element.style.animationDuration = duration;
            element.classList.add('animate__animated', `animate__${animationName}`);

            function handleAnimationEnd(event) {
                event.stopPropagation();
                element.classList.remove('animate__animated', `animate__${animationName}`);
                element.style.animationDuration = '';
                resolve('Animation ended');
            }

            element.addEventListener(animationEnd, handleAnimationEnd, { once: true });
        });
    }

    static createModal(title, content, buttons = []) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50;';
        
        const buttonHtml = buttons.map(btn => 
            `<button style="padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; ${btn.className || 'background-color: #6b7280; color: white;'}" data-action="${btn.action}">${btn.text}</button>`
        ).join(' ');

        modal.innerHTML = `
            <div style="background-color: white; border-radius: 8px; padding: 24px; max-width: 512px; width: 100%; margin: 0 16px;">
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">${title}</h3>
                <div style="margin-bottom: 24px;">${content}</div>
                <div style="display: flex; gap: 16px; justify-content: flex-end;">
                    ${buttonHtml}
                </div>
            </div>
        `;

        // Add event listeners for buttons
        buttons.forEach(btn => {
            const buttonEl = modal.querySelector(`[data-action="${btn.action}"]`);
            if (buttonEl && btn.handler) {
                buttonEl.addEventListener('click', (e) => {
                    btn.handler(e, modal);
                });
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    static removeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    static highlightElement(element, duration = 2000) {
        const originalStyle = element.style.cssText;
        element.style.cssText += '; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); transition: box-shadow 0.2s ease;';
        setTimeout(() => {
            element.style.cssText = originalStyle;
        }, duration);
    }

    static scrollIntoView(element, options = { behavior: 'smooth', block: 'center' }) {
        element.scrollIntoView(options);
    }

    static isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    static getRandomId(prefix = '') {
        return prefix + Math.random().toString(36).substr(2, 9);
    }

    static sanitizeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            "/": '&#x2F;',
        };
        const reg = /[&<>"'/]/ig;
        return text.replace(reg, (match) => (map[match]));
    }
}

export { UIUtils };