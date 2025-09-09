// Configuration loader for ToolFlowBuilder
class Config {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        this.config = {
            // OpenAI Configuration
            openai: {
                apiKey: this.getEnvVar('OPENAI_API_KEY') || '',
                model: 'gpt-4o',
                baseUrl: 'https://api.openai.com/v1',
                timeout: 30000,
                maxRetries: 3,
                retryDelay: 1000
            },

            // Application Configuration  
            app: {
                name: 'ToolFlowBuilder',
                version: '3.0.0'
            },

            // File Processing Configuration
            files: {
                maxSize: 52428800, // 50MB
                supportedFormats: {
                    audio: ['mp3', 'wav', 'm4a', 'mp4'],
                    video: ['mp4', 'mov', 'avi', 'webm'], 
                    image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
                    document: ['pdf', 'txt', 'docx', 'xlsx']
                }
            },

            // Feature Flags for MVP
            features: {
                textVoiceInput: false,  // Set to false for MVP - disables text/voice input area
                generateButton: false,  // Disable workflow generation from text
                voiceInput: false,      // Disable voice input button
                describeButton: false   // Disable describe workflow button
            }
        };

        // Validate critical configuration
        this.validateConfig();
    }

    getEnvVar(key) {
        // Check multiple sources for environment variables
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key];
        }
        
        // Check global window object (for bundled apps)
        if (typeof window !== 'undefined' && window.env) {
            return window.env[key];
        }

        // Check meta tags (alternative method for browser apps)
        if (typeof document !== 'undefined') {
            const meta = document.querySelector(`meta[name="env-${key.toLowerCase()}"]`);
            if (meta) return meta.getAttribute('content');
        }

        // For client-side apps, API keys need to be handled differently
        // In production, use a secure backend proxy
        if (key === 'OPENAI_API_KEY' && typeof window !== 'undefined') {
            // Try to load from a secure configuration
            return window.OPENAI_API_KEY || localStorage.getItem('OPENAI_API_KEY');
        }

        return undefined;
    }

    getBoolEnvVar(key, defaultValue = false) {
        const value = this.getEnvVar(key);
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
    }

    validateConfig() {
        const errors = [];

        // Check OpenAI API key
        if (!this.config.openai.apiKey) {
            console.warn('⚠️  OpenAI API key not found. Add OPENAI_API_KEY to environment.');
        }

        // Validate file size limits
        if (this.config.files.maxSize < 1024) {
            errors.push('File size limit must be at least 1KB');
        }

        if (errors.length > 0) {
            console.error('❌ Configuration errors:', errors);
            throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }

        console.log('✅ Configuration loaded successfully');
    }

    // Getter methods for easy access
    get openai() {
        return this.config.openai;
    }

    get app() {
        return this.config.app;
    }

    get files() {
        return this.config.files;
    }

    get features() {
        return this.config.features;
    }

    // Utility methods
    hasApiKey() {
        return !!this.config.openai.apiKey;
    }

    isFileTypeSupported(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const allFormats = [
            ...this.config.files.supportedFormats.audio,
            ...this.config.files.supportedFormats.video,
            ...this.config.files.supportedFormats.image,
            ...this.config.files.supportedFormats.document
        ];
        return allFormats.includes(extension);
    }

    getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        for (const [type, formats] of Object.entries(this.config.files.supportedFormats)) {
            if (formats.includes(extension)) return type;
        }
        return 'unknown';
    }
}

// Create singleton instance
const config = new Config();

export { config as Config };