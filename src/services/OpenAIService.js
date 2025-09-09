import { Config } from '../config/config.js';

class OpenAIService {
    constructor() {
        this.config = Config;
        this.apiKey = this.config.openai.apiKey;
        this.baseUrl = this.config.openai.baseUrl;
        this.model = this.config.openai.model;
        this.maxRetries = this.config.openai.maxRetries;
        this.retryDelay = this.config.openai.retryDelay;
    }

    async makeRequest(endpoint, data) {
        // Use real OpenAI for frontend workflow building
        // Use mock responses for backend execution (JSON+FILES+PROMPTS)
        if (!this.apiKey) {
            console.warn('⚠️ No OpenAI API key - using mock responses');
            return this.getMockResponse(endpoint, data);
        }

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                console.error(`OpenAI API attempt ${attempt} failed:`, error);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1)));
            }
        }
    }

    getMockResponse(endpoint, data) {
        // Mock workflow generation response
        if (endpoint === '/chat/completions' && (data.function_call || data.functions)) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        choices: [{
                            message: {
                                function_call: {
                                    name: "generate_workflow",
                                    arguments: JSON.stringify(this.generateMockWorkflow(data))
                                }
                            }
                        }]
                    });
                }, 1000 + Math.random() * 2000); // 1-3 second delay for realism
            });
        }

        // Default mock response
        return Promise.resolve({
            choices: [{
                message: {
                    content: "Mock response for demo purposes"
                }
            }]
        });
    }

    generateMockWorkflow(data) {
        // Extract user intent from messages
        const userMessage = data.messages.find(m => m.role === 'user');
        const isEasterEgg = userMessage?.content.toLowerCase().includes('easter') || 
                           userMessage?.content.toLowerCase().includes('hidden') ||
                           userMessage?.content.toLowerCase().includes('secret');

        if (isEasterEgg) {
            return this.generateEasterEggWorkflow();
        }

        return this.generateStandardWorkflow();
    }

    generateEasterEggWorkflow() {
        return {
            workflow_nodes: [
                {
                    id: "node_1",
                    type: "audio2text",
                    position: { x: 100, y: 50 },
                    inputs: ["A"],
                    params: {},
                    customPrompt: "Look for any easter egg words or clues in the audio"
                },
                {
                    id: "node_2", 
                    type: "video2audio",
                    position: { x: 100, y: 150 },
                    inputs: ["B"],
                    params: {},
                    customPrompt: ""
                },
                {
                    id: "node_3",
                    type: "audio2text",
                    position: { x: 250, y: 150 },
                    inputs: [],
                    params: {},
                    customPrompt: "Extract any easter egg words from the AllianzArena video content"
                },
                {
                    id: "node_4",
                    type: "image2text",
                    position: { x: 100, y: 250 },
                    inputs: ["C"],
                    params: {},
                    customPrompt: "Find any numbers or words that might be easter eggs"
                },
                {
                    id: "node_5",
                    type: "analyzer",
                    position: { x: 100, y: 350 },
                    inputs: ["D"],
                    params: {},
                    customPrompt: "Analyze AI_at_Allianz.txt and look for easter egg words"
                },
                {
                    id: "node_6",
                    type: "pdf2text",
                    position: { x: 100, y: 450 },
                    inputs: ["E"],
                    params: {},
                    customPrompt: "Extract text and find any easter egg words"
                },
                {
                    id: "final_analyzer",
                    type: "analyzer",
                    position: { x: 500, y: 250 },
                    inputs: [],
                    params: {},
                    customPrompt: "Find all easter egg words from the processed files. Look for sequence numbers (Word 1, Word 2, etc.) and combine them in the correct order to reveal the hidden message."
                }
            ],
            connections: [
                { from: "node_1", to: "final_analyzer", fileName: "audio_transcript.txt" },
                { from: "node_2", to: "node_3", fileName: "extracted_audio.wav" },
                { from: "node_3", to: "final_analyzer", fileName: "video_transcript.txt" },
                { from: "node_4", to: "final_analyzer", fileName: "image_text.txt" },
                { from: "node_5", to: "final_analyzer", fileName: "translated_text.txt" },
                { from: "node_6", to: "final_analyzer", fileName: "pdf_text.txt" }
            ]
        };
    }

    generateStandardWorkflow() {
        return {
            workflow_nodes: [
                {
                    id: "node_1",
                    type: "audio2text",
                    position: { x: 100, y: 100 },
                    inputs: ["A"],
                    params: {},
                    customPrompt: ""
                },
                {
                    id: "node_2",
                    type: "pdf2text", 
                    position: { x: 100, y: 200 },
                    inputs: ["B"],
                    params: {},
                    customPrompt: ""
                },
                {
                    id: "node_3",
                    type: "summarizer",
                    position: { x: 400, y: 150 },
                    inputs: [],
                    params: {},
                    customPrompt: "Create a comprehensive business summary combining all input sources"
                }
            ],
            connections: [
                { from: "node_1", to: "node_3", fileName: "transcription.txt" },
                { from: "node_2", to: "node_3", fileName: "document_text.txt" }
            ]
        };
    }

    async generateWorkflow(userIntent, files) {
        const functions = [{
            name: "generate_workflow",
            description: "Generate a workflow based on user intent and file types",
            parameters: {
                type: "object",
                properties: {
                    workflow_nodes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                type: { 
                                    type: "string",
                                    enum: ["audio2text", "video2audio", "pdf2text", "summarizer", "translator", "analyzer", "text2template", "text2pdf", "image2text"]
                                },
                                position: { 
                                    type: "object",
                                    properties: {
                                        x: { type: "number" },
                                        y: { type: "number" }
                                    }
                                },
                                inputs: { type: "array", items: { type: "string" } },
                                params: { type: "object" },
                                customPrompt: { type: "string" }
                            }
                        }
                    },
                    connections: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                from: { type: "string" },
                                to: { type: "string" },
                                fileName: { type: "string" }
                            }
                        }
                    }
                },
                required: ["workflow_nodes"]
            }
        }];

        const systemPrompt = `You are an expert insurance workflow designer. Generate efficient workflows for document and media processing.

Key principles:
1. Always start with input files (left side of canvas)
2. Process systematically (audio→text before analysis)
3. End with actionable outputs (right side of canvas)
4. Use appropriate tools for file types
5. Consider business context (claims, compliance, reporting)

Available tools:
- audio2text: Convert audio files to text (.wav, .mp3, .m4a → .txt)
- video2audio: Extract audio from video (.mp4, .mov → .wav)
- pdf2text: Extract text from PDFs (.pdf → .txt)
- image2text: Extract text from images (.png, .jpg → .txt) 
- summarizer: Create summaries from text
- translator: Translate text between languages
- analyzer: Analyze text for patterns, keywords, insights
- text2template: Fill templates with extracted data
- text2pdf: Format text into professional PDFs

Position nodes from left (x: 100-200) to right (x: 400-600), top to bottom (y: 50-400).
Create logical connections between nodes based on data flow.

For easter egg scenarios (finding hidden words across files), use analyzer with custom prompts like:
"Find easter egg words in each file and extract them with their sequence numbers"`;

        const userMessage = `Create a workflow for: ${userIntent}

Files available:
${files.map((f, i) => `${String.fromCharCode(65 + i)}: ${f.name} (${f.type})`).join('\n')}

Generate an efficient workflow that processes these files to achieve the user's goal.`;

        const response = await this.makeRequest('/chat/completions', {
            model: this.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            functions,
            function_call: { name: "generate_workflow" },
            temperature: 0.3
        });

        if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.function_call) {
            const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
            return this.formatWorkflow(functionArgs, files);
        }

        console.error('Invalid response structure:', response);
        throw new Error('Failed to generate workflow - invalid response structure');
    }

    async processFile(fileContent, toolType, customPrompt = '') {
        // Mock processing for demo - in production this would call appropriate APIs
        const systemPrompts = {
            audio2text: 'You are an expert transcriptionist. Convert the audio content to accurate text. Pay attention to any easter egg words or special phrases mentioned.',
            video2audio: 'Extract audio content from video file.',
            pdf2text: 'Extract all text content from the PDF document. Preserve formatting and capture any special words or phrases.',
            image2text: 'Extract all text visible in the image using OCR. Pay special attention to any words or numbers that might be easter eggs.',
            summarizer: 'Create a clear, concise summary of the text content.',
            translator: 'Translate the text to the target language while preserving meaning and context.',
            analyzer: 'Analyze the text for patterns, keywords, insights, and any hidden messages or easter eggs. If looking for easter egg words, extract them with their sequence numbers.',
            text2template: 'Fill the provided template with data from the input text.',
            text2pdf: 'Format the text into a professional PDF document.'
        };

        const finalPrompt = systemPrompts[toolType] + (customPrompt ? `\n\nAdditional instructions: ${customPrompt}` : '');

        // For demo purposes, return mock responses based on file types
        return this.getMockResponse(toolType, fileContent, customPrompt);
    }

    getMockResponse(toolType, fileContent, customPrompt) {
        // Enhanced mock responses for demo with better easter egg content
        const fileName = fileContent.name || 'unknown_file';
        const fileNameBase = fileName.split('.')[0];
        
        const easterEggResponses = {
            audio2text: fileName.includes('ForMyOwnPart') ? 
                `🎵 Audio Transcription Complete
                
📞 Audio Analysis - ${fileName}
================================
🎧 Processing high-quality M4A audio file...
📝 Transcription output:

"For my own part, I believe that the time has come to GIVE more attention to our technological capabilities. The board needs to understand that investment in AI tools can transform our business operations fundamentally..."

[Audio continues with discussion about digital transformation...]

✅ Transcription completed successfully
🔍 Easter egg detected: Word 1 = "Give"
📊 Quality: Excellent | Duration: Estimated 3:45` :
                `🎵 Audio transcribed: ${fileName}`,

            video2audio: fileName.includes('AllianzArena') ? `🎬 Video Processing Complete
            
🔊 Audio extracted from: ${fileName}
🏟️ Processing AllianzArena video content...
Duration: 8:12 minutes (HD quality)
Audio Quality: High (44.1kHz, 16-bit)
📝 Audio content contains discussion about insurance industry trends...

🔍 Detected keyword in audio track: "budget" 
✅ Ready for further processing` :
`🎬 Video processed: ${fileName}`,

            pdf2text: fileName.includes('DORA_rules') ?
                `📕 PDF Content Extracted
                
📄 DORA RULES ANALYSIS - ${fileName}
=====================================
DIGITAL OPERATIONAL RESILIENCE ACT - NETHERLANDS
------------------------------------------------

🇳🇱 Dutch Regulatory Framework for Financial Services
Document Language: Dutch (Nederlands)

Key Sections Identified:
• Artikel 1: Definities en toepassingsgebied  
• Artikel 15: ICT-risicobeheersing
• Artikel 23: Digitale operationele weerbaarheid
• Bijlage III: Kritieke ICT-dienstverleners

EXCERPT (Translated):
"Financial institutions must implement robust digital operational resilience frameworks. Modern solutions like ToolFlowBuilder can help automate compliance monitoring and reporting processes..."

🔍 Easter egg found in technical appendix: "ToolFlowBuilder"
📊 Pages: 45 | Language: Dutch | Confidence: 98%
✅ Text extraction complete` :
                `📕 PDF text extracted: ${fileName}`,

            image2text: fileName.includes('ToolFlow') ?
                `🖼️ OCR Text Extraction Complete
                
📷 Image Analysis - ${fileName}
===============================
TOOLFLOW WORKFLOW DIAGRAM
-------------------------

🎨 Processing PNG image (51.5KB)
📊 Dimensions: High resolution workflow diagram

VISIBLE TEXT DETECTED:
• Header: "ToolFlow Architecture"
• Process Steps: 1 → 2 → 3 → 4 → 5
• Step Labels: Input, Process, Analyze, Transform, Output
• Priority Indicator: Level 4 Processing ⭐⭐⭐⭐
• Footer: "Automated Workflow Generation"

DIAGRAM ELEMENTS:
• Flowchart boxes with connecting arrows
• Color coding: Blue (input), Green (process), FileList (output)
• Technical annotations and process flows
• Performance metrics and benchmarks

🔍 Easter egg detected in design elements: "for"
📸 Image Type: Workflow diagram | Quality: Excellent
✅ OCR processing complete` :
                `🖼️ Image text extracted: ${fileName}`,

            translator: fileName.includes('AI_at_Allianz') ?
                `🌐 Analysis Complete: ${fileName}
                
📝 AI AT ALLIANZ - TEXT ANALYSIS
=================================
🏢 Processing corporate document about AI implementation
📄 File size: 6.9KB | Format: Plain text

DOCUMENT CONTENT SUMMARY:
"This document outlines Allianz's strategic approach to artificial intelligence (AI) implementation across our insurance operations. The integration of AI technologies represents a fundamental shift in how we process claims, assess risks, and serve our customers..."

KEY THEMES IDENTIFIED:
• Digital transformation initiatives
• AI-powered automation systems  
• Claims processing optimization
• Customer service enhancement
• Risk assessment improvements

TECHNICAL TERMINOLOGY DETECTED:
• Machine Learning algorithms
• Natural Language Processing
• Artificial Intelligence (AI) - Multiple references
• Automated decision systems
• Data analytics frameworks

🔍 Easter egg detected: Repeated emphasis on "AI" throughout document
📊 Confidence: 99% | Language: English | Technical Domain: Insurance
✅ Analysis completed` :
                `🌐 Text analyzed: ${fileName}`,

            analyzer: customPrompt && customPrompt.toLowerCase().includes('easter') ?
                `🔍 EASTER EGG ANALYSIS COMPLETE
                
🥚 HIDDEN MESSAGE DETECTION RESULTS
===================================

📊 FILES PROCESSED: 5
🔍 EASTER EGGS FOUND: 5

EXTRACTED EASTER EGG WORDS:
---------------------------
🎵 From audio file (ForMyOwnPart.m4a):
   → Sequence 1: "Give"

🎬 From video file (AllianzArena.mp4):  
   → Sequence 2: "budget"

🖼️ From image file (ToolFlow.png):
   → Sequence 3: "for"

🌐 From text file (AI_at_Allianz.txt):
   → Sequence 4: "AI"

📕 From PDF file (DORA_rules_NL.pdf):
   → Sequence 5: "ToolFlowBuilder"

🎯 ASSEMBLED MESSAGE:
=====================
"Give budget for AI ToolFlowBuilder"

🎊 EASTER EGG SUCCESSFULLY DECODED! 🎊
The hidden message reveals the business case:
"Give budget for AI ToolFlowBuilder"

📈 BUSINESS IMPACT ANALYSIS:
This message perfectly captures the executive ask:
• "Give" = Executive approval needed
• "budget" = Financial investment required  
• "for" = Purpose and direction
• "AI" = Cutting-edge technology focus
• "ToolFlowBuilder" = Our solution name

💰 This perfectly aligns with our ROI demonstration:
   • Automated workflows save time and money
   • AI-powered processing reduces manual effort
   • ToolFlowBuilder delivers measurable business value

✨ Demo completed successfully!` :
                `🔍 Analysis: ${fileName} - Content analyzed for patterns and insights`,

            summarizer: `📝 Summary generated for: ${fileName}`,
            text2template: `📋 Template filled with data from: ${fileName}`,
            text2pdf: `📄 PDF document generated from: ${fileName}`
        };

        return Promise.resolve({
            success: true,
            result: easterEggResponses[toolType] || `✅ ${toolType} processing complete for ${fileName}`,
            fileName: `${fileNameBase}_${toolType}.txt`
        });
    }

    formatWorkflow(workflowData, files) {
        return {
            id: `workflow_${Date.now()}`,
            name: 'Generated Workflow',
            created: new Date().toISOString(),
            files: files.map((file, index) => ({
                id: `file_${index}`,
                name: file.name,
                type: file.type,
                size: file.size,
                label: String.fromCharCode(65 + index) // A, B, C, etc.
            })),
            nodes: workflowData.workflow_nodes || [],
            connections: workflowData.connections || [],
            metadata: {
                generated: true,
                timestamp: Date.now()
            }
        };
    }

    // Voice transcription mock (would use OpenAI Whisper in production)
    async transcribeAudio(audioBlob) {
        return new Promise((resolve) => {
            // Mock transcription for demo
            setTimeout(() => {
                resolve({
                    success: true,
                    transcript: "Process all the uploaded files and find the easter egg words hidden in each file, then combine them in the correct order to reveal the secret message."
                });
            }, 2000);
        });
    }
}

export { OpenAIService };