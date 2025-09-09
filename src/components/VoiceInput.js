class VoiceInput {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isRecording = false;
        this.recognition = null;
        this.transcript = '';
        this.initialize();
    }

    initialize() {
        // Check for browser support
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.setupRecognition();
        } else {
            console.warn('Speech recognition not supported in this browser');
        }

        this.setupEventListeners();
        this.textInput = document.getElementById('textInput');
    }

    setupRecognition() {
        if (!this.recognition) return;

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.isRecording = true;
            this.updateUI();
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.transcript = finalTranscript;
            this.updateTranscriptDisplay(finalTranscript + interimTranscript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopRecording();
            this.eventBus.emit('error', { message: `Speech recognition error: ${event.error}` });
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isRecording = false;
            this.updateUI();
            
            // Process the transcript
            if (this.transcript.trim()) {
                this.processTranscript(this.transcript);
            }
        };
    }

    setupEventListeners() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        voiceBtn?.addEventListener('click', this.activateWindowsDictation.bind(this));
    }

    activateWindowsDictation() {
        // Show instructions for Windows+H
        this.showWindowsDictationInstructions();
    }

    showWindowsDictationInstructions() {
        // Create a modal with instructions for Windows+H
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50;';
        modal.innerHTML = `
            <div style="background-color: white; border-radius: 8px; padding: 24px; max-width: 448px; width: 100%; margin: 0 16px;">
                <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 16px; text-align: center;">🎤 Voice Input</h3>
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 60px; margin-bottom: 16px;">⌨️</div>
                    <p style="color: #374151; margin-bottom: 16px;">To use voice input, press:</p>
                    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <span style="font-size: 20px; font-family: monospace; font-weight: bold;">Windows + H</span>
                    </div>
                    <p style="font-size: 14px; color: #4b5563; margin-bottom: 16px;">This will activate Windows built-in voice typing. Speak your workflow description and it will appear in the text area above.</p>
                    <p style="font-size: 12px; color: #6b7280;">Make sure your cursor is in the text input area before pressing Windows+H</p>
                </div>
                <div style="display: flex; gap: 16px; margin-top: 24px;">
                    <button id="closeInstructionsBtn" style="flex: 1; background-color: #3b82f6; color: white; padding: 8px 0; border: none; border-radius: 8px; cursor: pointer;">Got it!</button>
                </div>
            </div>
        `;

        // Add close functionality
        const closeBtn = modal.querySelector('#closeInstructionsBtn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
            // Focus the text input area so user can immediately use Windows+H
            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.focus();
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                const textInput = document.getElementById('textInput');
                if (textInput) {
                    textInput.focus();
                }
            }
        });

        document.body.appendChild(modal);
    }

    toggleRecording() {
        // Keep this method for compatibility but redirect to Windows+H
        this.activateWindowsDictation();
    }

    startRecording() {
        if (!this.recognition) {
            this.eventBus.emit('error', { 
                message: 'Speech recognition not supported in this browser. Please type your request instead.' 
            });
            return;
        }

        try {
            this.transcript = '';
            this.recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            this.eventBus.emit('error', { message: 'Could not start voice recording' });
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    processTranscript(transcript) {
        console.log('Processing transcript:', transcript);
        
        // Clean up the transcript
        const cleanTranscript = transcript.trim().replace(/\s+/g, ' ');
        
        if (cleanTranscript) {
            // Update the text input area
            this.updateTranscriptDisplay(cleanTranscript);
            
            // Enable the generate flow button if there's text
            const generateBtn = document.getElementById('generateFlowBtn');
            if (generateBtn) {
                generateBtn.disabled = false;
            }
            
            this.eventBus.emit('voice-transcript', cleanTranscript);
            
            // Show hover feedback on voice button instead of bottom status
            this.showVoiceHoverFeedback();
        }
    }

    updateUI() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        
        if (this.isRecording) {
            if (voiceBtn) {
                voiceBtn.style.backgroundColor = '#ef4444';
                voiceBtn.innerHTML = '🔴';
            }
        } else {
            if (voiceBtn) {
                voiceBtn.style.backgroundColor = '#6b7280';
                voiceBtn.innerHTML = '🎤';
            }
        }
    }

    updateTranscriptDisplay(text) {
        if (this.textInput && text) {
            // Append to existing text or replace if empty
            if (this.textInput.value.trim()) {
                this.textInput.value += ' ' + text;
            } else {
                this.textInput.value = text;
            }
        }
    }

    resetUI() {
        this.isRecording = false;
        this.updateUI();
        this.updateTranscriptDisplay('');
    }

    resetTranscript() {
        this.transcript = '';
        this.updateTranscriptDisplay('');
    }

    showVoiceHoverFeedback() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (!voiceBtn) return;
        
        // Update the button's title attribute for hover tooltip
        voiceBtn.title = '✅ Voice input added to text area! Click to use voice input again.';
        
        // Reset title after a few seconds
        setTimeout(() => {
            voiceBtn.title = 'Voice Input (or press Windows+H)';
        }, 5000);
    }

    // Demo helper method for preset voice commands
    simulateVoiceInput(text) {
        this.transcript = text;
        this.updateTranscriptDisplay(text);
        setTimeout(() => {
            this.processTranscript(text);
            this.hide();
        }, 1000);
    }

    // Preset demo commands
    static getDemoCommands() {
        return [
            "Process all the uploaded files and create a summary report",
            "Translate the French text to English and analyze all documents",
            "Find the easter egg words hidden in each file and combine them in the correct order to reveal the secret message",
            "Convert the audio to text, extract information from the PDF, and create a compliance report",
            "Summarize all content and generate a professional PDF report"
        ];
    }
}

export { VoiceInput };