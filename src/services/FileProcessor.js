class FileProcessor {
    constructor() {
        this.supportedTypes = new Set([
            'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/mpeg',
            'video/mp4', 'video/mov', 'video/avi', 'video/webm',
            'application/pdf',
            'text/plain', 'text/html', 'text/css', 'text/javascript',
            'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]);
    }

    async processFile(file, processingType = 'auto') {
        try {
            if (!this.isSupported(file.type)) {
                throw new Error(`Unsupported file type: ${file.type}`);
            }

            const fileData = await this.readFile(file);
            
            switch (processingType) {
                case 'text':
                    return await this.extractText(fileData, file.type);
                case 'metadata':
                    return await this.extractMetadata(fileData, file.type);
                case 'analyze':
                    return await this.analyzeContent(fileData, file.type);
                default:
                    return await this.autoProcess(fileData, file.type);
            }

        } catch (error) {
            console.error('Error processing file:', error);
            throw new Error(`Failed to process file: ${error.message}`);
        }
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: e.target.result,
                    lastModified: file.lastModified
                });
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            // Read file based on type
            if (file.type.startsWith('text/') || file.type === 'application/json') {
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    async extractText(fileData, fileType) {
        try {
            if (fileType.startsWith('text/')) {
                return {
                    success: true,
                    text: fileData.content,
                    type: 'text',
                    source: 'direct'
                };
            }

            if (fileType === 'application/pdf') {
                return await this.extractPdfText(fileData);
            }

            if (fileType.startsWith('image/')) {
                return await this.extractImageText(fileData);
            }

            if (fileType.startsWith('audio/')) {
                return await this.transcribeAudio(fileData);
            }

            if (fileType.startsWith('video/')) {
                return await this.transcribeVideo(fileData);
            }

            throw new Error('Text extraction not supported for this file type');

        } catch (error) {
            throw new Error(`Text extraction failed: ${error.message}`);
        }
    }

    async extractPdfText(fileData) {
        // Mock PDF text extraction for demo
        // In production, would use PDF.js or similar library
        return {
            success: true,
            text: `[PDF Content from ${fileData.name}]\n\nMock PDF text extraction. In production, this would use PDF.js to extract actual text content from the PDF document.`,
            type: 'text',
            source: 'pdf_extraction',
            pages: 1
        };
    }

    async extractImageText(fileData) {
        // Mock OCR for demo
        // In production, would use Tesseract.js or cloud OCR service
        return {
            success: true,
            text: `[OCR Text from ${fileData.name}]\n\nMock OCR text extraction. In production, this would use Tesseract.js or cloud OCR service to extract text from the image.`,
            type: 'text',
            source: 'ocr',
            confidence: 0.95
        };
    }

    async transcribeAudio(fileData) {
        // Mock audio transcription for demo
        // In production, would use Web Speech API or cloud transcription service
        return {
            success: true,
            text: `[Audio Transcription from ${fileData.name}]\n\nMock audio transcription. In production, this would use speech-to-text services to transcribe the audio content.`,
            type: 'text',
            source: 'speech_to_text',
            duration: 0,
            language: 'en-US'
        };
    }

    async transcribeVideo(fileData) {
        // Mock video transcription for demo
        // In production, would extract audio then transcribe
        return {
            success: true,
            text: `[Video Transcription from ${fileData.name}]\n\nMock video transcription. In production, this would extract audio from video then transcribe the speech content.`,
            type: 'text',
            source: 'video_transcription',
            duration: 0,
            hasAudio: true
        };
    }

    async extractMetadata(fileData, fileType) {
        const metadata = {
            name: fileData.name,
            type: fileType,
            size: fileData.size,
            lastModified: fileData.lastModified,
            category: this.getFileCategory(fileType)
        };

        if (fileType.startsWith('image/')) {
            metadata.dimensions = await this.getImageDimensions(fileData.content);
        }

        if (fileType.startsWith('audio/') || fileType.startsWith('video/')) {
            metadata.duration = await this.getMediaDuration(fileData);
        }

        return {
            success: true,
            metadata: metadata,
            type: 'metadata'
        };
    }

    async getImageDimensions(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    aspectRatio: img.width / img.height
                });
            };
            img.onerror = () => {
                resolve({ width: 0, height: 0, aspectRatio: 0 });
            };
            img.src = dataUrl;
        });
    }

    async getMediaDuration(fileData) {
        // Mock duration extraction
        // In production, would create audio/video element and get actual duration
        return {
            duration: 0,
            durationString: '00:00',
            estimated: true
        };
    }

    async analyzeContent(fileData, fileType) {
        try {
            const textResult = await this.extractText(fileData, fileType);
            
            if (!textResult.success) {
                throw new Error('Could not extract text for analysis');
            }

            // Mock content analysis
            const analysis = {
                wordCount: this.countWords(textResult.text),
                language: this.detectLanguage(textResult.text),
                sentiment: this.analyzeSentiment(textResult.text),
                keywords: this.extractKeywords(textResult.text),
                readabilityScore: this.calculateReadability(textResult.text),
                containsEasterEgg: this.detectEasterEgg(textResult.text, fileData.name)
            };

            return {
                success: true,
                analysis: analysis,
                text: textResult.text,
                type: 'analysis'
            };

        } catch (error) {
            throw new Error(`Content analysis failed: ${error.message}`);
        }
    }

    async autoProcess(fileData, fileType) {
        const category = this.getFileCategory(fileType);
        
        switch (category) {
            case 'text':
                return await this.extractText(fileData, fileType);
            case 'image':
                return await this.extractImageText(fileData);
            case 'audio':
                return await this.transcribeAudio(fileData);
            case 'video':
                return await this.transcribeVideo(fileData);
            case 'pdf':
                return await this.extractPdfText(fileData);
            default:
                return await this.extractMetadata(fileData, fileType);
        }
    }

    // Helper methods
    isSupported(fileType) {
        return this.supportedTypes.has(fileType) || 
               Array.from(this.supportedTypes).some(type => 
                   type.endsWith('/*') && fileType.startsWith(type.replace('/*', '/'))
               );
    }

    getFileCategory(fileType) {
        if (fileType.startsWith('audio/')) return 'audio';
        if (fileType.startsWith('video/')) return 'video';
        if (fileType.startsWith('image/')) return 'image';
        if (fileType.startsWith('text/')) return 'text';
        if (fileType === 'application/pdf') return 'pdf';
        return 'document';
    }

    countWords(text) {
        return text.trim().split(/\s+/).length;
    }

    detectLanguage(text) {
        // Mock language detection
        // In production, would use a language detection library
        const commonFrenchWords = ['le', 'la', 'les', 'de', 'et', 'à', 'un', 'une', 'ce', 'qui'];
        const commonGermanWords = ['der', 'die', 'das', 'und', 'ist', 'zu', 'den', 'nicht', 'von', 'sie'];
        const commonDutchWords = ['de', 'het', 'een', 'is', 'van', 'te', 'dat', 'op', 'voor', 'met'];
        
        const lowerText = text.toLowerCase();
        
        if (commonFrenchWords.some(word => lowerText.includes(word))) {
            return 'fr';
        } else if (commonGermanWords.some(word => lowerText.includes(word))) {
            return 'de';
        } else if (commonDutchWords.some(word => lowerText.includes(word))) {
            return 'nl';
        }
        
        return 'en';
    }

    analyzeSentiment(text) {
        // Mock sentiment analysis
        const positiveWords = ['good', 'great', 'excellent', 'positive', 'happy', 'satisfied'];
        const negativeWords = ['bad', 'terrible', 'negative', 'unhappy', 'dissatisfied', 'problem'];
        
        const lowerText = text.toLowerCase();
        const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
        
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    extractKeywords(text) {
        // Mock keyword extraction
        const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
        const wordCount = {};
        
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
    }

    calculateReadability(text) {
        // Mock readability score (simplified)
        const sentences = text.split(/[.!?]+/).length;
        const words = this.countWords(text);
        const avgWordsPerSentence = words / sentences;
        
        // Simple readability score (lower is better)
        return Math.max(1, Math.min(10, Math.round(avgWordsPerSentence / 3)));
    }

    detectEasterEgg(text, fileName) {
        // Easter egg detection for demo
        const easterEggWords = ['GIVE', 'BUDGET', 'FOR', 'AI', 'ToolFlowBuilder'];
        const numbers = ['1', '2', '3', '4', '5'];
        
        const foundWords = easterEggWords.filter(word => 
            text.includes(word) || fileName.includes(word)
        );
        
        const foundNumbers = numbers.filter(num => 
            text.includes(num) || fileName.includes(num)
        );
        
        return {
            hasEasterEgg: foundWords.length > 0 || foundNumbers.length > 0,
            words: foundWords,
            numbers: foundNumbers,
            confidence: foundWords.length > 0 ? 0.9 : 0.1
        };
    }

    // Batch processing
    async processFiles(files, processingType = 'auto') {
        const results = [];
        
        for (const file of files) {
            try {
                const result = await this.processFile(file, processingType);
                results.push({
                    file: file,
                    result: result,
                    success: true
                });
            } catch (error) {
                results.push({
                    file: file,
                    result: null,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // File validation
    validateFile(file, maxSize = 50 * 1024 * 1024) { // 50MB default
        const errors = [];
        
        if (!this.isSupported(file.type)) {
            errors.push(`Unsupported file type: ${file.type}`);
        }
        
        if (file.size > maxSize) {
            errors.push(`File too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(maxSize)})`);
        }
        
        if (file.size === 0) {
            errors.push('File is empty');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

export { FileProcessor };