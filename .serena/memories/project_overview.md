# Discord Pomodoro Timer Bot - Project Overview

## Purpose
This is a Discord bot that implements the Pomodoro Technique in Discord voice channels. The bot automatically manages focus and break periods, muting users during focus time and unmuting during breaks.

## Key Features
- 🍅 **Pomodoro Timer**: 25-minute focus sessions with 5-minute breaks for 4 cycles
- 🔇 **Auto Mute**: Mutes all voice channel members during focus time
- 🔊 **Auto Unmute**: Unmutes members during break time
- ⏸️ **Pause/Resume**: Can pause and resume sessions mid-cycle
- ⏹️ **Force Stop**: Can terminate sessions early
- 📊 **Real-time Display**: Updates remaining time every 10 seconds
- 👥 **Mid-session Join**: Handles users joining voice channels during sessions
- 🔄 **Concurrent Sessions**: Supports multiple voice channels simultaneously

## Architecture
- Single-file Node.js application (`index.js`)
- Class-based design with `PomodoroSession` managing individual sessions
- Event-driven Discord.js integration
- In-memory session storage using JavaScript Map
- Real-time UI updates using Discord embeds and buttons

## Session Flow
1. 🍅 Cycle 1 Focus (25min) - All muted
2. ☕ Cycle 1 Break (5min) - All unmuted
3. 🍅 Cycle 2 Focus (25min) - All muted
4. ☕ Cycle 2 Break (5min) - All unmuted
5. 🍅 Cycle 3 Focus (25min) - All muted
6. ☕ Cycle 3 Break (5min) - All unmuted
7. 🍅 Cycle 4 Focus (25min) - All muted
8. 🎉 Session Complete

## User Interface
- Slash command: `/pomodoro [channel]`
- Interactive buttons: Pause/Resume, Stop
- Real-time embed updates showing remaining time and status