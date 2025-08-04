# Suggested Commands for Development

## Essential Development Commands

### Installation and Setup
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Then edit .env with your Discord bot token and client ID
```

### Running the Application
```bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev
```

### Git and Version Control
```bash
# Standard git operations
git status
git add .
git commit -m "message"
git push
```

### System Utilities (Linux/WSL2)
```bash
# File operations
ls -la
find . -name "*.js"
grep -r "pattern" .

# Process management
ps aux | grep node
kill <process_id>
```

### Environment and Configuration
```bash
# Check Node.js version
node --version

# Check npm version  
npm --version

# View environment variables
printenv | grep DISCORD
```

## Important Notes
- **No Testing Commands**: This project has no automated tests
- **No Linting/Formatting**: No ESLint, Prettier, or similar tools configured
- **No Build Process**: Direct execution of source code
- **Environment Required**: Must set up .env file with Discord credentials before running
- **Single File**: All code in index.js, no complex build or compilation needed

## Discord Bot Setup Requirements
1. Create Discord application at https://discord.com/developers/applications
2. Get bot token and client ID
3. Set appropriate permissions (Send Messages, Use Slash Commands, Connect, Speak, Mute Members, Move Members)
4. Invite bot to server with proper scopes (bot, applications.commands)