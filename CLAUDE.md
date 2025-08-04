# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm start` - Run the bot in production mode
- `npm run dev` - Run the bot in development mode with nodemon for auto-restart

### Setup
- `npm install` - Install dependencies
- Copy `.env.example` to `.env` and configure:
  - `DISCORD_TOKEN` - Bot token from Discord Developer Portal
  - `CLIENT_ID` - Application client ID from Discord Developer Portal

## Architecture

This is a Discord bot implementing the Pomodoro Technique for voice channels. The main architecture consists of:

### Core Components
- **Single-file application** (`index.js`) - All bot logic in one file
- **PomodoroSession class** - Manages individual timer sessions per voice channel
- **Session management** - Global `activeSessions` Map tracks active sessions by voice channel ID

### Key Features
- **Voice channel muting** - Automatically mutes/unmutes members during focus/break periods
- **Interactive controls** - Pause/resume/stop buttons via Discord message components
- **Multi-channel support** - Multiple voice channels can run independent sessions
- **Real-time updates** - Status messages update every 10 seconds
- **Auto-participant handling** - New voice channel joiners are automatically muted during focus periods

### Session Flow
1. 4 cycles of 25-minute focus (muted) + 5-minute break (unmuted)
2. Real-time embed updates showing remaining time and current phase
3. Button interactions for pause/resume/stop functionality
4. Automatic cleanup on completion or manual stop

### Discord.js Integration
- Uses Discord.js v14 with slash commands
- Requires intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`
- Registers global slash commands on bot startup
- Handles both chat input commands and button interactions

### Bot Permissions Required
- Send Messages
- Use Slash Commands  
- Connect (to voice channels)
- Speak (voice channel access)
- Mute Members (core functionality)
- Move Members (voice management)