# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ToolFlowBuilder is a visual AI workflow designer that transforms complex multi-file processing tasks into automated workflows. The application is a browser-based JavaScript application with a modular ES6 architecture.

## Development Commands

Since this is a browser-based application with no build system:
- **Run locally**: Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
- **No build process**: Direct ES6 module imports, no bundling required
- **No tests**: Application uses demo mode with pre-programmed responses for reliability
- **No lint/typecheck**: Pure JavaScript with no formal tooling setup

## Architecture Overview

### Core Application Structure
The application follows a modular ES6 architecture with clear separation of concerns:

- **Entry Point**: `src/main.js` - Main ToolFlowBuilder class that orchestrates all components
- **Event System**: EventBus pattern for loose coupling between components
- **Module Categories**:
  - `components/` - UI components (UploadZone, WorkflowCanvasManager, OutputZone, ToolPalette, VoiceInput)
  - `services/` - Business logic and data management 
  - `utils/` - Utility functions and helpers
  - `config/` - Configuration management

### Key Services Architecture
- **WorkflowEngine**: Orchestrates workflow execution and node processing
- **OpenAIService**: Handles AI integration with GPT-4o function calling
- **FileProcessor**: Manages file type detection and processing routing
- **InputFilesManager** & **TextFilesManager**: File management system (File List/Text Files box system)
- **CascadingDeleteManager**: Handles complex deletion dependencies between workflow nodes
- **OutputRouter**: Manages result processing and naming conventions

### V4 Refactored Node System Architecture
The codebase recently underwent major architectural refactoring to eliminate circular dependencies and improve maintainability:

- **NodeDataManager**: Centralized node data management and validation
- **NodeUIManager**: Node rendering, styling, and UI interactions  
- **WorkflowCanvasManager**: Canvas-specific operations (simplified from old WorkflowCanvas.js)
- **ConnectionManager**: Node connection logic and visualization
- **CascadingDeleteManager**: Complex deletion dependency handling

**CRITICAL**: When working with nodes, always use these managers instead of trying to access node properties directly. The old monolithic NodeManager.js (1,711 lines) was refactored into these specialized managers.

### UI Layout System
The application uses a 4-zone layout system:
1. **File List Box**: Input files (left panel)
2. **Text Files Box**: Text files (integrated with File List box)  
3. **Workflow Canvas**: Visual node editor (center)
4. **Output Zone**: Results and downloads (right panel)

### CSS Architecture
- **Custom CSS classes**: Uses classes defined in `src/styles.css`
- **NO Tailwind CSS**: Don't use classes like `bg-blue-500`, `text-gray-900`, `rounded-lg`
- **Available utilities**: `.flex`, `.items-center`, `.justify-center`, `.container`, etc.
- **Always check**: `src/styles.css` for available classes before assuming utilities exist

## Configuration

### Environment Setup
- Copy `.env.example` to `.env` for OpenAI API key configuration
- API key is optional - application runs in demo mode without it
- Configuration loaded via `src/config/config.js` with multiple fallback methods
- **Current config**: Uses GPT-4o model, 50MB file limit, comprehensive file type support

### File Support
- **Audio**: mp3, wav, m4a, mp4
- **Video**: mp4, mov, avi, webm
- **Images**: png, jpg, jpeg, gif, webp  
- **Documents**: pdf, txt, docx, xlsx
- **Max file size**: 50MB per file

## Development Patterns

### EventBus Communication
All components communicate through a central EventBus to maintain loose coupling:
```javascript
this.eventBus.emit('event-name', data);
this.eventBus.on('event-name', handler);
```

### Service Dependencies
Services are initialized in specific order due to dependencies:
1. CascadingDeleteManager (required by others)
2. ConnectionManager (required by node managers)
3. File managers (InputFilesManager, TextFilesManager)
4. Node managers (NodeDataManager, NodeUIManager) 
5. Core services (OpenAIService, WorkflowEngine, etc.)
6. UI components

### Node System Architecture
Workflow nodes follow a standard pattern:
- Each node type has processing logic in WorkflowEngine
- Node data managed by NodeDataManager
- Node UI handled by NodeUIManager  
- Connections managed by ConnectionManager
- Complex deletion handling via CascadingDeleteManager
- Color coding managed by NodeColorManager

## Demo System

The application includes a sophisticated demo system:
- **Easter Egg Demo**: Pre-loaded files that reveal hidden business message
- **Demo Mode**: Works offline with pre-programmed AI responses
- **File Examples**: Located in `demo/` directory
- **Realistic Processing**: Simulated delays and progress indicators

## Recent Major Refactoring

The codebase underwent significant architectural improvements:
- **Eliminated**: 2,729 lines of complex, intertwined code
- **Created**: Clean separation of concerns with specialized managers  
- **Removed**: Circular dependencies and duplicate event handlers
- **Result**: 34% reduction in codebase size, 100% functional compatibility
- **Documentation**: Full details in `design/REFACTORING_DOCUMENTATION.md`

## Business Context

This is an executive demo application designed to showcase ROI potential:
- Processes multiple file types simultaneously
- Demonstrates 25+ hour manual tasks reduced to 30 minutes
- Shows £12,250+ savings per workflow at £50/hour
- Built to secure enterprise development investment

## Important Code Patterns

### When Working with Nodes
```javascript
// CORRECT - Use managers
this.nodeDataManager.createNode(nodeData);
this.nodeUIManager.renderNode(nodeId);
this.connectionManager.addConnection(sourceId, targetId);

// INCORRECT - Don't access directly
node.data = newData; // Use NodeDataManager instead
```

### When Working with Files
```javascript
// File type detection
const fileType = Config.getFileType(filename);
const isSupported = Config.isFileTypeSupported(filename);

// File processing
this.fileProcessor.processFile(file, fileType);
```

### When Implementing New Features
1. Check existing event patterns in EventBus
2. Use appropriate manager for node operations
3. Follow CSS class conventions from `src/styles.css`
4. Maintain demo mode compatibility
5. Consider impact on CascadingDeleteManager for node-related changes