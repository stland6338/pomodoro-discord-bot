# Tech Stack and Dependencies

## Runtime Environment
- **Node.js**: JavaScript runtime
- **Platform**: Linux (specifically WSL2 based on current environment)

## Core Dependencies
- **discord.js**: `^14.14.1` - Discord API library for bot functionality
- **dotenv**: `^16.3.1` - Environment variable management

## Development Dependencies
- **nodemon**: `^3.0.2` - Development server with auto-restart

## Discord.js Features Used
- Client with Gateway Intents (Guilds, GuildVoiceStates, GuildMessages)
- REST API for slash command registration
- EmbedBuilder for rich message formatting
- ActionRowBuilder and ButtonBuilder for interactive components
- Voice state management and member muting/unmuting

## Required Discord Bot Permissions
- Send Messages
- Use Slash Commands
- Connect (to voice channels)
- Speak (in voice channels)
- Mute Members
- Move Members

## Environment Configuration
- `DISCORD_TOKEN`: Bot authentication token
- `CLIENT_ID`: Discord application client ID

## No Testing Framework
The project currently has no automated testing setup - no test commands, testing libraries, or test files are present.