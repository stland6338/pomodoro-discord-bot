# Code Structure and Conventions

## File Structure
```
/
├── index.js          # Main application file (single-file architecture)
├── package.json      # NPM configuration and dependencies
├── README.md         # Documentation (in Japanese)
├── .env.example      # Environment variable template
├── .claude/          # Claude Code configuration
└── .serena/          # Serena tool configuration
```

## Code Organization
- **Single-file architecture**: All logic contained in `index.js`
- **Class-based design**: `PomodoroSession` class manages individual sessions
- **Event-driven**: Uses Discord.js event handlers
- **Global state**: `activeSessions` Map for session management

## Coding Conventions

### Language & Style
- **Language**: JavaScript (ES6+)
- **Comments**: Japanese language comments and console logs
- **Naming**: 
  - Classes: PascalCase (`PomodoroSession`)
  - Variables/Methods: camelCase (`currentCycle`, `muteAllMembers`)
  - Constants: camelCase for configuration (`focusTime`, `totalCycles`)

### Code Patterns
- **Async/Await**: Consistent use for Discord API calls
- **Error Handling**: Try-catch blocks for Discord operations with console logging
- **Method Organization**: Logical grouping within PomodoroSession class
- **State Management**: Clear state properties with descriptive names

### Discord.js Patterns
- **Embeds**: Consistent use of EmbedBuilder for rich messages
- **Components**: ActionRowBuilder with ButtonBuilder for interactions
- **Event Handling**: Separate handlers for different interaction types
- **Error Responses**: Ephemeral replies for error messages

### Session Management
- **Timer Handling**: setTimeout for phase transitions
- **State Tracking**: Boolean flags for pause/break/active states
- **Cleanup**: Proper timer clearing and Map removal
- **Member Handling**: Iteration over voice channel members

### No Linting/Formatting
- No ESLint, Prettier, or other code quality tools configured
- No automated code formatting standards enforced